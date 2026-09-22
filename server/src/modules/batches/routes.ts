import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../../db.js";
import { requireAuth, requirePermission } from "../../rbac/middleware.js";
import { writeAuditLog } from "../../audit/log.js";

const BATCH_STATUSES = ["UPCOMING", "OPEN", "ACTIVE", "COMPLETED", "ARCHIVED"] as const;

const createSchema = z.object({
  code: z.string().min(1),
  label: z.string().min(1),
  program: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  enrollmentPeriodStart: z.string().datetime().optional(),
  enrollmentPeriodEnd: z.string().datetime().optional(),
  trainingScheduleNotes: z.string().optional(),
  capacity: z.number().int().positive().optional(),
  notes: z.string().optional(),
});

const updateSchema = z.object({
  label: z.string().optional(),
  program: z.string().optional(),
  status: z.enum(BATCH_STATUSES).optional(),
  endDate: z.string().datetime().optional(),
  capacity: z.number().int().positive().optional(),
  notes: z.string().optional(),
});

export async function batchRoutes(app: FastifyInstance) {
  app.get("/api/batches", { preHandler: [requireAuth] }, async (_request, reply) => {
    const batches = await db.batch.findMany({ orderBy: { createdAt: "desc" } });
    return reply.send({ batches });
  });

  app.post("/api/batches", { preHandler: [requireAuth, requirePermission("Batches", "CREATE")] }, async (request, reply) => {
    const parsed = createSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid batch.", details: parsed.error.flatten() });

    const exists = await db.batch.findUnique({ where: { code: parsed.data.code } });
    if (exists) return reply.code(409).send({ error: `Batch code "${parsed.data.code}" already exists.` });

    const created = await db.batch.create({
      data: {
        ...parsed.data,
        startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : null,
        endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
        enrollmentPeriodStart: parsed.data.enrollmentPeriodStart ? new Date(parsed.data.enrollmentPeriodStart) : null,
        enrollmentPeriodEnd: parsed.data.enrollmentPeriodEnd ? new Date(parsed.data.enrollmentPeriodEnd) : null,
      },
    });
    await writeAuditLog({ action: "Integration Configuration Changed", summary: `Batch "${created.label}" created`, actorUserId: request.authContext!.userId, entityType: "Batch", entityId: created.id });
    return reply.code(201).send({ batch: created });
  });

  app.patch("/api/batches/:batchId", { preHandler: [requireAuth, requirePermission("Batches", "EDIT")] }, async (request, reply) => {
    const parsed = updateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid update.", details: parsed.error.flatten() });

    const { batchId } = request.params as { batchId: string };
    const existing = await db.batch.findUnique({ where: { id: batchId } });
    if (!existing) return reply.code(404).send({ error: "Batch not found." });

    const updated = await db.batch.update({
      where: { id: batchId },
      data: { ...parsed.data, endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : undefined, isActive: parsed.data.status ? ["OPEN", "ACTIVE"].includes(parsed.data.status) : undefined },
    });
    await writeAuditLog({ action: "Integration Configuration Changed", summary: `Batch "${updated.label}" updated`, actorUserId: request.authContext!.userId, entityType: "Batch", entityId: updated.id });
    return reply.send({ batch: updated });
  });
}
