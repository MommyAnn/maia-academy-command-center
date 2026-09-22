// ADMIN -> AI TOOL LIBRARY + PROMPT / INSTRUCTION MANAGER + ACCESS RULES
// (spec sections 25-29, 59-61). Internal system instructions never leave
// this admin surface for a Student request (spec section 27) — the
// generation routes in generate-routes.ts read PromptVersion.systemInstruction
// server-side only and never echo it back in a response.

import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "../../db.js";
import { requireAuth, requirePermission } from "../../rbac/middleware.js";
import { writeAuditLog } from "../../audit/log.js";

const toolUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  category: z.string().min(1).optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "COMING_SOON"]).optional(),
  displayOrder: z.number().int().optional(),
  modelConfigId: z.string().nullable().optional(),
  usageRulesJson: z.record(z.string(), z.unknown()).optional(),
  outputSchemaJson: z.record(z.string(), z.unknown()).optional(),
});

const promptVersionCreateSchema = z.object({
  name: z.string().optional(),
  systemInstruction: z.string().min(1),
  changeNotes: z.string().optional(),
});

const packageAccessSchema = z.object({ packageId: z.string().min(1), toolKey: z.string().min(1) });
const manualGrantSchema = z.object({ toolKey: z.string().min(1), reason: z.string().optional() });
const usageLimitSchema = z.object({
  scope: z.enum(["GLOBAL", "PACKAGE", "TOOL", "PACKAGE_TOOL"]),
  packageId: z.string().nullable().optional(),
  toolId: z.string().nullable().optional(),
  dailyLimit: z.number().int().positive().nullable().optional(),
  monthlyLimit: z.number().int().positive().nullable().optional(),
});

export async function aiToolAdminRoutes(app: FastifyInstance) {
  // --- Tool Library (spec sections 25-27) -----------------------------------

  app.get("/api/ai-tools/tools", { preHandler: [requireAuth, requirePermission("AI Business Tools - Tool Library", "VIEW")] }, async (request, reply) => {
    const { category, status } = request.query as { category?: string; status?: string };
    const tools = await db.aiTool.findMany({
      where: { category: category || undefined, status: (status as never) || undefined },
      include: { modelConfig: true },
      orderBy: { displayOrder: "asc" },
    });
    return reply.send({ tools });
  });

  app.get("/api/ai-tools/tools/:toolKey", { preHandler: [requireAuth, requirePermission("AI Business Tools - Tool Library", "VIEW")] }, async (request, reply) => {
    const { toolKey } = request.params as { toolKey: string };
    const tool = await db.aiTool.findUnique({ where: { toolKey }, include: { modelConfig: true, promptVersions: { orderBy: { version: "desc" } } } });
    if (!tool) return reply.code(404).send({ error: "Tool not found." });
    return reply.send({ tool });
  });

  app.patch("/api/ai-tools/tools/:toolKey", { preHandler: [requireAuth, requirePermission("AI Business Tools - Tool Library", "EDIT")] }, async (request, reply) => {
    const { toolKey } = request.params as { toolKey: string };
    const parsed = toolUpdateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid tool update.", details: parsed.error.flatten() });

    const tool = await db.aiTool.update({
      where: { toolKey },
      data: {
        ...parsed.data,
        usageRulesJson: parsed.data.usageRulesJson as Prisma.InputJsonValue | undefined,
        outputSchemaJson: parsed.data.outputSchemaJson as Prisma.InputJsonValue | undefined,
      },
    });
    await writeAuditLog({ action: "AI Tool Changed", summary: `Tool "${tool.name}" updated${parsed.data.status ? ` (status: ${parsed.data.status})` : ""}`, actorUserId: request.authContext!.userId, entityType: "AiTool", entityId: tool.id });
    return reply.send({ tool });
  });

  // --- Prompt / Instruction Manager (spec sections 28-29) --------------------

  app.get("/api/ai-tools/tools/:toolKey/prompt-versions", { preHandler: [requireAuth, requirePermission("AI Business Tools - Prompts", "VIEW")] }, async (request, reply) => {
    const { toolKey } = request.params as { toolKey: string };
    const tool = await db.aiTool.findUnique({ where: { toolKey } });
    if (!tool) return reply.code(404).send({ error: "Tool not found." });
    const promptVersions = await db.promptVersion.findMany({ where: { toolId: tool.id }, orderBy: { version: "desc" } });
    return reply.send({ promptVersions });
  });

  app.post("/api/ai-tools/tools/:toolKey/prompt-versions", { preHandler: [requireAuth, requirePermission("AI Business Tools - Prompts", "CREATE")] }, async (request, reply) => {
    const { toolKey } = request.params as { toolKey: string };
    const parsed = promptVersionCreateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid prompt version.", details: parsed.error.flatten() });

    const tool = await db.aiTool.findUnique({ where: { toolKey } });
    if (!tool) return reply.code(404).send({ error: "Tool not found." });
    const latest = await db.promptVersion.findFirst({ where: { toolId: tool.id }, orderBy: { version: "desc" } });
    const nextVersion = (latest?.version ?? 0) + 1;

    const promptVersion = await db.promptVersion.create({
      data: {
        toolId: tool.id,
        name: parsed.data.name,
        version: nextVersion,
        systemInstruction: parsed.data.systemInstruction,
        status: "DRAFT",
        changeNotes: parsed.data.changeNotes,
        updatedById: request.authContext!.userId,
      },
    });
    await writeAuditLog({ action: "Prompt Version Changed", summary: `Prompt v${nextVersion} created (Draft) for tool "${tool.name}"`, actorUserId: request.authContext!.userId, entityType: "PromptVersion", entityId: promptVersion.id });
    return reply.code(201).send({ promptVersion });
  });

  // Publishing NEVER silently overwrites the production prompt (spec 29) —
  // exactly one ACTIVE version per tool at a time, the prior one archived,
  // both kept forever for AiGeneration.promptVersionId traceability.
  app.post("/api/ai-tools/prompt-versions/:id/publish", { preHandler: [requireAuth, requirePermission("AI Business Tools - Prompts", "EDIT")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const promptVersion = await db.promptVersion.findUnique({ where: { id } });
    if (!promptVersion) return reply.code(404).send({ error: "Prompt version not found." });

    await db.$transaction([
      db.promptVersion.updateMany({ where: { toolId: promptVersion.toolId, status: "ACTIVE" }, data: { status: "ARCHIVED" } }),
      db.promptVersion.update({ where: { id }, data: { status: "ACTIVE", publishedAt: new Date(), updatedById: request.authContext!.userId } }),
    ]);
    await writeAuditLog({ action: "Prompt Version Changed", summary: `Prompt v${promptVersion.version} published (Active)`, actorUserId: request.authContext!.userId, entityType: "PromptVersion", entityId: id });

    const published = await db.promptVersion.findUniqueOrThrow({ where: { id } });
    return reply.send({ promptVersion: published });
  });

  app.post("/api/ai-tools/prompt-versions/:id/archive", { preHandler: [requireAuth, requirePermission("AI Business Tools - Prompts", "EDIT")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const promptVersion = await db.promptVersion.update({ where: { id }, data: { status: "ARCHIVED" } });
    await writeAuditLog({ action: "Prompt Version Changed", summary: `Prompt v${promptVersion.version} archived`, actorUserId: request.authContext!.userId, entityType: "PromptVersion", entityId: id });
    return reply.send({ promptVersion });
  });

  // --- Access rules (spec sections 24, 61) -----------------------------------

  app.get("/api/ai-tools/package-access", { preHandler: [requireAuth, requirePermission("AI Business Tools - Access", "VIEW")] }, async (_request, reply) => {
    return reply.send({ grants: await db.aiPackageAccess.findMany({ include: { package: true } }) });
  });
  app.post("/api/ai-tools/package-access", { preHandler: [requireAuth, requirePermission("AI Business Tools - Access", "EDIT")] }, async (request, reply) => {
    const parsed = packageAccessSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid package access grant.", details: parsed.error.flatten() });
    const grant = await db.aiPackageAccess.upsert({
      where: { packageId_toolKey: { packageId: parsed.data.packageId, toolKey: parsed.data.toolKey } },
      update: {},
      create: parsed.data,
    });
    await writeAuditLog({ action: "AI Access Granted", summary: `Package access granted: ${parsed.data.toolKey} for package ${parsed.data.packageId}`, actorUserId: request.authContext!.userId, entityType: "AiPackageAccess", entityId: grant.id });
    return reply.code(201).send({ grant });
  });
  app.delete("/api/ai-tools/package-access/:id", { preHandler: [requireAuth, requirePermission("AI Business Tools - Access", "EDIT")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await db.aiPackageAccess.delete({ where: { id } }).catch(() => null);
    await writeAuditLog({ action: "AI Access Revoked", summary: `Package access grant ${id} removed`, actorUserId: request.authContext!.userId, entityType: "AiPackageAccess", entityId: id });
    return reply.code(204).send();
  });

  app.get("/api/students/:studentId/ai-manual-grants", { preHandler: [requireAuth, requirePermission("AI Business Tools - Access", "VIEW")] }, async (request, reply) => {
    const { studentId } = request.params as { studentId: string };
    return reply.send({ grants: await db.aiManualGrant.findMany({ where: { studentId }, include: { tool: true } }) });
  });
  app.post("/api/students/:studentId/ai-manual-grants", { preHandler: [requireAuth, requirePermission("AI Business Tools - Access", "EDIT")] }, async (request, reply) => {
    const { studentId } = request.params as { studentId: string };
    const parsed = manualGrantSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid manual grant.", details: parsed.error.flatten() });
    const tool = await db.aiTool.findUnique({ where: { toolKey: parsed.data.toolKey } });
    if (!tool) return reply.code(404).send({ error: "Tool not found." });
    const grant = await db.aiManualGrant.upsert({
      where: { studentId_toolId: { studentId, toolId: tool.id } },
      update: { reason: parsed.data.reason },
      create: { studentId, toolId: tool.id, reason: parsed.data.reason, grantedById: request.authContext!.userId },
    });
    await writeAuditLog({ action: "AI Access Granted", summary: `Manual grant: ${tool.name} for student ${studentId}`, actorUserId: request.authContext!.userId, entityType: "AiManualGrant", entityId: grant.id });
    return reply.code(201).send({ grant });
  });
  app.delete("/api/students/:studentId/ai-manual-grants/:id", { preHandler: [requireAuth, requirePermission("AI Business Tools - Access", "EDIT")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await db.aiManualGrant.delete({ where: { id } }).catch(() => null);
    await writeAuditLog({ action: "AI Access Revoked", summary: `Manual grant ${id} removed`, actorUserId: request.authContext!.userId, entityType: "AiManualGrant", entityId: id });
    return reply.code(204).send();
  });

  // --- Usage limits (spec sections 59-60) ------------------------------------

  app.get("/api/ai-tools/usage-limits", { preHandler: [requireAuth, requirePermission("AI Business Tools - Access", "VIEW")] }, async (_request, reply) => {
    return reply.send({ limits: await db.aiUsageLimit.findMany({ include: { package: true, tool: true } }) });
  });
  app.post("/api/ai-tools/usage-limits", { preHandler: [requireAuth, requirePermission("AI Business Tools - Access", "EDIT")] }, async (request, reply) => {
    const parsed = usageLimitSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid usage limit.", details: parsed.error.flatten() });

    // Postgres unique indexes treat every NULL as distinct from every other
    // NULL, so the @@unique([scope, packageId, toolId]) constraint alone
    // cannot dedupe a GLOBAL-scope row (both nullable columns null) —
    // resolved here at the application layer instead of via upsert().
    const packageId = parsed.data.packageId ?? null;
    const toolId = parsed.data.toolId ?? null;
    const existing = await db.aiUsageLimit.findFirst({ where: { scope: parsed.data.scope, packageId, toolId } });
    const limit = existing
      ? await db.aiUsageLimit.update({ where: { id: existing.id }, data: { dailyLimit: parsed.data.dailyLimit, monthlyLimit: parsed.data.monthlyLimit, updatedById: request.authContext!.userId } })
      : await db.aiUsageLimit.create({ data: { scope: parsed.data.scope, packageId, toolId, dailyLimit: parsed.data.dailyLimit, monthlyLimit: parsed.data.monthlyLimit, updatedById: request.authContext!.userId } });
    await writeAuditLog({ action: "AI Usage Limit Changed", summary: `Usage limit set for scope ${parsed.data.scope}`, actorUserId: request.authContext!.userId, entityType: "AiUsageLimit", entityId: limit.id });
    return reply.code(201).send({ limit });
  });
  app.delete("/api/ai-tools/usage-limits/:id", { preHandler: [requireAuth, requirePermission("AI Business Tools - Access", "EDIT")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await db.aiUsageLimit.delete({ where: { id } }).catch(() => null);
    await writeAuditLog({ action: "AI Usage Limit Changed", summary: `Usage limit ${id} removed`, actorUserId: request.authContext!.userId, entityType: "AiUsageLimit", entityId: id });
    return reply.code(204).send();
  });
}
