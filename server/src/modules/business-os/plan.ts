// M.A.I.A. Business OS — Business Plan, versioned (spec sections 14-15).
// Editing an APPROVED version never mutates it in place — it always creates
// a new DRAFT version instead, so an approved strategy is never silently
// overwritten.

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../../db.js";
import { requireAuth, assertBusinessAccess, type AuthContext } from "../../rbac/middleware.js";
import { writeAuditLog } from "../../audit/log.js";

async function authorize(request: { authContext?: AuthContext }, businessId: string, level: "VIEW" | "EDIT"): Promise<boolean> {
  const ctx = request.authContext;
  if (!ctx) return false;
  return assertBusinessAccess(businessId, ctx, level);
}

const sectionsSchema = z.object({
  brandFoundation: z.string().optional(),
  businessModel: z.string().optional(),
  products: z.string().optional(),
  audience: z.string().optional(),
  positioning: z.string().optional(),
  offer: z.string().optional(),
  marketing: z.string().optional(),
  sales: z.string().optional(),
  operations: z.string().optional(),
  goalNotes: z.string().optional(),
});

async function getOrCreatePlan(businessId: string, requestingUserId: string) {
  const existing = await db.businessPlan.findUnique({ where: { businessId }, include: { currentVersion: true } });
  if (existing) return existing;
  return db.$transaction(async (tx) => {
    const plan = await tx.businessPlan.create({ data: { businessId } });
    const version = await tx.businessPlanVersion.create({ data: { businessPlanId: plan.id, versionNumber: 1, sectionsJson: {}, status: "DRAFT", createdById: requestingUserId } });
    return tx.businessPlan.update({ where: { id: plan.id }, data: { currentVersionId: version.id }, include: { currentVersion: true } });
  });
}

export async function businessPlanRoutes(app: FastifyInstance) {
  app.get("/api/businesses/:businessId/plan", { preHandler: [requireAuth] }, async (request, reply) => {
    const { businessId } = request.params as { businessId: string };
    if (!(await authorize(request, businessId, "VIEW"))) return reply.code(403).send({ error: "Forbidden: this business does not belong to you." });
    const plan = await getOrCreatePlan(businessId, request.authContext!.userId);
    return reply.send({ plan });
  });

  app.get("/api/businesses/:businessId/plan/versions", { preHandler: [requireAuth] }, async (request, reply) => {
    const { businessId } = request.params as { businessId: string };
    if (!(await authorize(request, businessId, "VIEW"))) return reply.code(403).send({ error: "Forbidden: this business does not belong to you." });
    const plan = await getOrCreatePlan(businessId, request.authContext!.userId);
    const versions = await db.businessPlanVersion.findMany({ where: { businessPlanId: plan.id }, orderBy: { versionNumber: "desc" } });
    return reply.send({ versions });
  });

  const updateSchema = z.object({ sections: sectionsSchema });

  app.put("/api/businesses/:businessId/plan", { preHandler: [requireAuth] }, async (request, reply) => {
    const { businessId } = request.params as { businessId: string };
    if (!(await authorize(request, businessId, "EDIT"))) return reply.code(403).send({ error: "Forbidden: this business does not belong to you." });
    const parsed = updateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid request.", details: parsed.error.flatten() });

    const ctx = request.authContext!;
    const plan = await getOrCreatePlan(businessId, request.authContext!.userId);
    const current = await db.businessPlanVersion.findUnique({ where: { id: plan.currentVersionId! } });

    if (current && current.status === "DRAFT") {
      const updated = await db.businessPlanVersion.update({ where: { id: current.id }, data: { sectionsJson: parsed.data.sections } });
      return reply.send({ version: updated });
    }

    // Current version is APPROVED — never overwritten. A new DRAFT version
    // is created instead, seeded from the approved one.
    const latest = await db.businessPlanVersion.findFirst({ where: { businessPlanId: plan.id }, orderBy: { versionNumber: "desc" } });
    const nextVersionNumber = (latest?.versionNumber ?? 0) + 1;
    const newVersion = await db.businessPlanVersion.create({ data: { businessPlanId: plan.id, versionNumber: nextVersionNumber, sectionsJson: parsed.data.sections, status: "DRAFT", createdById: ctx.userId } });
    await db.businessPlan.update({ where: { id: plan.id }, data: { currentVersionId: newVersion.id } });
    await writeAuditLog({ action: "Business Plan Version Created", summary: `Business plan version ${nextVersionNumber} drafted`, actorUserId: ctx.userId, entityType: "BusinessPlanVersion", entityId: newVersion.id });
    return reply.send({ version: newVersion });
  });

  app.post("/api/businesses/:businessId/plan/approve", { preHandler: [requireAuth] }, async (request, reply) => {
    const { businessId } = request.params as { businessId: string };
    if (!(await authorize(request, businessId, "EDIT"))) return reply.code(403).send({ error: "Forbidden: this business does not belong to you." });

    const ctx = request.authContext!;
    const plan = await getOrCreatePlan(businessId, request.authContext!.userId);
    const current = await db.businessPlanVersion.findUnique({ where: { id: plan.currentVersionId! } });
    if (!current) return reply.code(404).send({ error: "No current plan version to approve." });
    if (current.status === "APPROVED") return reply.send({ version: current });

    const approved = await db.businessPlanVersion.update({ where: { id: current.id }, data: { status: "APPROVED" } });
    await writeAuditLog({ action: "Business Plan Version Approved", summary: `Business plan version ${approved.versionNumber} approved`, actorUserId: ctx.userId, entityType: "BusinessPlanVersion", entityId: approved.id });
    return reply.send({ version: approved });
  });
}
