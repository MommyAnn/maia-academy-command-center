import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../../db.js";
import { requireAuth, requirePermission, requireStudentSelf } from "../../rbac/middleware.js";
import { writeAuditLog } from "../../audit/log.js";
import { computeStudentFinanceSummary } from "./calc.js";

const submitPaymentSchema = z.object({
  amount: z.number().positive(),
  method: z.string().min(1),
  type: z.string().min(1),
  referenceNumber: z.string().optional(),
  proofDocumentId: z.string().optional(),
});

function generatePaymentDisplayId(batchCode: string, seq: number): string {
  return `PAY-B${batchCode}-${String(seq).padStart(6, "0")}`;
}

export async function financeRoutes(app: FastifyInstance) {
  // Student self-service: submit a payment. Always lands as
  // PENDING_VERIFICATION — a student can never mark their own payment
  // Verified (spec section 24's "do not manually overwrite derived totals"
  // extends to: a student can never set status at all).
  app.post(
    "/api/students/:studentId/payments",
    { preHandler: [requireAuth, requireStudentSelf("studentId")] },
    async (request, reply) => {
      const parsed = submitPaymentSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: "Invalid payment submission.", details: parsed.error.flatten() });

      const { studentId } = request.params as { studentId: string };
      const student = await db.student.findUnique({ where: { id: studentId } });
      if (!student) return reply.code(404).send({ error: "Student not found." });

      const count = await db.paymentTransaction.count({ where: { batchId: student.batchId } });
      const payment = await db.paymentTransaction.create({
        data: {
          paymentDisplayId: generatePaymentDisplayId((await db.batch.findUniqueOrThrow({ where: { id: student.batchId } })).code, count + 1),
          studentId,
          batchId: student.batchId,
          packageId: student.packageId,
          paymentDate: new Date(),
          type: parsed.data.type,
          amount: parsed.data.amount,
          method: parsed.data.method,
          referenceNumber: parsed.data.referenceNumber ?? null,
          proofDocumentId: parsed.data.proofDocumentId ?? null,
          status: "PENDING_VERIFICATION",
          recordedById: request.authContext!.userId,
        },
      });

      await writeAuditLog({
        action: "Payment Submitted",
        summary: `Payment ${payment.paymentDisplayId} submitted, pending verification`,
        actorStudentId: studentId,
        entityType: "PaymentTransaction",
        entityId: payment.id,
      });

      return reply.code(201).send({ payment: serializePayment(payment) });
    },
  );

  // Staff verification — server-side enforced permission, exactly the kind
  // of check that only ever existed as a UI button before Phase 1.
  app.post(
    "/api/payments/:paymentId/verify",
    { preHandler: [requireAuth, requirePermission("Finance - Payments", "VERIFY")] },
    async (request, reply) => {
      const { paymentId } = request.params as { paymentId: string };
      const payment = await db.paymentTransaction.findUnique({ where: { id: paymentId } });
      if (!payment) return reply.code(404).send({ error: "Payment not found." });
      if (payment.status !== "PENDING_VERIFICATION") {
        return reply.code(409).send({ error: `Cannot verify a payment with status ${payment.status}.` });
      }

      const updated = await db.paymentTransaction.update({
        where: { id: paymentId },
        data: { status: "VERIFIED", verifiedById: request.authContext!.userId, verifiedAt: new Date() },
      });

      await writeAuditLog({
        action: "Payment Verified",
        summary: `Payment ${payment.paymentDisplayId} verified`,
        actorUserId: request.authContext!.userId,
        entityType: "PaymentTransaction",
        entityId: payment.id,
      });

      return reply.send({ payment: serializePayment(updated) });
    },
  );

  app.post(
    "/api/payments/:paymentId/reject",
    { preHandler: [requireAuth, requirePermission("Finance - Payments", "VERIFY")] },
    async (request, reply) => {
      const { paymentId } = request.params as { paymentId: string };
      const body = z.object({ reason: z.string().min(1) }).safeParse(request.body);
      if (!body.success) return reply.code(400).send({ error: "A rejection reason is required." });

      const payment = await db.paymentTransaction.findUnique({ where: { id: paymentId } });
      if (!payment) return reply.code(404).send({ error: "Payment not found." });
      if (payment.status !== "PENDING_VERIFICATION") {
        return reply.code(409).send({ error: `Cannot reject a payment with status ${payment.status}.` });
      }

      const updated = await db.paymentTransaction.update({
        where: { id: paymentId },
        data: { status: "REJECTED", rejectedReason: body.data.reason },
      });

      await writeAuditLog({
        action: "Payment Rejected",
        summary: `Payment ${payment.paymentDisplayId} rejected: ${body.data.reason}`,
        actorUserId: request.authContext!.userId,
        entityType: "PaymentTransaction",
        entityId: payment.id,
      });

      return reply.send({ payment: serializePayment(updated) });
    },
  );

  // Isolation-enforced read: a student can only ever see their own ledger.
  app.get(
    "/api/students/:studentId/finance-summary",
    { preHandler: [requireAuth, requireStudentSelfOrPermission("Finance - Payments", "VIEW")] },
    async (request, reply) => {
      const { studentId } = request.params as { studentId: string };
      const student = await db.student.findUnique({ where: { id: studentId }, include: { package: true } });
      if (!student) return reply.code(404).send({ error: "Student not found." });

      const netAmountDue = Number(student.package.defaultPrice ?? 0);
      const summary = await computeStudentFinanceSummary(studentId, netAmountDue);
      return reply.send({ summary });
    },
  );

  app.get(
    "/api/students/:studentId/payments",
    { preHandler: [requireAuth, requireStudentSelfOrPermission("Finance - Payments", "VIEW")] },
    async (request, reply) => {
      const { studentId } = request.params as { studentId: string };
      const payments = await db.paymentTransaction.findMany({ where: { studentId }, orderBy: { createdAt: "desc" } });
      return reply.send({ payments: payments.map(serializePayment) });
    },
  );
}

/** Allows either the owning student, or staff holding the given permission — the common shape for finance/document read endpoints. */
function requireStudentSelfOrPermission(module: Parameters<typeof requirePermission>[0], action: Parameters<typeof requirePermission>[1]) {
  const selfCheck = requireStudentSelf("studentId");
  const permCheck = requirePermission(module, action);
  return async (request: Parameters<typeof selfCheck>[0], reply: Parameters<typeof selfCheck>[1]) => {
    if (request.authContext?.kind === "student") return selfCheck(request, reply);
    return permCheck(request, reply);
  };
}

function serializePayment(p: Awaited<ReturnType<typeof db.paymentTransaction.findFirstOrThrow>>) {
  return { ...p, amount: Number(p.amount) };
}
