import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../../db.js";
import { requireAuth, requirePermission } from "../../rbac/middleware.js";

const rangeSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

// Every figure here is computed live from the database on each request —
// none of it is cached, hard-coded, or accepted as a frontend-supplied
// number (spec section 34: dashboard KPIs must be real, never hard-coded).
export async function dashboardRoutes(app: FastifyInstance) {
  app.get(
    "/api/dashboard/summary",
    { preHandler: [requireAuth, requirePermission("Dashboard", "VIEW")] },
    async (request, reply) => {
      const parsed = rangeSchema.safeParse(request.query);
      if (!parsed.success) return reply.code(400).send({ error: "Invalid date range." });
      const from = parsed.data.from ? new Date(parsed.data.from) : undefined;
      const to = parsed.data.to ? new Date(parsed.data.to) : undefined;
      const enrollmentDateFilter = from || to ? { createdAt: { gte: from, lte: to } } : {};
      const paymentDateFilter = from || to ? { paymentDate: { gte: from, lte: to } } : {};

      const [totalStudents, newEnrollments, verifiedInRange, pendingCount, enrollments, students, verifiedByStudent] = await Promise.all([
        db.student.count(),
        db.enrollment.count({ where: enrollmentDateFilter }),
        db.paymentTransaction.aggregate({ where: { status: "VERIFIED", studentId: { not: null }, ...paymentDateFilter }, _sum: { amount: true } }),
        db.paymentTransaction.count({ where: { status: "PENDING_VERIFICATION", studentId: { not: null } } }),
        db.enrollment.findMany({ select: { studentId: true, netAmountDue: true }, orderBy: { createdAt: "desc" } }),
        db.student.findMany({ select: { id: true, package: { select: { defaultPrice: true } } } }),
        db.paymentTransaction.groupBy({ by: ["studentId"], where: { status: "VERIFIED", studentId: { not: null } }, _sum: { amount: true } }),
      ]);

      // Latest enrollment per student wins (price-snapshot semantics, spec
      // section 8) — `enrollments` is already ordered newest-first, so the
      // first occurrence per studentId is authoritative; students with no
      // Enrollment row yet (Phase-1-only seed data) fall back to their
      // Package's current default price.
      const netAmountDueByStudent = new Map<string, number>();
      for (const e of enrollments) {
        if (e.studentId && !netAmountDueByStudent.has(e.studentId)) netAmountDueByStudent.set(e.studentId, Number(e.netAmountDue));
      }
      for (const s of students) {
        if (!netAmountDueByStudent.has(s.id)) netAmountDueByStudent.set(s.id, Number(s.package.defaultPrice ?? 0));
      }

      const verifiedPaidByStudent = new Map<string, number>();
      for (const v of verifiedByStudent) {
        if (v.studentId) verifiedPaidByStudent.set(v.studentId, Number(v._sum.amount ?? 0));
      }

      let receivables = 0;
      let fullyPaidStudents = 0;
      let studentsWithBalance = 0;
      for (const s of students) {
        const netAmountDue = netAmountDueByStudent.get(s.id) ?? 0;
        const verifiedPaid = verifiedPaidByStudent.get(s.id) ?? 0;
        const balance = Math.max(netAmountDue - verifiedPaid, 0);
        receivables += balance;
        if (balance <= 0 && netAmountDue > 0) fullyPaidStudents += 1;
        if (balance > 0) studentsWithBalance += 1;
      }

      return reply.send({
        summary: {
          totalStudents,
          newEnrollments,
          verifiedCollections: Number(verifiedInRange._sum.amount ?? 0),
          receivables,
          pendingPaymentVerification: pendingCount,
          fullyPaidStudents,
          studentsWithBalance,
        },
      });
    },
  );
}
