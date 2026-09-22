import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../../db.js";
import { requireAuth, requirePermission, requireStudentSelfOrPermission } from "../../rbac/middleware.js";

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  eligibility: z.string().optional(),
  sourceTypeFilter: z.string().optional(),
  deliveryType: z.string().min(1),
  bonusCourseId: z.string().optional(),
  resourceDocumentId: z.string().optional(),
});

const updateSchema = createSchema.partial().extend({ status: z.enum(["Active", "Inactive"]).optional() });

export async function incentiveRoutes(app: FastifyInstance) {
  app.get("/api/incentives", { preHandler: [requireAuth, requirePermission("Feedback", "VIEW")] }, async (_request, reply) => {
    const incentives = await db.incentive.findMany({ orderBy: { createdAt: "desc" } });
    return reply.send({ incentives });
  });

  app.post("/api/incentives", { preHandler: [requireAuth, requirePermission("Feedback", "CREATE")] }, async (request, reply) => {
    const parsed = createSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid incentive.", details: parsed.error.flatten() });
    const created = await db.incentive.create({ data: parsed.data });
    return reply.code(201).send({ incentive: created });
  });

  app.patch("/api/incentives/:incentiveId", { preHandler: [requireAuth, requirePermission("Feedback", "EDIT")] }, async (request, reply) => {
    const { incentiveId } = request.params as { incentiveId: string };
    const parsed = updateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid update.", details: parsed.error.flatten() });
    const updated = await db.incentive.update({ where: { id: incentiveId }, data: parsed.data }).catch(() => null);
    if (!updated) return reply.code(404).send({ error: "Incentive not found." });
    return reply.send({ incentive: updated });
  });

  app.get(
    "/api/students/:studentId/incentive-redemptions",
    { preHandler: [requireAuth, requireStudentSelfOrPermission("Feedback", "VIEW")] },
    async (request, reply) => {
      const { studentId } = request.params as { studentId: string };
      const redemptions = await db.incentiveRedemption.findMany({ where: { studentId }, include: { incentive: true }, orderBy: { createdAt: "desc" } });
      return reply.send({ redemptions });
    },
  );
}
