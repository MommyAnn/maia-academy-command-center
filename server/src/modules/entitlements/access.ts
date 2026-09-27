// Student Access Center ("My Access") + Admin Customer Access view (spec
// sections 90-95). Every entitlement shown carries its real source, so a
// Student can always answer "why do I have this?" (spec section 91), and
// Admin manual grant/revoke require a reason and are fully audited (spec
// sections 94-95).

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../../db.js";
import { requireAuth, requireStudentSelfOrPermission, requirePermission } from "../../rbac/middleware.js";
import { resolveEntitlement } from "../../entitlements/resolver.js";
import { grantOverride, revokeEntitlement, suspendEntitlement } from "../../entitlements/grant.js";
import { FEATURE_KEYS } from "../../entitlements/features.js";

async function buildAccessView(studentId: string) {
  const entitlements = await db.entitlement.findMany({ where: { studentId }, include: { product: true }, orderBy: { createdAt: "desc" } });
  const withStatus = await Promise.all(
    entitlements.map(async (e) => {
      const resolved = await resolveEntitlement({ studentId, businessId: e.businessId ?? undefined, featureKey: e.featureKey });
      return { ...e, resolvedDecision: resolved.decision, usage: resolved.usage };
    }),
  );
  const purchases = await db.purchase.findMany({ where: { studentId }, include: { product: true }, orderBy: { createdAt: "desc" } });
  const subscriptions = await db.subscription.findMany({ where: { studentId }, include: { product: true }, orderBy: { createdAt: "desc" } });
  return { entitlements: withStatus, purchases, subscriptions };
}

export async function accessRoutes(app: FastifyInstance) {
  app.get("/api/students/:studentId/my-access", { preHandler: [requireAuth, requireStudentSelfOrPermission("Product Catalog", "VIEW")] }, async (request, reply) => {
    const { studentId } = request.params as { studentId: string };
    return reply.send(await buildAccessView(studentId));
  });

  // A Student can check a single feature's live decision — e.g. to render
  // an upgrade CTA before attempting the action (spec sections 38-39).
  app.get("/api/students/:studentId/my-access/:featureKey", { preHandler: [requireAuth, requireStudentSelfOrPermission("Product Catalog", "VIEW")] }, async (request, reply) => {
    const { studentId, featureKey } = request.params as { studentId: string; featureKey: string };
    const { businessId } = request.query as { businessId?: string };
    const result = await resolveEntitlement({ studentId, businessId, featureKey });
    return reply.send(result);
  });

  app.get("/api/admin/students/:studentId/access", { preHandler: [requireAuth, requirePermission("Product Catalog", "VIEW")] }, async (request, reply) => {
    const { studentId } = request.params as { studentId: string };
    const student = await db.student.findUnique({ where: { id: studentId } });
    if (!student) return reply.code(404).send({ error: "Student not found." });
    return reply.send(await buildAccessView(studentId));
  });

  const overrideSchema = z.object({
    studentId: z.string().min(1),
    businessId: z.string().optional(),
    featureKey: z.enum(FEATURE_KEYS),
    reason: z.string().min(1),
    endDate: z.string().datetime().optional(),
    usageLimit: z.number().int().positive().optional(),
    usagePeriod: z.enum(["NEVER", "DAILY", "WEEKLY", "MONTHLY", "BILLING_CYCLE", "CUSTOM"]).optional(),
  });

  app.post("/api/admin/entitlements/grant", { preHandler: [requireAuth, requirePermission("Product Catalog", "CREATE")] }, async (request, reply) => {
    const parsed = overrideSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid request.", details: parsed.error.flatten() });
    const student = await db.student.findUnique({ where: { id: parsed.data.studentId } });
    if (!student) return reply.code(404).send({ error: "Student not found." });

    const entitlement = await grantOverride({
      studentId: parsed.data.studentId,
      businessId: parsed.data.businessId,
      featureKey: parsed.data.featureKey,
      reason: parsed.data.reason,
      endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : undefined,
      usageLimit: parsed.data.usageLimit,
      usagePeriod: parsed.data.usagePeriod,
      createdById: request.authContext!.userId,
    });
    return reply.code(201).send({ entitlement });
  });

  const revokeSchema = z.object({ reason: z.string().min(1) });

  app.post("/api/admin/entitlements/:id/revoke", { preHandler: [requireAuth, requirePermission("Product Catalog", "EDIT")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await db.entitlement.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ error: "Entitlement not found." });
    const parsed = revokeSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "A reason is required to revoke access." });
    const entitlement = await revokeEntitlement(id, parsed.data.reason, request.authContext!.userId);
    return reply.send({ entitlement });
  });

  app.post("/api/admin/entitlements/:id/suspend", { preHandler: [requireAuth, requirePermission("Product Catalog", "EDIT")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await db.entitlement.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ error: "Entitlement not found." });
    const parsed = revokeSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "A reason is required to suspend access." });
    const entitlement = await suspendEntitlement(id, parsed.data.reason, request.authContext!.userId);
    return reply.send({ entitlement });
  });

  // Access Health Dashboard (spec sections 52, 137) — real counts only.
  app.get("/api/admin/entitlements/access-health", { preHandler: [requireAuth, requirePermission("Product Catalog", "VIEW")] }, async (_request, reply) => {
    const now = new Date();
    const soon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const [active, expiringSoon, expired, suspended, overrides, subscriptionsPastDue] = await Promise.all([
      db.entitlement.count({ where: { status: "ACTIVE" } }),
      db.entitlement.count({ where: { status: "ACTIVE", endDate: { gte: now, lte: soon } } }),
      db.entitlement.count({ where: { status: "ACTIVE", endDate: { lt: now } } }),
      db.entitlement.count({ where: { status: "SUSPENDED" } }),
      db.entitlement.count({ where: { source: "ADMIN_GRANT" } }),
      db.subscription.count({ where: { status: "PAST_DUE" } }),
    ]);
    return reply.send({ active, expiringSoon, expired, suspended, overrides, subscriptionsPastDue, generatedAt: now.toISOString() });
  });
}

