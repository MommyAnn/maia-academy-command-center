// Legacy Package -> Product migration (spec sections 96-100) + Entitlement
// Reconciliation (spec sections 134-137). Every route here is either a
// pure read-only report, or a deliberately single-student, explicitly
// confirmed action — never a bulk apply, and never automatic (spec
// section 100: "No mass access migration without approval").

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../../db.js";
import { requireAuth, requirePermission } from "../../rbac/middleware.js";
import { writeAuditLog } from "../../audit/log.js";
import { expandProductFeatures, grantProductEntitlements } from "../../entitlements/grant.js";

export async function migrationRoutes(app: FastifyInstance) {
  // Migration Dry Run (spec section 99) — read-only. Shows, per Student,
  // their current real Entitlement rows next to what the (still
  // UNCONFIRMED) PackageMapping would propose, and flags conflicts. Never
  // changes a single row.
  app.get("/api/admin/entitlements/migration-dry-run", { preHandler: [requireAuth, requirePermission("Product Catalog", "VIEW")] }, async (_request, reply) => {
    const mappings = await db.packageMapping.findMany({ include: { legacyPackage: true, mappedProduct: true } });
    const students = await db.student.findMany({ include: { package: true } });

    const rows = await Promise.all(
      students.map(async (student) => {
        const mapping = mappings.find((m) => m.legacyPackageId === student.packageId);
        if (!mapping) return { studentId: student.id, studentDisplayId: student.studentDisplayId, currentPackage: student.package.name, status: "MISSING_PACKAGE_MAPPING" as const };

        const [currentEntitlements, proposedFeatures] = await Promise.all([db.entitlement.findMany({ where: { studentId: student.id, status: "ACTIVE" } }), expandProductFeatures(mapping.mappedProductId)]);
        const currentKeys = new Set(currentEntitlements.map((e) => e.featureKey));
        const proposedKeys = new Set(proposedFeatures.map((f) => f.featureKey));
        const potentialAccessLoss = [...currentKeys].filter((k) => !proposedKeys.has(k));
        const potentialExtraAccess = [...proposedKeys].filter((k) => !currentKeys.has(k));

        return {
          studentId: student.id,
          studentDisplayId: student.studentDisplayId,
          currentPackage: student.package.name,
          proposedProduct: mapping.mappedProduct.name,
          mappingConfirmed: mapping.confirmed,
          currentEntitlementFeatureKeys: [...currentKeys],
          proposedFeatureKeys: [...proposedKeys],
          potentialAccessLoss,
          potentialExtraAccess,
          conflict: potentialAccessLoss.length > 0,
        };
      }),
    );

    return reply.send({ studentsScanned: students.length, rows });
  });

  // Confirming a mapping only endorses it as the default for FUTURE use —
  // it never touches any existing Student's real access (spec section
  // 100). Applying it to a specific Student is a separate, explicit action.
  app.post("/api/admin/package-mappings/:id/confirm", { preHandler: [requireAuth, requirePermission("Product Catalog", "VERIFY")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const mapping = await db.packageMapping.findUnique({ where: { id } });
    if (!mapping) return reply.code(404).send({ error: "Package mapping not found." });
    const ctx = request.authContext!;
    const updated = await db.packageMapping.update({ where: { id }, data: { confirmed: true, confirmedById: ctx.userId, confirmedAt: new Date() } });
    await writeAuditLog({ action: "Package Mapping Confirmed", summary: `Package mapping ${id} confirmed`, actorUserId: ctx.userId, entityType: "PackageMapping", entityId: id });
    return reply.send({ mapping: updated });
  });

  const applySchema = z.object({ studentId: z.string().min(1), confirm: z.literal(true) });

  // Applies a CONFIRMED mapping to exactly one real Student, on explicit
  // Admin request — never automatic, never bulk (spec section 100).
  app.post("/api/admin/package-mappings/:id/apply-to-student", { preHandler: [requireAuth, requirePermission("Product Catalog", "EDIT")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const mapping = await db.packageMapping.findUnique({ where: { id }, include: { mappedProduct: true } });
    if (!mapping) return reply.code(404).send({ error: "Package mapping not found." });
    if (!mapping.confirmed) return reply.code(409).send({ error: "This mapping has not been confirmed yet — confirm it first." });

    const parsed = applySchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Must explicitly confirm applying this mapping to this exact student." });
    const student = await db.student.findUnique({ where: { id: parsed.data.studentId } });
    if (!student) return reply.code(404).send({ error: "Student not found." });
    if (student.packageId !== mapping.legacyPackageId) return reply.code(400).send({ error: "This student's current package does not match this mapping's legacy package." });

    const ctx = request.authContext!;
    const entitlements = await grantProductEntitlements({ studentId: student.id, product: mapping.mappedProduct, source: "LEGACY", sourceRecordId: mapping.id, createdById: ctx.userId });
    return reply.send({ entitlements });
  });

  // Access Health / Reconciliation (spec sections 134-137) — read-only.
  // Flags real conflicts for human review; never auto-resolves anything
  // (spec section 136).
  app.get("/api/admin/entitlements/reconciliation", { preHandler: [requireAuth, requirePermission("Product Catalog", "VIEW")] }, async (request, reply) => {
    const results: { category: string; detail: string; entityType: string; entityId: string }[] = [];

    const activatedPurchases = await db.purchase.findMany({ where: { activatedAt: { not: null } }, include: { product: true } });
    for (const purchase of activatedPurchases) {
      const count = await db.entitlement.count({ where: { studentId: purchase.studentId, sourceRecordId: purchase.id } });
      if (count === 0) results.push({ category: "MISSING_ACCESS", detail: `Purchase ${purchase.purchaseDisplayId} was activated but has no linked Entitlement rows.`, entityType: "Purchase", entityId: purchase.id });
    }

    const inactiveSubscriptions = await db.subscription.findMany({ where: { status: { in: ["CANCELLED", "EXPIRED"] } } });
    for (const sub of inactiveSubscriptions) {
      const activeCount = await db.entitlement.count({ where: { studentId: sub.studentId, sourceRecordId: sub.id, status: "ACTIVE" } });
      if (activeCount > 0) results.push({ category: "EXPIRED_BUT_ACTIVE", detail: `Subscription ${sub.subscriptionDisplayId} is ${sub.status} but ${activeCount} linked Entitlement row(s) are still ACTIVE.`, entityType: "Subscription", entityId: sub.id });
    }

    const orphanEntitlements = await db.entitlement.findMany({ where: { status: "ACTIVE", source: { in: ["PACKAGE", "SUBSCRIPTION"] }, sourceRecordId: { not: null } } });
    for (const e of orphanEntitlements) {
      const found = e.source === "PACKAGE" ? await db.purchase.findUnique({ where: { id: e.sourceRecordId! } }) : await db.subscription.findUnique({ where: { id: e.sourceRecordId! } });
      if (!found) results.push({ category: "SOURCE_UNKNOWN", detail: `Entitlement ${e.entitlementDisplayId} references a ${e.source} record that no longer exists.`, entityType: "Entitlement", entityId: e.id });
    }

    await writeAuditLog({ action: "Entitlement Reconciliation Run", summary: `Reconciliation run — ${results.length} item(s) flagged for review`, actorUserId: request.authContext!.userId });
    return reply.send({ generatedAt: new Date().toISOString(), flaggedCount: results.length, results });
  });
}
