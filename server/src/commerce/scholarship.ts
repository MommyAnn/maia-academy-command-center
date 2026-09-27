// M.A.I.A. Scholarship / Sponsored Access (Production Phase 17, spec
// sections 56-60). Deliberately NOT a Purchase — no payment ever occurs —
// so "how did this Student get this access" stays honest everywhere it's
// shown: My Access clearly labels it SPECIAL_ACCESS, never PAID.

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db.js";
import { requireAuth, requirePermission, requireStudentSelfOrPermission } from "../rbac/middleware.js";
import { writeAuditLog } from "../audit/log.js";
import { generateSponsoredAccessDisplayId } from "../modules/sequence.js";
import { grantProductEntitlements, revokeEntitlement } from "../entitlements/grant.js";

const STATUS_TRANSITIONS: Record<string, string[]> = {
  NOMINATED: ["UNDER_REVIEW", "REVOKED"],
  UNDER_REVIEW: ["APPROVED", "REVOKED"],
  APPROVED: ["ACTIVE", "REVOKED"],
  ACTIVE: ["COMPLETED", "REVOKED", "EXPIRED"],
  COMPLETED: [],
  REVOKED: [],
  EXPIRED: [],
};

export async function scholarshipRoutes(app: FastifyInstance) {
  const nominateSchema = z.object({
    studentId: z.string().min(1),
    productId: z.string().min(1),
    sponsorSource: z.string().min(1),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    requirementsText: z.string().optional(),
    notes: z.string().optional(),
  });

  app.post("/api/admin/sponsored-access", { preHandler: [requireAuth, requirePermission("Commerce", "CREATE")] }, async (request, reply) => {
    const parsed = nominateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid request.", details: parsed.error.flatten() });
    const [student, product] = await Promise.all([db.student.findUnique({ where: { id: parsed.data.studentId } }), db.commerceProduct.findUnique({ where: { id: parsed.data.productId } })]);
    if (!student || !product) return reply.code(404).send({ error: "Student or product not found." });

    const ctx = request.authContext!;
    const record = await db.sponsoredAccess.create({
      data: {
        sponsoredAccessDisplayId: await generateSponsoredAccessDisplayId(),
        studentId: parsed.data.studentId,
        productId: parsed.data.productId,
        sponsorSource: parsed.data.sponsorSource,
        startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : undefined,
        endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : undefined,
        requirementsText: parsed.data.requirementsText,
        notes: parsed.data.notes,
        createdById: ctx.userId,
      },
    });
    await writeAuditLog({ action: "Sponsored Access Nominated", summary: `${student.studentDisplayId} nominated for sponsored access to "${product.name}" (sponsor: ${parsed.data.sponsorSource})`, actorUserId: ctx.userId, entityType: "SponsoredAccess", entityId: record.id });
    return reply.code(201).send({ sponsoredAccess: record });
  });

  app.get("/api/admin/sponsored-access", { preHandler: [requireAuth, requirePermission("Commerce", "VIEW")] }, async (request, reply) => {
    const { status } = request.query as { status?: string };
    const records = await db.sponsoredAccess.findMany({ where: { status: status || undefined }, include: { student: true, product: true }, orderBy: { createdAt: "desc" } });
    return reply.send({ sponsoredAccesses: records });
  });

  app.get("/api/students/:studentId/sponsored-access", { preHandler: [requireAuth, requireStudentSelfOrPermission("Commerce", "VIEW")] }, async (request, reply) => {
    const { studentId } = request.params as { studentId: string };
    const records = await db.sponsoredAccess.findMany({ where: { studentId }, include: { product: true }, orderBy: { createdAt: "desc" } });
    return reply.send({ sponsoredAccesses: records });
  });

  const statusSchema = z.object({ status: z.enum(["UNDER_REVIEW", "APPROVED", "ACTIVE", "COMPLETED", "REVOKED", "EXPIRED"]), reason: z.string().optional() });

  app.post("/api/admin/sponsored-access/:id/status", { preHandler: [requireAuth, requirePermission("Commerce", "EDIT")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const record = await db.sponsoredAccess.findUnique({ where: { id }, include: { product: true } });
    if (!record) return reply.code(404).send({ error: "Sponsored access record not found." });
    const parsed = statusSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid request." });

    const allowed = STATUS_TRANSITIONS[record.status] ?? [];
    if (!allowed.includes(parsed.data.status)) return reply.code(409).send({ error: `Cannot move sponsored access from ${record.status} to ${parsed.data.status}.` });

    const ctx = request.authContext!;
    const updated = await db.sponsoredAccess.update({ where: { id }, data: { status: parsed.data.status, notes: parsed.data.reason ? `${record.notes ?? ""}\n${parsed.data.reason}`.trim() : record.notes } });

    if (parsed.data.status === "ACTIVE") {
      // Sponsored access is clearly distinct from a paid purchase (spec
      // section 60) — source SPECIAL_ACCESS, sourceRecordId the
      // SponsoredAccess row itself, never a Purchase/PACKAGE source.
      await grantProductEntitlements({ studentId: record.studentId, product: record.product, source: "SPECIAL_ACCESS", sourceRecordId: record.id, createdById: ctx.userId });
      await writeAuditLog({ action: "Sponsored Access Activated", summary: `Sponsored access ${record.sponsoredAccessDisplayId} activated — access to "${record.product.name}" granted`, actorUserId: ctx.userId, entityType: "SponsoredAccess", entityId: id });
    } else if (parsed.data.status === "APPROVED") {
      await writeAuditLog({ action: "Sponsored Access Approved", summary: `Sponsored access ${record.sponsoredAccessDisplayId} approved`, actorUserId: ctx.userId, entityType: "SponsoredAccess", entityId: id });
    } else if (parsed.data.status === "REVOKED" || parsed.data.status === "EXPIRED") {
      const entitlements = await db.entitlement.findMany({ where: { studentId: record.studentId, sourceRecordId: record.id, status: "ACTIVE" } });
      for (const e of entitlements) await revokeEntitlement(e.id, `Sponsored access ${parsed.data.status.toLowerCase()}${parsed.data.reason ? `: ${parsed.data.reason}` : ""}`, ctx.userId);
      await writeAuditLog({ action: "Sponsored Access Revoked", summary: `Sponsored access ${record.sponsoredAccessDisplayId} ${parsed.data.status.toLowerCase()}`, actorUserId: ctx.userId, entityType: "SponsoredAccess", entityId: id });
    }

    return reply.send({ sponsoredAccess: updated });
  });
}
