import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "../../db.js";
import { requireAuth, requireStudentSelfOrPermission, requirePermission, assertBusinessOwnedByStudent } from "../../rbac/middleware.js";
import { runToolGeneration, retryGeneration } from "./engine.js";
import { listAccessibleToolKeys } from "./access.js";
import { generateAiProjectDisplayId } from "../sequence.js";

const generateSchema = z.object({
  businessId: z.string().min(1),
  userRequest: z.string().min(1),
  projectId: z.string().optional(),
  referenceDocumentIds: z.array(z.string()).optional(),
});

const projectSchema = z.object({ businessId: z.string().min(1), name: z.string().min(1), type: z.string().min(1) });

const handoffSchema = z.object({
  destinationToolKey: z.string().min(1),
  selectedSections: z.array(z.string()).min(1),
  userInstructions: z.string().optional(),
});

export async function aiToolGenerateRoutes(app: FastifyInstance) {
  // Student-visible tool list — ACTIVE tools this Student's package/manual grants actually cover.
  app.get("/api/students/:studentId/ai-tools", { preHandler: [requireAuth, requireStudentSelfOrPermission("AI Business Tools - Usage", "VIEW")] }, async (request, reply) => {
    const { studentId } = request.params as { studentId: string };
    const [tools, accessibleKeys] = await Promise.all([
      db.aiTool.findMany({ where: { status: "ACTIVE" }, orderBy: { displayOrder: "asc" } }),
      listAccessibleToolKeys(studentId),
    ]);
    return reply.send({ tools: tools.map((t) => ({ ...t, hasAccess: accessibleKeys.has(t.toolKey) })) });
  });

  // Real generation — rate-limited per session to prevent spam/runaway cost (spec section 59).
  app.post(
    "/api/students/:studentId/ai-tools/:toolKey/generate",
    { preHandler: [requireAuth, requireStudentSelfOrPermission("AI Business Tools - Usage", "CREATE")], config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const { studentId, toolKey } = request.params as { studentId: string; toolKey: string };
      const parsed = generateSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: "Invalid generation request.", details: parsed.error.flatten() });

      const outcome = await runToolGeneration({
        studentId,
        businessId: parsed.data.businessId,
        toolKey,
        userRequest: parsed.data.userRequest,
        projectId: parsed.data.projectId,
        referenceDocumentIds: parsed.data.referenceDocumentIds,
        actorUserId: request.authContext!.userId,
      });
      if (!outcome.ok) return reply.code(outcome.httpStatus).send({ error: outcome.reason });

      const generation = await db.aiGeneration.findUniqueOrThrow({ where: { id: outcome.generationId } });
      return reply.code(201).send({ generation });
    },
  );

  app.post("/api/ai-generations/:id/retry", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const original = await db.aiGeneration.findUnique({ where: { id } });
    if (!original) return reply.code(404).send({ error: "Generation not found." });
    const ctx = request.authContext!;
    if (ctx.kind === "student" && ctx.studentId !== original.studentId) return reply.code(403).send({ error: "Forbidden: not your generation." });

    const outcome = await retryGeneration(id, ctx.userId);
    if (!outcome.ok) return reply.code(outcome.httpStatus).send({ error: outcome.reason });
    const generation = await db.aiGeneration.findUniqueOrThrow({ where: { id: outcome.generationId } });
    return reply.code(201).send({ generation });
  });

  // --- Projects (spec section 30) --------------------------------------------

  app.get("/api/students/:studentId/ai-projects", { preHandler: [requireAuth, requireStudentSelfOrPermission("AI Business Tools - Usage", "VIEW")] }, async (request, reply) => {
    const { studentId } = request.params as { studentId: string };
    const { businessId } = request.query as { businessId?: string };
    const projects = await db.aiProject.findMany({ where: { studentId, businessId: businessId || undefined }, orderBy: { createdAt: "desc" } });
    return reply.send({ projects });
  });

  app.post("/api/students/:studentId/ai-projects", { preHandler: [requireAuth, requireStudentSelfOrPermission("AI Business Tools - Usage", "CREATE")] }, async (request, reply) => {
    const { studentId } = request.params as { studentId: string };
    const parsed = projectSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid project.", details: parsed.error.flatten() });
    if (!(await assertBusinessOwnedByStudent(parsed.data.businessId, studentId))) return reply.code(403).send({ error: "Forbidden: this business does not belong to you." });

    const publishedDoc = await db.masterBrainDocument.findFirst({ where: { businessId: parsed.data.businessId, isCurrentPublished: true } });
    const project = await db.aiProject.create({
      data: {
        projectDisplayId: await generateAiProjectDisplayId(),
        studentId,
        businessId: parsed.data.businessId,
        name: parsed.data.name,
        type: parsed.data.type,
        masterBrainVersionAtCreation: publishedDoc?.documentVersion ?? null,
      },
    });
    return reply.code(201).send({ project });
  });

  app.get("/api/ai-projects/:projectId/generations", { preHandler: [requireAuth] }, async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const project = await db.aiProject.findUnique({ where: { id: projectId } });
    if (!project) return reply.code(404).send({ error: "Project not found." });
    const ctx = request.authContext!;
    if (ctx.kind === "student" && ctx.studentId !== project.studentId) return reply.code(403).send({ error: "Forbidden." });

    const generations = await db.aiGeneration.findMany({ where: { projectId }, orderBy: { createdAt: "desc" } });
    return reply.send({ generations });
  });

  // --- Generation history / favorites / archive (spec section 32) -----------

  app.get("/api/students/:studentId/ai-generations", { preHandler: [requireAuth, requireStudentSelfOrPermission("AI Business Tools - Usage", "VIEW")] }, async (request, reply) => {
    const { studentId } = request.params as { studentId: string };
    const { businessId, favorited, archived } = request.query as { businessId?: string; favorited?: string; archived?: string };
    const generations = await db.aiGeneration.findMany({
      where: {
        studentId,
        businessId: businessId || undefined,
        favorited: favorited === "true" ? true : undefined,
        archived: archived === "true" ? true : archived === "false" ? false : undefined,
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return reply.send({ generations });
  });

  for (const [path, field] of [["favorite", "favorited"], ["archive", "archived"]] as const) {
    app.post(`/api/ai-generations/:id/${path}`, { preHandler: [requireAuth] }, async (request, reply) => {
      const { id } = request.params as { id: string };
      const generation = await db.aiGeneration.findUnique({ where: { id } });
      if (!generation) return reply.code(404).send({ error: "Generation not found." });
      const ctx = request.authContext!;
      if (ctx.kind === "student" && ctx.studentId !== generation.studentId) return reply.code(403).send({ error: "Forbidden." });

      const updated = await db.aiGeneration.update({ where: { id }, data: { [field]: !generation[field] } });
      return reply.send({ generation: updated });
    });
  }

  // --- Cross-tool handoff (spec sections 66-67) -------------------------------
  // A deliberate excerpt, never the raw source generation — and it
  // immediately runs the destination tool with that excerpt as extra
  // context, rather than just recording intent.

  app.post("/api/ai-generations/:id/handoff", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = handoffSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid handoff.", details: parsed.error.flatten() });

    const source = await db.aiGeneration.findUnique({ where: { id } });
    if (!source) return reply.code(404).send({ error: "Source generation not found." });
    const ctx = request.authContext!;
    if (ctx.kind === "student" && ctx.studentId !== source.studentId) return reply.code(403).send({ error: "Forbidden." });
    if (source.status !== "COMPLETED") return reply.code(409).send({ error: "Only a completed generation can be handed off." });

    const destinationTool = await db.aiTool.findUnique({ where: { toolKey: parsed.data.destinationToolKey } });
    if (!destinationTool) return reply.code(404).send({ error: "Destination tool not found." });

    const outputText = (source.outputJson as { text?: string } | null)?.text ?? "";
    const excerpt = parsed.data.selectedSections.filter((section) => outputText.includes(section));
    const combinedRequest = [`Building on this earlier ${excerpt.length > 0 ? "selected " : ""}output:`, ...excerpt, parsed.data.userInstructions ?? ""].filter(Boolean).join("\n\n");

    const outcome = await runToolGeneration({
      studentId: source.studentId,
      businessId: source.businessId,
      toolKey: parsed.data.destinationToolKey,
      userRequest: combinedRequest,
      projectId: source.projectId ?? undefined,
      actorUserId: ctx.userId,
    });
    if (!outcome.ok) return reply.code(outcome.httpStatus).send({ error: outcome.reason });

    const handoff = await db.aiHandoff.create({
      data: {
        sourceGenerationId: source.id,
        destinationToolId: destinationTool.id,
        selectedSectionsJson: excerpt as unknown as Prisma.InputJsonValue,
        userInstructions: parsed.data.userInstructions,
        destinationGenerationId: outcome.generationId,
      },
    });

    const destinationGeneration = await db.aiGeneration.findUniqueOrThrow({ where: { id: outcome.generationId } });
    return reply.code(201).send({ handoff, destinationGeneration });
  });

  // --- Admin AI Activity read (spec section 77) — kept here alongside the engine it observes.

  app.get("/api/ai-tools/activity", { preHandler: [requireAuth, requirePermission("AI Business Tools - Technical Logs", "VIEW")] }, async (request, reply) => {
    const { studentId, businessId, status, toolKey } = request.query as { studentId?: string; businessId?: string; status?: string; toolKey?: string };
    const tool = toolKey ? await db.aiTool.findUnique({ where: { toolKey } }) : null;
    const generations = await db.aiGeneration.findMany({
      where: { studentId: studentId || undefined, businessId: businessId || undefined, status: status || undefined, toolId: tool?.id },
      include: { tool: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return reply.send({ generations });
  });
}
