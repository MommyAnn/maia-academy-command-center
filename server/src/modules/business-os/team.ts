// M.A.I.A. Business OS — Business stage, UI experience level, and per-
// Business team access (spec sections 7, 67-69, 109). Granting/revoking a
// team member is deliberately restricted to the owning Student or staff
// oversight — never to another invited team member, however senior their
// per-Business role, so a MANAGER can never grant themselves OWNER.

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../../db.js";
import { requireAuth, assertBusinessOwnedByStudent, assertBusinessAccess } from "../../rbac/middleware.js";
import { writeAuditLog } from "../../audit/log.js";

export const BUSINESS_STAGES = ["FOUNDATION", "BUILDING", "LAUNCHING", "OPERATING", "GROWING", "SCALING"] as const;
export const BUSINESS_ROLES = ["OWNER", "MANAGER", "MARKETING", "SALES", "SUPPORT", "OPERATIONS", "CUSTOM"] as const;

async function isOwningStudentOrStaff(businessId: string, ctx: { kind: string; studentId?: string; userId: string }): Promise<boolean> {
  if (ctx.kind === "staff") return true;
  if (ctx.kind === "student" && ctx.studentId) return assertBusinessOwnedByStudent(businessId, ctx.studentId);
  return false;
}

export async function businessTeamRoutes(app: FastifyInstance) {
  const stageSchema = z.object({ stage: z.enum(BUSINESS_STAGES).nullable() });

  // Explicit, explainable stage assignment only (spec section 7) — never
  // auto-assigned by AI without this confirmation step.
  app.patch("/api/businesses/:businessId/stage", { preHandler: [requireAuth] }, async (request, reply) => {
    const { businessId } = request.params as { businessId: string };
    const ctx = request.authContext!;
    if (!(await assertBusinessAccess(businessId, ctx, "EDIT"))) return reply.code(403).send({ error: "Forbidden: this business does not belong to you." });
    const parsed = stageSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid request.", details: parsed.error.flatten() });

    const business = await db.business.update({ where: { id: businessId }, data: { stage: parsed.data.stage, stageSetById: ctx.userId, stageSetAt: new Date() } });
    await writeAuditLog({ action: "Business Stage Set", summary: `Business stage set to ${parsed.data.stage ?? "(unset)"}`, actorUserId: ctx.userId, entityType: "Business", entityId: businessId });
    return reply.send({ business });
  });

  const uiLevelSchema = z.object({ uiExperienceLevel: z.enum(["GUIDED", "ADVANCED"]) });

  app.patch("/api/businesses/:businessId/ui-experience-level", { preHandler: [requireAuth] }, async (request, reply) => {
    const { businessId } = request.params as { businessId: string };
    const ctx = request.authContext!;
    if (!(await assertBusinessAccess(businessId, ctx, "VIEW"))) return reply.code(403).send({ error: "Forbidden: this business does not belong to you." });
    const parsed = uiLevelSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid request." });
    // Changes interface complexity only, never data access (spec 109) — any
    // team member with VIEW access may set their own preferred complexity.
    const business = await db.business.update({ where: { id: businessId }, data: { uiExperienceLevel: parsed.data.uiExperienceLevel } });
    return reply.send({ business });
  });

  app.get("/api/businesses/:businessId/team", { preHandler: [requireAuth] }, async (request, reply) => {
    const { businessId } = request.params as { businessId: string };
    const ctx = request.authContext!;
    if (!(await assertBusinessAccess(businessId, ctx, "VIEW"))) return reply.code(403).send({ error: "Forbidden: this business does not belong to you." });
    const grants = await db.businessRoleGrant.findMany({ where: { businessId }, include: { user: { include: { person: true } } }, orderBy: { createdAt: "asc" } });
    return reply.send({ grants });
  });

  const grantSchema = z.object({ userId: z.string().min(1), role: z.enum(BUSINESS_ROLES) });

  app.post("/api/businesses/:businessId/team", { preHandler: [requireAuth] }, async (request, reply) => {
    const { businessId } = request.params as { businessId: string };
    const ctx = request.authContext!;
    if (!(await isOwningStudentOrStaff(businessId, ctx))) return reply.code(403).send({ error: "Forbidden: only the business owner or staff may manage its team." });
    const parsed = grantSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid request.", details: parsed.error.flatten() });

    const targetUser = await db.user.findUnique({ where: { id: parsed.data.userId } });
    if (!targetUser) return reply.code(404).send({ error: "User not found." });

    const grant = await db.businessRoleGrant.upsert({
      where: { businessId_userId: { businessId, userId: parsed.data.userId } },
      update: { role: parsed.data.role },
      create: { businessId, userId: parsed.data.userId, role: parsed.data.role, grantedById: ctx.userId },
    });
    await writeAuditLog({ action: "Business Role Granted", summary: `Granted ${parsed.data.role} on business to user ${parsed.data.userId}`, actorUserId: ctx.userId, entityType: "BusinessRoleGrant", entityId: grant.id });
    return reply.code(201).send({ grant });
  });

  app.delete("/api/businesses/:businessId/team/:userId", { preHandler: [requireAuth] }, async (request, reply) => {
    const { businessId, userId } = request.params as { businessId: string; userId: string };
    const ctx = request.authContext!;
    if (!(await isOwningStudentOrStaff(businessId, ctx))) return reply.code(403).send({ error: "Forbidden: only the business owner or staff may manage its team." });

    const grant = await db.businessRoleGrant.findUnique({ where: { businessId_userId: { businessId, userId } } });
    if (!grant) return reply.code(404).send({ error: "Team grant not found." });
    await db.businessRoleGrant.delete({ where: { id: grant.id } });
    await writeAuditLog({ action: "Business Role Revoked", summary: `Revoked business team access for user ${userId}`, actorUserId: ctx.userId, entityType: "BusinessRoleGrant", entityId: grant.id });
    return reply.send({ ok: true });
  });
}
