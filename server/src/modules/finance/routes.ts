import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../../db.js";
import { requireAuth, requirePermission, requireStudentSelf } from "../../rbac/middleware.js";
import { writeAuditLog } from "../../audit/log.js";
import { computeStudentFinanceSummary, resolveNetAmountDue } from "./calc.js";
import { generatePaymentDisplayId } from "../sequence.js";
import { recordDomainEvent } from "../events.js";

const submitPaymentSchema = z.object({
  amount: z.number().positive(),
  method: z.string().min(1),
  type: z.string().min(1),
  referenceNumber: z.string().optional(),
  proofDocumentId: z.string().optional(),
});

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

      const batch = await db.batch.findUniqueOrThrow({ where: { id: student.batchId } });
      // Concurrency-safe (spec section 29) — an atomic counter, not
      // "count existing rows + 1", which two simultaneous submissions could
      // both read before either had written, producing a duplicate ID.
      const payment = await db.paymentTransaction.create({
        data: {
          paymentDisplayId: await generatePaymentDisplayId(batch.code),
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

      // Fully-paid detection reads the state BEFORE this write, so the
      // STUDENT_FULLY_PAID event only fires on the verification that
      // actually crosses the threshold, never on every later verification
      // of an already-fully-paid student.
      const wasFullyPaidBefore = payment.studentId ? (await computeStudentFinanceSummary(payment.studentId, await resolveNetAmountDue(payment.studentId))).status === "Fully Paid" : false;

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

      if (payment.studentId && !wasFullyPaidBefore) {
        const summaryAfter = await computeStudentFinanceSummary(payment.studentId, await resolveNetAmountDue(payment.studentId));
        if (summaryAfter.status === "Fully Paid") {
          // Internal event only (spec section 37) — no GHL message, no
          // external workflow triggered anywhere in this codebase.
          await recordDomainEvent("STUDENT_FULLY_PAID", { studentId: payment.studentId, verifiedPaid: summaryAfter.verifiedPaid, netAmountDue: summaryAfter.netAmountDue });
        }
      }

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

  // Voids a previously recorded payment (data-entry correction, bounced
  // reversal, etc.) — a VOIDED payment counts toward neither verifiedPaid
  // nor pending (spec's payment status set: PENDING VERIFICATION / VERIFIED
  // / REJECTED-NEEDS-RESUBMISSION / VOIDED, mapped here onto the existing
  // CANCELLED enum value per "use existing project naming if equivalent
  // statuses already exist").
  app.post(
    "/api/payments/:paymentId/void",
    { preHandler: [requireAuth, requirePermission("Finance - Payments", "VERIFY")] },
    async (request, reply) => {
      const { paymentId } = request.params as { paymentId: string };
      const payment = await db.paymentTransaction.findUnique({ where: { id: paymentId } });
      if (!payment) return reply.code(404).send({ error: "Payment not found." });
      if (payment.status === "CANCELLED") return reply.code(409).send({ error: "This payment is already voided." });

      const updated = await db.paymentTransaction.update({ where: { id: paymentId }, data: { status: "CANCELLED" } });

      await writeAuditLog({
        action: "Payment Voided",
        summary: `Payment ${payment.paymentDisplayId} voided`,
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
      const student = await db.student.findUnique({ where: { id: studentId } });
      if (!student) return reply.code(404).send({ error: "Student not found." });

      const netAmountDue = await resolveNetAmountDue(studentId);
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
