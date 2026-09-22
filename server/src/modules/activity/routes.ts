import type { FastifyInstance } from "fastify";
import { db } from "../../db.js";
import { requireAuth, requirePermission, requireStudentSelf } from "../../rbac/middleware.js";

// Reads durable ActivityLog rows only — never fabricates history (spec
// section 33). ActivityLog.entityId is the ID of whatever the action was
// about (a Payment, a Requirement, an Enrollment, the Student itself), not
// always the Student's own ID, so a full student history has to gather
// every entity ID that belongs to this student first, then match on those
// in addition to direct actorStudentId/Student-entity rows.
export async function activityRoutes(app: FastifyInstance) {
  app.get(
    "/api/students/:studentId/activity",
    { preHandler: [requireAuth, requireStudentSelfOrPermission("Students", "VIEW")] },
    async (request, reply) => {
      const { studentId } = request.params as { studentId: string };
      const student = await db.student.findUnique({ where: { id: studentId } });
      if (!student) return reply.code(404).send({ error: "Student not found." });

      const [enrollments, payments, requirements] = await Promise.all([
        db.enrollment.findMany({ where: { studentId }, select: { id: true } }),
        db.paymentTransaction.findMany({ where: { studentId }, select: { id: true } }),
        db.requirement.findMany({ where: { studentId }, select: { id: true } }),
      ]);

      const activity = await db.activityLog.findMany({
        where: {
          OR: [
            { actorStudentId: studentId },
            { entityType: "Student", entityId: studentId },
            { entityType: "Enrollment", entityId: { in: enrollments.map((e) => e.id) } },
            { entityType: "PaymentTransaction", entityId: { in: payments.map((p) => p.id) } },
            { entityType: "Requirement", entityId: { in: requirements.map((r) => r.id) } },
          ],
        },
        orderBy: { occurredAt: "desc" },
      });

      return reply.send({ activity });
    },
  );
}

/** Allows either the owning student, or staff holding the given permission. */
function requireStudentSelfOrPermission(module: Parameters<typeof requirePermission>[0], action: Parameters<typeof requirePermission>[1]) {
  const selfCheck = requireStudentSelf("studentId");
  const permCheck = requirePermission(module, action);
  return async (request: Parameters<typeof selfCheck>[0], reply: Parameters<typeof selfCheck>[1]) => {
    if (request.authContext?.kind === "student") return selfCheck(request, reply);
    return permCheck(request, reply);
  };
}
