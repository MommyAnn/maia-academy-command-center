import type { Batch, PaymentStatus, StudentRecord } from "@/types/student";
import type { Expense, PackageAdjustment, PaymentTransaction } from "@/types/finance";

function batchCode(batch: Batch): string {
  const match = batch.match(/\d+/);
  return match ? match[0] : "00";
}

/** Generates the next sequential demo Payment ID for a batch, e.g. PAY-B14-000001. */
export function generatePaymentId(batch: Batch, existingTransactions: PaymentTransaction[]): string {
  const prefix = `PAY-B${batchCode(batch)}-`;
  const count = existingTransactions.filter((t) => t.id.startsWith(prefix)).length;
  return `${prefix}${String(count + 1).padStart(6, "0")}`;
}

/** Generates the next sequential demo Expense ID for a year, e.g. EXP-2026-000001. */
export function generateExpenseId(dateIso: string, existingExpenses: { id: string }[]): string {
  const year = new Date(dateIso).getFullYear();
  const prefix = `EXP-${year}-`;
  const count = existingExpenses.filter((e) => e.id.startsWith(prefix)).length;
  return `${prefix}${String(count + 1).padStart(6, "0")}`;
}

export function getStudentTransactions(studentId: string, transactions: PaymentTransaction[]): PaymentTransaction[] {
  return transactions
    .filter((t) => t.studentId === studentId)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

/** Total money actually received and verified for a student. This is the ONLY source of truth for "amount paid". */
export function getVerifiedTotal(studentId: string, transactions: PaymentTransaction[]): number {
  return transactions
    .filter((t) => t.studentId === studentId && t.status === "Verified")
    .reduce((sum, t) => sum + t.amount, 0);
}

export function hasPendingVerification(studentId: string, transactions: PaymentTransaction[]): boolean {
  return transactions.some((t) => t.studentId === studentId && t.status === "Pending Verification");
}

export function getStudentAdjustments(studentId: string, adjustments: PackageAdjustment[]): PackageAdjustment[] {
  return adjustments.filter((a) => a.studentId === studentId);
}

export function getTotalAdjustments(studentId: string, adjustments: PackageAdjustment[]): number {
  return getStudentAdjustments(studentId, adjustments).reduce((sum, a) => sum + a.amount, 0);
}

/** The amount actually owed after discounts/scholarships/adjustments — never a silent overwrite of the original price. */
export function getFinalPackageAmount(student: StudentRecord, adjustments: PackageAdjustment[]): number {
  const totalAdjustments = getTotalAdjustments(student.id, adjustments);
  return Math.max(0, student.payment.packagePrice - totalAdjustments);
}

export function getStudentBalance(finalPackageAmount: number, verifiedTotal: number): number {
  return Math.max(0, finalPackageAmount - verifiedTotal);
}

/**
 * Automatically calculated payment status — never manually set. See Step 3
 * spec section 7: Unpaid / Partial Payment / Fully Paid, with Pending
 * Verification taking precedence whenever an unverified payment exists and
 * the student isn't already fully paid.
 */
export function computePaymentStatus(
  finalPackageAmount: number,
  verifiedTotal: number,
  hasPending: boolean,
): PaymentStatus {
  if (verifiedTotal >= finalPackageAmount && finalPackageAmount > 0) return "Fully Paid";
  if (hasPending) return "Pending Verification";
  if (verifiedTotal > 0) return "Partial Payment";
  return "Unpaid";
}

export interface StudentFinanceSummary {
  originalPrice: number;
  totalAdjustments: number;
  finalPackageAmount: number;
  verifiedTotal: number;
  balance: number;
  status: PaymentStatus;
  hasPending: boolean;
  percentPaid: number;
  transactions: PaymentTransaction[];
  adjustments: PackageAdjustment[];
}

/** The single place every page should go to read a student's computed finance summary. */
export function getStudentFinanceSummary(
  student: StudentRecord,
  transactions: PaymentTransaction[],
  adjustments: PackageAdjustment[],
): StudentFinanceSummary {
  const studentAdjustments = getStudentAdjustments(student.id, adjustments);
  const studentTransactions = getStudentTransactions(student.id, transactions);
  const totalAdjustments = studentAdjustments.reduce((sum, a) => sum + a.amount, 0);
  const finalPackageAmount = Math.max(0, student.payment.packagePrice - totalAdjustments);
  const verifiedTotal = studentTransactions
    .filter((t) => t.status === "Verified")
    .reduce((sum, t) => sum + t.amount, 0);
  const hasPending = studentTransactions.some((t) => t.status === "Pending Verification");
  const balance = getStudentBalance(finalPackageAmount, verifiedTotal);
  const status = computePaymentStatus(finalPackageAmount, verifiedTotal, hasPending);
  const percentPaid = finalPackageAmount > 0 ? Math.min(100, Math.round((verifiedTotal / finalPackageAmount) * 100)) : 0;

  return {
    originalPrice: student.payment.packagePrice,
    totalAdjustments,
    finalPackageAmount,
    verifiedTotal,
    balance,
    status,
    hasPending,
    percentPaid,
    transactions: studentTransactions,
    adjustments: studentAdjustments,
  };
}

export function isSameCalendarDay(iso: string, reference: Date): boolean {
  const d = new Date(iso);
  return (
    d.getFullYear() === reference.getFullYear() &&
    d.getMonth() === reference.getMonth() &&
    d.getDate() === reference.getDate()
  );
}

export function isSameMonth(iso: string, reference: Date): boolean {
  const d = new Date(iso);
  return d.getFullYear() === reference.getFullYear() && d.getMonth() === reference.getMonth();
}

export function isSameYear(iso: string, reference: Date): boolean {
  return new Date(iso).getFullYear() === reference.getFullYear();
}

function startOfWeek(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  copy.setDate(copy.getDate() - copy.getDay());
  return copy;
}

export function isSameWeek(iso: string, reference: Date): boolean {
  const start = startOfWeek(reference);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  const d = new Date(iso);
  return d >= start && d < end;
}

export type DateRangePreset = "today" | "this_week" | "this_month" | "this_year" | "all_time" | "custom";

export interface DateFilterValue {
  preset: DateRangePreset;
  from?: string; // yyyy-mm-dd, custom only
  to?: string; // yyyy-mm-dd, custom only
}

export function matchesDateFilter(iso: string, filter: DateFilterValue, reference = new Date()): boolean {
  switch (filter.preset) {
    case "today":
      return isSameCalendarDay(iso, reference);
    case "this_week":
      return isSameWeek(iso, reference);
    case "this_month":
      return isSameMonth(iso, reference);
    case "this_year":
      return isSameYear(iso, reference);
    case "custom": {
      const d = new Date(iso).getTime();
      const fromOk = filter.from ? d >= new Date(filter.from).getTime() : true;
      const toOk = filter.to ? d <= new Date(filter.to).getTime() + 24 * 60 * 60 * 1000 - 1 : true;
      return fromOk && toOk;
    }
    case "all_time":
    default:
      return true;
  }
}

// ---------------------------------------------------------------------------
// Business-wide aggregates. Every number below is derived live from the
// transaction/expense/adjustment ledgers passed in — never from a cached or
// manually-entered total. This keeps Finance Overview, Receivables, Reports,
// and per-batch summaries all reading from one consistent calculation.
// ---------------------------------------------------------------------------

export function getTotalPackageValue(students: StudentRecord[], adjustments: PackageAdjustment[]): number {
  return students.reduce((sum, s) => sum + getFinalPackageAmount(s, adjustments), 0);
}

export function getVerifiedTransactions(transactions: PaymentTransaction[]): PaymentTransaction[] {
  return transactions.filter((t) => t.status === "Verified");
}

export function getTotalVerifiedCollections(transactions: PaymentTransaction[]): number {
  return getVerifiedTransactions(transactions).reduce((sum, t) => sum + t.amount, 0);
}

export function getCollectionsToday(transactions: PaymentTransaction[], reference = new Date()): number {
  return getVerifiedTransactions(transactions)
    .filter((t) => isSameCalendarDay(t.date, reference))
    .reduce((sum, t) => sum + t.amount, 0);
}

export function getCollectionsThisMonth(transactions: PaymentTransaction[], reference = new Date()): number {
  return getVerifiedTransactions(transactions)
    .filter((t) => isSameMonth(t.date, reference))
    .reduce((sum, t) => sum + t.amount, 0);
}

export function getPendingVerificationTransactions(transactions: PaymentTransaction[]): PaymentTransaction[] {
  return transactions.filter((t) => t.status === "Pending Verification");
}

export function getTotalReceivables(
  students: StudentRecord[],
  transactions: PaymentTransaction[],
  adjustments: PackageAdjustment[],
): number {
  return students.reduce((sum, s) => {
    const summary = getStudentFinanceSummary(s, transactions, adjustments);
    return sum + summary.balance;
  }, 0);
}

export function getActiveExpenses(expenses: Expense[]): Expense[] {
  return expenses.filter((e) => e.status === "Active");
}

export function getTotalExpenses(expenses: Expense[]): number {
  return getActiveExpenses(expenses).reduce((sum, e) => sum + e.amount, 0);
}

export function getExpensesToday(expenses: Expense[], reference = new Date()): number {
  return getActiveExpenses(expenses)
    .filter((e) => isSameCalendarDay(e.date, reference))
    .reduce((sum, e) => sum + e.amount, 0);
}

export function getExpensesThisMonth(expenses: Expense[], reference = new Date()): number {
  return getActiveExpenses(expenses)
    .filter((e) => isSameMonth(e.date, reference))
    .reduce((sum, e) => sum + e.amount, 0);
}

export function getExpensesThisYear(expenses: Expense[], reference = new Date()): number {
  return getActiveExpenses(expenses)
    .filter((e) => isSameYear(e.date, reference))
    .reduce((sum, e) => sum + e.amount, 0);
}

/** Net Cash = Verified Collections − Recorded (Active) Expenses. Never called "Profit". */
export function getNetCash(verifiedCollections: number, totalExpenses: number): number {
  return verifiedCollections - totalExpenses;
}

export function getStudentsWithBalance(
  students: StudentRecord[],
  transactions: PaymentTransaction[],
  adjustments: PackageAdjustment[],
): StudentRecord[] {
  return students.filter((s) => getStudentFinanceSummary(s, transactions, adjustments).balance > 0);
}

export function getLastPaymentDate(studentId: string, transactions: PaymentTransaction[]): string | null {
  const verified = getStudentTransactions(studentId, transactions).filter((t) => t.status === "Verified");
  return verified.length > 0 ? verified[0].date : null;
}

const OVERDUE_THRESHOLD_DAYS = 30;

/**
 * A balance is treated as "overdue" once 30+ days have passed since the
 * student's last verified payment (or since enrollment, if none yet) while a
 * balance remains. There is no due-date field yet, so this is a reasonable
 * demo heuristic derived from real transaction dates — not a fabricated flag.
 */
function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function toCsv(rows: (string | number)[][]): string {
  return rows.map((row) => row.map((cell) => csvEscape(String(cell))).join(",")).join("\n");
}

/** Triggers a client-side CSV download. No data leaves the browser. */
export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = toCsv(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function isReceivableOverdue(
  student: StudentRecord,
  transactions: PaymentTransaction[],
  adjustments: PackageAdjustment[],
  reference = new Date(),
): boolean {
  const summary = getStudentFinanceSummary(student, transactions, adjustments);
  if (summary.balance <= 0) return false;
  const lastPayment = getLastPaymentDate(student.id, transactions);
  const anchor = new Date(lastPayment ?? student.enrollmentDate);
  const days = (reference.getTime() - anchor.getTime()) / (1000 * 60 * 60 * 24);
  return days > OVERDUE_THRESHOLD_DAYS;
}
