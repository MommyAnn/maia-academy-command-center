// Data Migration Framework routes (spec sections 5-21). Owner/Administrator
// only by default (the "Data Migration" permission module) — this is the
// highest-risk admin surface in the whole backend, especially for PAYMENTS.
//
// Upload accepts CSV content as a JSON string field rather than a
// multipart file (no multipart-upload plugin is installed in this phase) —
// a real, disclosed scoping decision, not a shortcut around validation.

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../../db.js";
import { requireAuth, requirePermission } from "../../rbac/middleware.js";
import { writeAuditLog } from "../../audit/log.js";
import { IMPORT_TYPES, stageBatch, validateBatch, runDryRun, approveBatch, executeImport, rollbackBatch } from "./engine.js";

const uploadSchema = z.object({
  importType: z.enum(IMPORT_TYPES),
  sourceFileName: z.string().min(1),
  csvContent: z.string().min(1),
});

export async function migrationRoutes(app: FastifyInstance, opts: { uploadRateLimitPerMinute?: number } = {}) {
  const uploadRateLimitPerMinute = opts.uploadRateLimitPerMinute ?? 10;

  app.get("/api/migrations", { preHandler: [requireAuth, requirePermission("Data Migration", "VIEW")] }, async (request, reply) => {
    const { importType, status } = request.query as { importType?: string; status?: string };
    const batches = await db.importBatch.findMany({ where: { importType: importType || undefined, status: status || undefined }, orderBy: { uploadedAt: "desc" } });
    return reply.send({ batches });
  });

  app.post(
    "/api/migrations",
    { preHandler: [requireAuth, requirePermission("Data Migration", "CREATE")], config: { rateLimit: { max: uploadRateLimitPerMinute, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const parsed = uploadSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: "Invalid upload.", details: parsed.error.flatten() });

      let batch;
      try {
        batch = await stageBatch({ ...parsed.data, uploadedById: request.authContext!.userId });
      } catch (err) {
        return reply.code(422).send({ error: err instanceof Error ? err.message : "Failed to parse upload." });
      }
      await writeAuditLog({ action: "Migration Batch Uploaded", summary: `Import batch uploaded: ${parsed.data.importType} (${batch.recordCount} rows) from "${parsed.data.sourceFileName}"`, actorUserId: request.authContext!.userId, entityType: "ImportBatch", entityId: batch.id });
      return reply.code(201).send({ batch });
    },
  );

  app.get("/api/migrations/:id", { preHandler: [requireAuth, requirePermission("Data Migration", "VIEW")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const batch = await db.importBatch.findUnique({ where: { id } });
    if (!batch) return reply.code(404).send({ error: "Import batch not found." });
    return reply.send({ batch });
  });

  app.get("/api/migrations/:id/records", { preHandler: [requireAuth, requirePermission("Data Migration", "VIEW")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { status } = request.query as { status?: string };
    const records = await db.importRecord.findMany({ where: { batchId: id, status: status || undefined }, orderBy: { rowNumber: "asc" }, take: 500 });
    return reply.send({ records });
  });

  app.post("/api/migrations/:id/validate", { preHandler: [requireAuth, requirePermission("Data Migration", "EDIT")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const batch = await db.importBatch.update({ where: { id }, data: { status: "VALIDATING" } }).catch(() => null);
    if (!batch) return reply.code(404).send({ error: "Import batch not found." });

    const validated = await validateBatch(id);
    await writeAuditLog({ action: "Migration Batch Validated", summary: `Import batch ${id} validated: ${validated.validCount} valid, ${validated.invalidCount} invalid, ${validated.duplicateCount} flagged as possible/high-confidence duplicates`, actorUserId: request.authContext!.userId, entityType: "ImportBatch", entityId: id });
    return reply.send({ batch: validated });
  });

  app.post("/api/migrations/:id/dry-run", { preHandler: [requireAuth, requirePermission("Data Migration", "EDIT")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const batch = await db.importBatch.findUnique({ where: { id } });
    if (!batch) return reply.code(404).send({ error: "Import batch not found." });
    if (batch.status !== "READY_FOR_DRY_RUN" && batch.status !== "NEEDS_REVIEW") {
      return reply.code(409).send({ error: `Cannot run a dry run from status ${batch.status} — validate the batch first.` });
    }

    const result = await runDryRun(id);
    await writeAuditLog({ action: "Migration Dry Run Completed", summary: `Dry run completed for import batch ${id} — no live data was written`, actorUserId: request.authContext!.userId, entityType: "ImportBatch", entityId: id });
    return reply.send({ batch: result });
  });

  app.post("/api/migrations/:id/approve", { preHandler: [requireAuth, requirePermission("Data Migration", "VERIFY")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const batch = await approveBatch(id, request.authContext!.userId);
      await writeAuditLog({ action: "Migration Batch Approved", summary: `Import batch ${id} approved for import`, actorUserId: request.authContext!.userId, entityType: "ImportBatch", entityId: id });
      return reply.send({ batch });
    } catch (err) {
      return reply.code(409).send({ error: err instanceof Error ? err.message : "Cannot approve this batch." });
    }
  });

  app.post("/api/migrations/:id/import", { preHandler: [requireAuth, requirePermission("Data Migration", "VERIFY")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const batch = await executeImport(id, request.authContext!.userId);
      return reply.send({ batch });
    } catch (err) {
      return reply.code(409).send({ error: err instanceof Error ? err.message : "Cannot import this batch." });
    }
  });

  app.post("/api/migrations/:id/rollback", { preHandler: [requireAuth, requirePermission("Data Migration", "VERIFY")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const result = await rollbackBatch(id, request.authContext!.userId);
      return reply.send(result);
    } catch (err) {
      return reply.code(409).send({ error: err instanceof Error ? err.message : "Cannot roll back this batch." });
    }
  });

  // Migration report (spec sections 7, 17) — the batch's own counters plus,
  // for PAYMENTS, a real financial reconciliation computed live from the
  // PaymentTransaction rows this batch actually created.
  app.get("/api/migrations/:id/report", { preHandler: [requireAuth, requirePermission("Data Migration", "VIEW")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const batch = await db.importBatch.findUnique({ where: { id } });
    if (!batch) return reply.code(404).send({ error: "Import batch not found." });

    let financeReconciliation: Record<string, unknown> | null = null;
    if (batch.importType === "PAYMENTS") {
      const imported = await db.paymentTransaction.aggregate({ where: { importBatchId: id }, _sum: { amount: true }, _count: true });
      const sourceRecords = await db.importRecord.findMany({ where: { batchId: id } });
      const sourceTotal = sourceRecords.reduce((sum, r) => sum + Number((r.normalizedDataJson as { amount?: number } | null)?.amount ?? 0), 0);
      const importedTotal = Number(imported._sum.amount ?? 0);
      financeReconciliation = {
        sourceTotal,
        importedTotal,
        recordCount: imported._count,
        difference: sourceTotal - importedTotal,
        allImportedAreUnverified: true,
      };
    }

    return reply.send({ batch, financeReconciliation });
  });
}
