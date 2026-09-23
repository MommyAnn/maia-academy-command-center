// The 6 real, deterministic rule evaluators (spec sections 9-46). Each
// evaluator answers ONE question: "which entities match this rule's
// condition RIGHT NOW?" — nothing here writes anything; the engine (engine.ts)
// turns the answer into signals. Every evaluator only reads fields that
// already exist and are already the source of truth (Lead, PaymentTransaction,
// CourseAccessGrant, Certificate, IntegrationOutboxEvent, AiGeneration) —
// this module invents no new "intelligence" data of its own (Core Principle:
// AI/rules interpret approved data, never become the source of truth).

import type { Prisma } from "@prisma/client";
import { db } from "../../db.js";

export interface RuleCandidate {
  entityType: string;
  entityId: string;
  title: string;
  explanation: string;
  evidence: Record<string, unknown>;
}

export interface RuleDefinition {
  ruleKey: string;
  name: string;
  domain: string;
  description: string;
  triggerType: string;
  defaultThreshold: Record<string, unknown>;
  defaultSeverity: string;
  defaultRecommendation: string;
  evaluate: (thresholds: Record<string, unknown>) => Promise<RuleCandidate[]>;
}

function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

function daysAgo(days: number): Date {
  return hoursAgo(days * 24);
}

const leadInterestedNoFollowUp: RuleDefinition = {
  ruleKey: "lead-interested-no-followup",
  name: "Interested Lead Without Follow-Up",
  domain: "Lead",
  description: "A Lead at Interested/Considering pipeline stage has no completed follow-up within the configured window.",
  triggerType: "MISSING_ACTION",
  defaultThreshold: { hoursThreshold: 48 },
  defaultSeverity: "HIGH",
  defaultRecommendation: "Review the Lead and schedule a follow-up.",
  async evaluate(thresholds) {
    const hoursThreshold = Number(thresholds.hoursThreshold ?? 48);
    const cutoff = hoursAgo(hoursThreshold);
    const leads = await db.lead.findMany({
      where: { pipelineStage: { in: ["INTERESTED", "CONSIDERING"] }, status: "Active", createdAt: { lte: cutoff } },
      include: { followUps: true, person: true },
    });
    const out: RuleCandidate[] = [];
    for (const lead of leads) {
      const hasRecentCompletedFollowUp = lead.followUps.some((f) => f.status === "Completed" && f.completedAt && f.completedAt >= cutoff);
      if (hasRecentCompletedFollowUp) continue;
      out.push({
        entityType: "Lead",
        entityId: lead.id,
        title: `${lead.person.fullName} (${lead.leadDisplayId}) has no completed follow-up`,
        explanation: `Pipeline Stage = ${lead.pipelineStage} AND no completed follow-up within the last ${hoursThreshold} hours.`,
        evidence: { leadDisplayId: lead.leadDisplayId, pipelineStage: lead.pipelineStage, hoursThreshold, lastFollowUpAt: lead.lastFollowUpAt },
      });
    }
    return out;
  },
};

const financePaymentPendingOverdue: RuleDefinition = {
  ruleKey: "finance-payment-pending-overdue",
  name: "Payment Pending Verification Overdue",
  domain: "Finance",
  description: "A submitted payment has sat in PENDING_VERIFICATION longer than the configured window.",
  triggerType: "TIME_BASED",
  defaultThreshold: { hoursThreshold: 24 },
  defaultSeverity: "HIGH",
  defaultRecommendation: "Review and verify or reject the payment.",
  async evaluate(thresholds) {
    const hoursThreshold = Number(thresholds.hoursThreshold ?? 24);
    const cutoff = hoursAgo(hoursThreshold);
    const payments = await db.paymentTransaction.findMany({
      where: { status: "PENDING_VERIFICATION", createdAt: { lte: cutoff } },
    });
    return payments.map((p) => ({
      entityType: "PaymentTransaction",
      entityId: p.id,
      title: `Payment ${p.paymentDisplayId} pending verification for over ${hoursThreshold}h`,
      explanation: `Status = PENDING_VERIFICATION AND submitted more than ${hoursThreshold} hours ago.`,
      evidence: { paymentDisplayId: p.paymentDisplayId, amount: Number(p.amount), submittedAt: p.createdAt, hoursThreshold },
    }));
  },
};

const courseAccessNotStarted: RuleDefinition = {
  ruleKey: "student-course-access-not-started",
  name: "Course Access Granted But Never Started",
  domain: "StudentSuccess",
  description: "A Student has an Active course access grant older than the configured window with no lesson progress recorded.",
  triggerType: "MISSING_ACTION",
  defaultThreshold: { daysThreshold: 3 },
  defaultSeverity: "MEDIUM",
  defaultRecommendation: "Encourage the Student to start the course, or verify access is still relevant.",
  async evaluate(thresholds) {
    const daysThreshold = Number(thresholds.daysThreshold ?? 3);
    const cutoff = daysAgo(daysThreshold);
    const grants = await db.courseAccessGrant.findMany({
      where: { status: "Active", grantedAt: { lte: cutoff } },
      include: { student: { include: { person: true } }, course: true },
    });
    const out: RuleCandidate[] = [];
    for (const grant of grants) {
      const lessons = await db.lesson.findMany({ where: { module: { courseId: grant.courseId } }, select: { id: true } });
      if (lessons.length === 0) continue;
      const progressCount = await db.lessonProgress.count({
        where: { studentId: grant.studentId, lessonId: { in: lessons.map((l) => l.id) }, status: { in: ["In Progress", "Completed"] } },
      });
      if (progressCount > 0) continue;
      out.push({
        entityType: "CourseAccessGrant",
        entityId: grant.id,
        title: `${grant.student.person.fullName} has not started "${grant.course.title}"`,
        explanation: `Course access granted ${daysThreshold}+ days ago AND no lesson progress recorded.`,
        evidence: { studentDisplayId: grant.student.studentDisplayId, courseTitle: grant.course.title, grantedAt: grant.grantedAt, daysThreshold },
      });
    }
    return out;
  },
};

const certificateEligibleNotIssued: RuleDefinition = {
  ruleKey: "student-certificate-eligible-not-issued",
  name: "Certificate Eligible But Not Issued",
  domain: "StudentSuccess",
  description: "A Certificate has already been evaluated as Eligible but has not progressed to Issued.",
  triggerType: "STATUS_MISMATCH",
  defaultThreshold: {},
  defaultSeverity: "MEDIUM",
  defaultRecommendation: "Move the certificate through preparation and issuance.",
  async evaluate() {
    const certificates = await db.certificate.findMany({
      where: { status: "Eligible" },
      include: { student: { include: { person: true } } },
    });
    return certificates.map((c) => ({
      entityType: "Certificate",
      entityId: c.id,
      title: `${c.student.person.fullName} is Eligible for a certificate, not yet issued`,
      explanation: "Certificate.status = Eligible AND has not moved to Issued.",
      evidence: { studentDisplayId: c.student.studentDisplayId, certificateDisplayId: c.certificateDisplayId, evaluatedStatus: c.status },
    }));
  },
};

const ghlSyncFailures: RuleDefinition = {
  ruleKey: "operations-ghl-sync-failures",
  name: "GHL Sync Failures",
  domain: "Operations",
  description: "An outbound GHL sync event has failed or been dead-lettered and has not been resolved.",
  triggerType: "ANOMALY",
  defaultThreshold: {},
  defaultSeverity: "HIGH",
  defaultRecommendation: "Review and manually retry the failed sync event.",
  async evaluate() {
    const events = await db.integrationOutboxEvent.findMany({
      where: { status: { in: ["FAILED", "DEAD_LETTER"] }, resolvedAt: null },
    });
    return events.map((e) => ({
      entityType: "IntegrationOutboxEvent",
      entityId: e.id,
      title: `GHL sync failed: ${e.eventType}`,
      explanation: `Status = ${e.status} AND not yet resolved.`,
      evidence: { eventType: e.eventType, status: e.status, attemptCount: e.attemptCount, lastError: e.lastError, lastErrorCategory: e.lastErrorCategory },
    }));
  },
};

const aiUsageNearLimit: RuleDefinition = {
  ruleKey: "ai-usage-near-limit",
  name: "Student Near AI Usage Limit",
  domain: "AiUsage",
  description: "A Student's today's AI generation count has reached the configured percentage of their applicable daily limit.",
  triggerType: "THRESHOLD",
  defaultThreshold: { nearPercent: 80 },
  defaultSeverity: "MEDIUM",
  defaultRecommendation: "No action required unless the Student needs a temporary manual grant; usage limits are working as intended.",
  async evaluate(thresholds) {
    const nearPercent = Number(thresholds.nearPercent ?? 80);
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const limits = await db.aiUsageLimit.findMany({ where: { dailyLimit: { not: null } } });
    const out: RuleCandidate[] = [];
    for (const limit of limits) {
      if (!limit.dailyLimit) continue;
      const nearCount = Math.ceil((limit.dailyLimit * nearPercent) / 100);
      const where: Prisma.AiGenerationWhereInput = { createdAt: { gte: startOfToday } };
      if (limit.scope === "TOOL" || limit.scope === "PACKAGE_TOOL") where.toolId = limit.toolId!;
      const grouped = await db.aiGeneration.groupBy({ by: ["studentId"], where, _count: { _all: true } });
      for (const row of grouped) {
        if (row._count._all < nearCount) continue;
        const student = await db.student.findUnique({ where: { id: row.studentId }, include: { person: true } });
        if (!student) continue;
        out.push({
          entityType: "Student",
          entityId: student.id,
          title: `${student.person.fullName} is near their daily AI usage limit`,
          explanation: `${row._count._all}/${limit.dailyLimit} generations today (scope: ${limit.scope}) — at or above ${nearPercent}% of the daily limit.`,
          evidence: { studentDisplayId: student.studentDisplayId, todayCount: row._count._all, dailyLimit: limit.dailyLimit, scope: limit.scope, nearPercent },
        });
      }
    }
    return out;
  },
};

export const RULE_DEFINITIONS: RuleDefinition[] = [
  leadInterestedNoFollowUp,
  financePaymentPendingOverdue,
  courseAccessNotStarted,
  certificateEligibleNotIssued,
  ghlSyncFailures,
  aiUsageNearLimit,
];
