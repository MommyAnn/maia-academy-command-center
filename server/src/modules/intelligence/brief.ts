// Daily Brief / Command Center aggregation (spec sections 2-6). Every
// number here is a live database query — nothing cached, nothing
// hard-coded, nothing invented. Every field is labeled FACT or CALCULATED
// METRIC in its own key name so a client can never confuse a real count
// with a rule-based signal or an AI interpretation (spec section 6).

import { db } from "../../db.js";

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Same receivables formula as /api/dashboard/summary (spec section 34's "never hard-coded") — kept in sync deliberately, not re-derived differently. */
async function computeReceivables(): Promise<number> {
  const [enrollments, students, verifiedByStudent] = await Promise.all([
    db.enrollment.findMany({ select: { studentId: true, netAmountDue: true }, orderBy: { createdAt: "desc" } }),
    db.student.findMany({ select: { id: true, package: { select: { defaultPrice: true } } } }),
    db.paymentTransaction.groupBy({ by: ["studentId"], where: { status: "VERIFIED", studentId: { not: null } }, _sum: { amount: true } }),
  ]);
  const netAmountDueByStudent = new Map<string, number>();
  for (const e of enrollments) if (e.studentId && !netAmountDueByStudent.has(e.studentId)) netAmountDueByStudent.set(e.studentId, Number(e.netAmountDue));
  for (const s of students) if (!netAmountDueByStudent.has(s.id)) netAmountDueByStudent.set(s.id, Number(s.package.defaultPrice ?? 0));
  const verifiedPaidByStudent = new Map<string, number>();
  for (const v of verifiedByStudent) if (v.studentId) verifiedPaidByStudent.set(v.studentId, Number(v._sum.amount ?? 0));
  let receivables = 0;
  for (const s of students) receivables += Math.max((netAmountDueByStudent.get(s.id) ?? 0) - (verifiedPaidByStudent.get(s.id) ?? 0), 0);
  return receivables;
}

export async function buildDailyBrief(rangeDays = 1) {
  const since = daysAgo(rangeDays);

  const [
    newLeads,
    webinarRegistrations,
    webinarAttended,
    followUpsDue,
    reservations,
    enrollments,
    verifiedCollections,
    pendingPayments,
    pendingPaymentsSum,
    receivables,
    upcomingTraining,
    courseCompletions,
    aiGenerationsToday,
    aiFailuresToday,
    openSignalsBySeverity,
  ] = await Promise.all([
    db.lead.count({ where: { createdAt: { gte: since } } }),
    db.webinarRegistration.count({ where: { registeredAt: { gte: since } } }),
    db.webinarRegistration.count({ where: { registeredAt: { gte: since }, attendanceStatus: { in: ["Attended", "Completed Webinar"] } } }),
    db.followUp.count({ where: { status: { in: ["Scheduled", "Due"] }, scheduledFor: { lte: new Date() } } }),
    db.paymentTransaction.count({ where: { type: "Reservation", createdAt: { gte: since } } }),
    db.enrollment.count({ where: { createdAt: { gte: since } } }),
    db.paymentTransaction.aggregate({ where: { status: "VERIFIED", createdAt: { gte: since } }, _sum: { amount: true } }),
    db.paymentTransaction.count({ where: { status: "PENDING_VERIFICATION" } }),
    db.paymentTransaction.aggregate({ where: { status: "PENDING_VERIFICATION" }, _sum: { amount: true } }),
    computeReceivables(),
    db.trainingSession.count({ where: { date: { gte: new Date(), lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) } } }),
    db.domainEvent.count({ where: { type: "COURSE_COMPLETED", occurredAt: { gte: since } } }),
    db.aiGeneration.count({ where: { createdAt: { gte: since } } }),
    db.aiGeneration.count({ where: { createdAt: { gte: since }, status: "FAILED" } }),
    db.intelligenceSignal.groupBy({ by: ["severity"], where: { status: { in: ["NEW", "REVIEWED", "ACTIONED"] } }, _count: { _all: true } }),
  ]);

  const severityCounts: Record<string, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  for (const row of openSignalsBySeverity) severityCounts[row.severity] = row._count._all;

  return {
    rangeDays,
    since: since.toISOString(),
    facts: {
      newLeads,
      webinarRegistrations,
      webinarAttended,
      followUpsDueNow: followUpsDue,
      reservations,
      newEnrollments: enrollments,
      upcomingTrainingSessions7d: upcomingTraining,
      courseCompletions,
      aiGenerationsToday: aiGenerationsToday,
      aiFailuresToday,
    },
    calculatedMetrics: {
      verifiedCollections: Number(verifiedCollections._sum.amount ?? 0),
      pendingPaymentVerificationCount: pendingPayments,
      pendingPaymentVerificationTotal: Number(pendingPaymentsSum._sum.amount ?? 0),
      receivables,
    },
    ruleBasedSignals: {
      openByseverity: severityCounts,
      totalOpen: Object.values(severityCounts).reduce((a, b) => a + b, 0),
    },
    generatedAt: new Date().toISOString(),
  };
}

/** Today's Priorities (spec section 3) — every open signal, grouped by severity, each explainable. Never fabricated: an empty list here means zero rules currently match, not that nothing was checked. */
export async function buildTodaysPriorities() {
  const signals = await db.intelligenceSignal.findMany({
    where: { status: { in: ["NEW", "REVIEWED", "ACTIONED"] } },
    include: { rule: true },
    orderBy: [{ severity: "asc" }, { detectedAt: "asc" }],
  });
  const severityOrder = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
  const sorted = [...signals].sort((a, b) => severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity));
  return sorted.map((s) => ({
    id: s.id,
    severity: s.severity,
    domain: s.domain,
    title: s.title,
    explanation: s.explanation,
    evidence: s.evidenceJson,
    entityType: s.entityType,
    entityId: s.entityId,
    recommendation: s.rule.recommendation,
    ruleKey: s.rule.ruleKey,
    detectedAt: s.detectedAt,
    status: s.status,
  }));
}
