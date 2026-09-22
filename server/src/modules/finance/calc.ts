import { Prisma } from "@prisma/client";
import { db } from "../../db.js";

// Preserves the existing transaction-ledger principle exactly (Phase 1
// spec section 24): balance/status are ALWAYS derived from the transaction
// table, never stored or manually overwritten. This function is the single
// place that computation happens — every route reads through it.

export interface FinanceSummary {
  verifiedPaid: number;
  pending: number;
  netAmountDue: number;
  balance: number;
  status: "Unpaid" | "Partial Payment" | "Fully Paid" | "Pending Verification";
}

export async function computeStudentFinanceSummary(studentId: string, netAmountDue: number): Promise<FinanceSummary> {
  const [verifiedAgg, pendingAgg] = await Promise.all([
    db.paymentTransaction.aggregate({
      where: { studentId, status: "VERIFIED" },
      _sum: { amount: true },
    }),
    db.paymentTransaction.aggregate({
      where: { studentId, status: "PENDING_VERIFICATION" },
      _sum: { amount: true },
    }),
  ]);

  const verifiedPaid = toNumber(verifiedAgg._sum.amount);
  const pending = toNumber(pendingAgg._sum.amount);
  const balance = Math.max(netAmountDue - verifiedPaid, 0);

  let status: FinanceSummary["status"];
  if (balance <= 0) status = "Fully Paid";
  else if (pending > 0 && verifiedPaid === 0) status = "Pending Verification";
  else if (verifiedPaid > 0) status = "Partial Payment";
  else status = "Unpaid";

  return { verifiedPaid, pending, netAmountDue, balance, status };
}

function toNumber(value: Prisma.Decimal | null): number {
  return value ? Number(value) : 0;
}

/**
 * The authoritative amount due for a student: their most recent Enrollment's
 * frozen netAmountDue snapshot (spec section 8) when one exists, falling
 * back to the Package's current default price for Phase-1-only seed data
 * that predates the Enrollment model. Never recomputes from a package price
 * once a real Enrollment row exists.
 */
export async function resolveNetAmountDue(studentId: string): Promise<number> {
  const enrollment = await db.enrollment.findFirst({ where: { studentId }, orderBy: { createdAt: "desc" } });
  if (enrollment) return Number(enrollment.netAmountDue);

  const student = await db.student.findUnique({ where: { id: studentId }, include: { package: true } });
  return Number(student?.package.defaultPrice ?? 0);
}
