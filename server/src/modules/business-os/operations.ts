// M.A.I.A. Business OS — Operations: SOP Library + Content Calendar (spec
// sections 61-66). The "Automation Opportunity" signal is a disclosed,
// deterministic rule over real SOP data — never an autonomous trigger
// (spec section 66: "Do not automatically automate").

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../../db.js";
import { requireAuth, requireStudentSelfOrPermission, assertBusinessAccess, type AuthContext } from "../../rbac/middleware.js";
import { writeAuditLog } from "../../audit/log.js";
import { generateSopDisplayId } from "../sequence.js";

export const SOP_STATUSES = ["DRAFT", "ACTIVE", "ARCHIVED"] as const;
export const CONTENT_TYPES = ["ORGANIC", "PAID", "EDUCATIONAL", "SALES", "COMMUNITY"] as const;
export const CONTENT_STAGES = ["IDEA", "DRAFT", "FOR_REVIEW", "APPROVED", "SCHEDULED", "PUBLISHED", "ARCHIVED"] as const;

// A manual SOP with 5+ steps is flagged as worth reviewing for automation —
// a plain, disclosed threshold, never an ML guess (spec section 66).
const AUTOMATION_OPPORTUNITY_STEP_THRESHOLD = 5;

async function authorize(request: { authContext?: AuthContext }, businessId: string, level: "VIEW" | "EDIT"): Promise<boolean> {
  const ctx = request.authContext;
  if (!ctx) return false;
  return assertBusinessAccess(businessId, ctx, level);
}

export async function businessOperationsRoutes(app: FastifyInstance) {
  // --- SOP Library -----------------------------------------------------------

  const createSopSchema = z.object({
    businessId: z.string().min(1),
    title: z.string().min(1),
    purpose: z.string().optional(),
    steps: z.array(z.string().min(1)).min(1),
    relatedProcess: z.string().optional(),
  });

  app.post("/api/students/:studentId/sops", { preHandler: [requireAuth, requireStudentSelfOrPermission("Business OS", "CREATE")] }, async (request, reply) => {
    const parsed = createSopSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid request.", details: parsed.error.flatten() });
    if (!(await authorize(request, parsed.data.businessId, "EDIT"))) return reply.code(403).send({ error: "Forbidden: this business does not belong to you." });

    const ctx = request.authContext!;
    const sop = await db.sopDocument.create({
      data: { sopDisplayId: await generateSopDisplayId(), businessId: parsed.data.businessId, title: parsed.data.title, purpose: parsed.data.purpose, stepsJson: parsed.data.steps, relatedProcess: parsed.data.relatedProcess, ownerId: ctx.userId, createdById: ctx.userId },
    });
    await writeAuditLog({ action: "SOP Created", summary: `SOP "${sop.title}" created`, actorUserId: ctx.userId, entityType: "SopDocument", entityId: sop.id });
    return reply.code(201).send({ sop });
  });

  app.get("/api/businesses/:businessId/sops", { preHandler: [requireAuth] }, async (request, reply) => {
    const { businessId } = request.params as { businessId: string };
    if (!(await authorize(request, businessId, "VIEW"))) return reply.code(403).send({ error: "Forbidden: this business does not belong to you." });
    const sops = await db.sopDocument.findMany({ where: { businessId }, orderBy: { createdAt: "desc" } });
    const automationOpportunities = sops
      .filter((s) => s.status === "ACTIVE" && Array.isArray(s.stepsJson) && (s.stepsJson as unknown[]).length >= AUTOMATION_OPPORTUNITY_STEP_THRESHOLD)
      .map((s) => ({ sopId: s.id, title: s.title, stepCount: (s.stepsJson as unknown[]).length, reason: `${(s.stepsJson as unknown[]).length} manual steps (threshold: ${AUTOMATION_OPPORTUNITY_STEP_THRESHOLD}+) — review for automation. This is a suggestion only; nothing is automated without explicit approval.` }));
    return reply.send({ sops, automationOpportunities });
  });

  const updateSopSchema = z.object({ status: z.enum(SOP_STATUSES).optional(), steps: z.array(z.string().min(1)).optional() });

  app.patch("/api/sops/:id", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const sop = await db.sopDocument.findUnique({ where: { id } });
    if (!sop) return reply.code(404).send({ error: "SOP not found." });
    if (!(await authorize(request, sop.businessId, "EDIT"))) return reply.code(403).send({ error: "Forbidden." });
    const parsed = updateSopSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid request." });

    const data: { status?: string; stepsJson?: string[]; version?: number } = {};
    if (parsed.data.status) data.status = parsed.data.status;
    if (parsed.data.steps) {
      data.stepsJson = parsed.data.steps;
      data.version = sop.version + 1;
    }
    const updated = await db.sopDocument.update({ where: { id }, data });
    if (parsed.data.status) {
      await writeAuditLog({ action: "SOP Status Changed", summary: `SOP "${sop.title}" status -> ${parsed.data.status}`, actorUserId: request.authContext!.userId, entityType: "SopDocument", entityId: id });
    }
    return reply.send({ sop: updated });
  });

  // --- Content Calendar -------------------------------------------------------

  const createContentSchema = z.object({
    businessId: z.string().min(1),
    title: z.string().min(1),
    contentType: z.enum(CONTENT_TYPES),
    scheduledDate: z.string().datetime().optional(),
    relatedHookId: z.string().optional(),
    relatedScriptId: z.string().optional(),
    campaignId: z.string().optional(),
  });

  app.post("/api/students/:studentId/content-calendar", { preHandler: [requireAuth, requireStudentSelfOrPermission("Business OS", "CREATE")] }, async (request, reply) => {
    const parsed = createContentSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid request.", details: parsed.error.flatten() });
    if (!(await authorize(request, parsed.data.businessId, "EDIT"))) return reply.code(403).send({ error: "Forbidden: this business does not belong to you." });

    const ctx = request.authContext!;
    const item = await db.contentCalendarItem.create({
      data: {
        businessId: parsed.data.businessId,
        title: parsed.data.title,
        contentType: parsed.data.contentType,
        scheduledDate: parsed.data.scheduledDate ? new Date(parsed.data.scheduledDate) : null,
        relatedHookId: parsed.data.relatedHookId,
        relatedScriptId: parsed.data.relatedScriptId,
        campaignId: parsed.data.campaignId,
        createdById: ctx.userId,
      },
    });
    await writeAuditLog({ action: "Content Calendar Item Created", summary: `Content item "${item.title}" created`, actorUserId: ctx.userId, entityType: "ContentCalendarItem", entityId: item.id });
    return reply.code(201).send({ item });
  });

  app.get("/api/businesses/:businessId/content-calendar", { preHandler: [requireAuth] }, async (request, reply) => {
    const { businessId } = request.params as { businessId: string };
    if (!(await authorize(request, businessId, "VIEW"))) return reply.code(403).send({ error: "Forbidden: this business does not belong to you." });
    const { stage } = request.query as { stage?: string };
    const items = await db.contentCalendarItem.findMany({ where: { businessId, stage: stage || undefined }, orderBy: { scheduledDate: "asc" } });
    return reply.send({ items });
  });

  const updateContentSchema = z.object({ stage: z.enum(CONTENT_STAGES) });

  app.patch("/api/content-calendar/:id", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const item = await db.contentCalendarItem.findUnique({ where: { id } });
    if (!item) return reply.code(404).send({ error: "Content item not found." });
    if (!(await authorize(request, item.businessId, "EDIT"))) return reply.code(403).send({ error: "Forbidden." });
    const parsed = updateContentSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid request." });

    // PUBLISHED is never set here — this system has no real publishing
    // integration (spec section 53). The furthest honest stage is
    // APPROVED/SCHEDULED, surfaced to the UI as "READY TO PUBLISH".
    if (parsed.data.stage === "PUBLISHED") {
      return reply.code(422).send({ error: "No publishing integration is connected. This item can be marked APPROVED/SCHEDULED (READY TO PUBLISH), never PUBLISHED, until a real integration confirms it." });
    }

    const updated = await db.contentCalendarItem.update({ where: { id }, data: { stage: parsed.data.stage } });
    await writeAuditLog({ action: "Content Calendar Item Stage Changed", summary: `Content item "${item.title}" stage -> ${parsed.data.stage}`, actorUserId: request.authContext!.userId, entityType: "ContentCalendarItem", entityId: id });
    return reply.send({ item: updated });
  });
}
