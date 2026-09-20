// Aggregation helpers for the Owner Executive Dashboard (Step 4).
// Every function here derives its result from the SAME underlying records
// used elsewhere in the app (students, payment transactions, adjustments,
// expenses) — there is no separate/duplicate dashboard data store. See
// src/utils/finance.ts for the money-side calculations these build on.

import type { AttendancePreference, Batch, PackageType, StudentRecord, TaobaoStatus } from "@/types/student";
import type { PackageAdjustment, PaymentTransaction, Expense } from "@/types/finance";
import { BATCH_OPTIONS, PACKAGE_OPTIONS } from "@/data/enrollmentConfig";
import { getStudentFinanceSummary, isSameCalendarDay } from "@/utils/finance";

export type RequirementsBucket = "Verified" | "For Verification" | "Needs Resubmission" | "Missing";

/** A finer-grained bucket than getRequirementsSummary(): distinguishes a truly missing file from one merely pending review. */
export function getRequirementsBucket(student: StudentRecord): RequirementsBucket {
  const missing = !student.validId.file || !student.proofOfPayment.file;
  if (missing) return "Missing";
  const statuses = [student.validId.status, student.proofOfPayment.status];
  if (statuses.includes("Needs Resubmission")) return "Needs Resubmission";
  if (statuses.every((s) => s === "Verified")) return "Verified";
  return "For Verification";
}

export const PIPELINE_STAGES = [
  "New Enrollment",
  "Pending Verification",
  "Confirmed Student",
  "Requirements Complete",
  "Taobao Processing",
  "Master Brain",
  "Training",
  "Completed",
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

/**
 * The single pipeline stage a student is currently sitting at, derived from
 * their real enrollment/requirements/taobao/master-brain fields. This is
 * the one place that logic lives — the dashboard funnel and the All
 * Students "stage" filter both call this function. Priority order (first
 * match wins) intentionally mirrors the funnel's left-to-right order.
 */
export function getStudentPipelineStage(student: StudentRecord): Exclude<PipelineStage, "New Enrollment"> {
  if (student.enrollmentStatus === "Completed") return "Completed";
  if (student.masterBrainStatus === "Completed") return "Training";
  if (student.enrollmentStatus === "Pending Verification") return "Pending Verification";
  if (getRequirementsBucket(student) !== "Verified") return "Confirmed Student";
  if (student.taobao.status === "Not Yet Created") return "Requirements Complete";
  if (student.taobao.status !== "Login Details Given to Student") return "Taobao Processing";
  return "Master Brain";
}

export interface PipelineStageCount {
  stage: PipelineStage;
  count: number;
}

export function getPipelineCounts(students: StudentRecord[]): PipelineStageCount[] {
  const counts: Record<Exclude<PipelineStage, "New Enrollment">, number> = {
    "Pending Verification": 0,
    "Confirmed Student": 0,
    "Requirements Complete": 0,
    "Taobao Processing": 0,
    "Master Brain": 0,
    Training: 0,
    Completed: 0,
  };
  for (const s of students) {
    counts[getStudentPipelineStage(s)] += 1;
  }
  return [
    { stage: "New Enrollment", count: students.length },
    { stage: "Pending Verification", count: counts["Pending Verification"] },
    { stage: "Confirmed Student", count: counts["Confirmed Student"] },
    { stage: "Requirements Complete", count: counts["Requirements Complete"] },
    { stage: "Taobao Processing", count: counts["Taobao Processing"] },
    { stage: "Master Brain", count: counts["Master Brain"] },
    { stage: "Training", count: counts.Training },
    { stage: "Completed", count: counts.Completed },
  ];
}

export function getMasterBrainCounts(students: StudentRecord[]) {
  return {
    "Not Started": students.filter((s) => s.masterBrainStatus === "Not Started").length,
    "In Progress": students.filter((s) => s.masterBrainStatus === "In Progress").length,
    Submitted: students.filter((s) => s.masterBrainStatus === "Submitted").length,
    "Under Review": students.filter((s) => s.masterBrainStatus === "Under Review").length,
    Completed: students.filter((s) => s.masterBrainStatus === "Completed").length,
  };
}

export function getTaobaoCounts(students: StudentRecord[]): Record<TaobaoStatus, number> {
  return {
    "Not Yet Created": students.filter((s) => s.taobao.status === "Not Yet Created").length,
    "For Account Creation": students.filter((s) => s.taobao.status === "For Account Creation").length,
    "Login Details Ready": students.filter((s) => s.taobao.status === "Login Details Ready").length,
    "Login Details Given to Student": students.filter((s) => s.taobao.status === "Login Details Given to Student")
      .length,
  };
}

export function getRequirementsCounts(students: StudentRecord[]): Record<RequirementsBucket, number> {
  return {
    Verified: students.filter((s) => getRequirementsBucket(s) === "Verified").length,
    "For Verification": students.filter((s) => getRequirementsBucket(s) === "For Verification").length,
    "Needs Resubmission": students.filter((s) => getRequirementsBucket(s) === "Needs Resubmission").length,
    Missing: students.filter((s) => getRequirementsBucket(s) === "Missing").length,
  };
}

export function getPaymentStatusBreakdown(
  students: StudentRecord[],
  transactions: PaymentTransaction[],
  adjustments: PackageAdjustment[],
) {
  const buckets = {
    "Fully Paid": { count: 0, amount: 0 },
    "Partial Payment": { count: 0, amount: 0 },
    Unpaid: { count: 0, amount: 0 },
    "Pending Verification": { count: 0, amount: 0 },
  };
  for (const s of students) {
    const summary = getStudentFinanceSummary(s, transactions, adjustments);
    if (summary.status === "Fully Paid") {
      buckets["Fully Paid"].count += 1;
      buckets["Fully Paid"].amount += summary.verifiedTotal;
    } else if (summary.status === "Partial Payment") {
      buckets["Partial Payment"].count += 1;
      buckets["Partial Payment"].amount += summary.balance;
    } else if (summary.status === "Pending Verification") {
      buckets["Pending Verification"].count += 1;
      buckets["Pending Verification"].amount += summary.balance;
    } else {
      buckets.Unpaid.count += 1;
      buckets.Unpaid.amount += summary.balance;
    }
  }
  return buckets;
}

export interface EnrollmentTrendPoint {
  label: string;
  count: number;
}

export type TrendGranularity = "daily" | "weekly" | "monthly";

export function getEnrollmentTrend(
  students: StudentRecord[],
  granularity: TrendGranularity,
  buckets = 8,
): EnrollmentTrendPoint[] {
  const now = new Date();
  const points: EnrollmentTrendPoint[] = [];

  for (let i = buckets - 1; i >= 0; i--) {
    let start: Date;
    let end: Date;
    let label: string;

    if (granularity === "daily") {
      start = new Date(now);
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - i);
      end = new Date(start);
      end.setDate(end.getDate() + 1);
      label = start.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
    } else if (granularity === "weekly") {
      start = new Date(now);
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - start.getDay() - i * 7);
      end = new Date(start);
      end.setDate(end.getDate() + 7);
      label = start.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
    } else {
      start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      label = start.toLocaleDateString("en-PH", { month: "short", year: "2-digit" });
    }

    const count = students.filter((s) => {
      const d = new Date(s.dateSubmitted);
      return d >= start && d < end;
    }).length;

    points.push({ label, count });
  }

  return points;
}

export function getEnrollmentByBatch(students: StudentRecord[]): { name: Batch; count: number }[] {
  return BATCH_OPTIONS.map((b) => ({ name: b, count: students.filter((s) => s.batch === b).length }));
}

export function getEnrollmentByPackage(students: StudentRecord[]): { name: PackageType; count: number }[] {
  return PACKAGE_OPTIONS.map((p) => ({ name: p, count: students.filter((s) => s.package === p).length }));
}

const ATTENDANCE_OPTIONS_LIST: AttendancePreference[] = ["Face-to-Face", "Early Access via Zoom", "Both"];

export function getEnrollmentByAttendance(students: StudentRecord[]): { name: AttendancePreference; count: number }[] {
  return ATTENDANCE_OPTIONS_LIST.map((a) => ({ name: a, count: students.filter((s) => s.attendance === a).length }));
}

export interface FinancialTrendPoint {
  label: string;
  collections: number;
  expenses: number;
}

/** Buckets by day for short ranges, otherwise by month, so a 12-month view stays legible. */
export function getFinancialTrend(
  transactions: PaymentTransaction[],
  expenses: Expense[],
  rangeDays: number,
): FinancialTrendPoint[] {
  const now = new Date();
  const byDay = rangeDays <= 31;
  const bucketCount = byDay ? rangeDays : Math.ceil(rangeDays / 30);
  const points: FinancialTrendPoint[] = [];

  for (let i = bucketCount - 1; i >= 0; i--) {
    let start: Date;
    let end: Date;
    let label: string;

    if (byDay) {
      start = new Date(now);
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - i);
      end = new Date(start);
      end.setDate(end.getDate() + 1);
      label = start.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
    } else {
      start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      label = start.toLocaleDateString("en-PH", { month: "short", year: "2-digit" });
    }

    const collections = transactions
      .filter((t) => t.status === "Verified")
      .filter((t) => {
        const d = new Date(t.date);
        return d >= start && d < end;
      })
      .reduce((sum, t) => sum + t.amount, 0);

    const expenseTotal = expenses
      .filter((e) => e.status === "Active")
      .filter((e) => {
        const d = new Date(e.date);
        return d >= start && d < end;
      })
      .reduce((sum, e) => sum + e.amount, 0);

    points.push({ label, collections, expenses: expenseTotal });
  }

  return points;
}

export interface TodayActivityItem {
  id: string;
  message: string;
  timestamp: string;
  sortKey: number;
  studentId?: string;
}

function tryParseDateTime(date: string, time: string): number {
  const parsed = Date.parse(`${date} ${time}`);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/** Real "today" activity feed, merged from every student's own Activity History plus today's expenses — no separate demo log. */
export function getTodaysActivity(students: StudentRecord[], expenses: Expense[]): TodayActivityItem[] {
  const now = new Date();
  const items: TodayActivityItem[] = [];

  for (const s of students) {
    for (const entry of s.activity) {
      const sortKey = tryParseDateTime(entry.date, entry.time);
      if (sortKey === 0) continue;
      if (!isSameCalendarDay(new Date(sortKey).toISOString(), now)) continue;
      items.push({
        id: entry.id,
        message: `${entry.action} — ${s.fullName} (${s.studentId})`,
        timestamp: `${entry.time} · ${entry.user}`,
        sortKey,
        studentId: s.id,
      });
    }
  }

  for (const e of expenses) {
    if (!isSameCalendarDay(e.createdAt, now)) continue;
    items.push({
      id: e.id,
      message: `Expense recorded: ${e.description} (${e.id})`,
      timestamp: `${new Date(e.createdAt).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" })} · ${e.recordedBy}`,
      sortKey: new Date(e.createdAt).getTime(),
    });
  }

  return items.sort((a, b) => b.sortKey - a.sortKey);
}

export interface ActionCenterCounts {
  paymentsToVerify: number;
  incompleteRequirements: number;
  taobaoToProcess: number;
  masterBrainToReview: number;
  studentsWithBalance: number;
}

export function getActionCenterCounts(
  students: StudentRecord[],
  transactions: PaymentTransaction[],
  adjustments: PackageAdjustment[],
): ActionCenterCounts {
  return {
    paymentsToVerify: transactions.filter((t) => t.status === "Pending Verification").length,
    incompleteRequirements: students.filter((s) => getRequirementsBucket(s) !== "Verified").length,
    taobaoToProcess: students.filter((s) => s.taobao.status !== "Login Details Given to Student").length,
    masterBrainToReview: students.filter((s) => s.masterBrainStatus === "Submitted" || s.masterBrainStatus === "Under Review")
      .length,
    studentsWithBalance: students.filter((s) => getStudentFinanceSummary(s, transactions, adjustments).balance > 0)
      .length,
  };
}

