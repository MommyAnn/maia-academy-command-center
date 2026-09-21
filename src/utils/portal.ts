// Student Portal calculation helpers for Step 7.

import type { StudentRecord } from "@/types/student";
import type {
  Announcement,
  SupportRequest,
  UpdateRequest,
} from "@/types/portal";
import type { StudentFinanceSummary } from "@/utils/finance";
import type { CertificateRecord, SessionEnrollment, TrainingSession } from "@/types/training";
import { getRequirementsSummary } from "@/utils/students";

export function generateSupportId(existing: SupportRequest[]): string {
  const nextSeq = String(existing.length + 1).padStart(6, "0");
  return `SUP-${nextSeq}`;
}

export function generateUpdateRequestId(existing: UpdateRequest[]): string {
  const nextSeq = String(existing.length + 1).padStart(6, "0");
  return `PUR-${nextSeq}`;
}

/** Whether `announcement` should be visible to `student` — the same rule the Student Portal's Announcements page and Home banner both use. */
export function isAnnouncementVisibleToStudent(announcement: Announcement, student: StudentRecord): boolean {
  switch (announcement.audienceType) {
    case "All Students":
      return true;
    case "Batch":
      return announcement.audienceValue === student.batch;
    case "Package":
      return announcement.audienceValue === student.package;
    case "Face-to-Face":
      return student.attendance === "Face-to-Face" || student.attendance === "Both";
    case "Zoom":
      return student.attendance === "Early Access via Zoom" || student.attendance === "Both";
    case "Both":
      return student.attendance === "Both";
    case "Individual Student":
      return announcement.audienceValue === student.id;
    default:
      return false;
  }
}

// hasCourseAccess used to live here as a Step 7 stub. Step 9 builds the
// full course access resolver (package matrix + individual grants + the
// configurable full-payment automation rule) — see resolveCourseAccess in
// src/utils/lms.ts.

// ---------------------------------------------------------------------------
// "MY JOURNEY" tracker + "WHAT'S NEXT?" — the Student Home Dashboard's two
// most important widgets (spec sections 6–7). Both are derived live from the
// SAME underlying records every other page reads (StudentRecord, the finance
// ledger, training rosters, certificates) — never a separate stored status,
// so the journey can never drift out of sync with the real data.
// ---------------------------------------------------------------------------

export type JourneyStepStatus = "Completed" | "In Progress" | "Pending" | "Needs Action" | "Not Started";

export interface JourneyStep {
  key: string;
  label: string;
  status: JourneyStepStatus;
}

export interface JourneyContext {
  student: StudentRecord;
  finance: StudentFinanceSummary;
  sessionEnrollments: SessionEnrollment[];
  sessions: TrainingSession[];
  certificates: CertificateRecord[];
}

function computeEnrollmentStepStatus(student: StudentRecord): JourneyStepStatus {
  if (student.enrollmentStatus === "Pending Verification") return "Pending";
  return "Completed";
}

function computePaymentStepStatus(finance: StudentFinanceSummary): JourneyStepStatus {
  if (finance.status === "Fully Paid") return "Completed";
  if (finance.status === "Pending Verification") return "Pending";
  if (finance.status === "Partial Payment") return "In Progress";
  return "Not Started";
}

function computeRequirementsStepStatus(student: StudentRecord): JourneyStepStatus {
  const summary = getRequirementsSummary(student);
  if (summary === "Verified") return "Completed";
  if (summary === "Needs Resubmission") return "Needs Action";
  return "Pending";
}

function computeTaobaoStepStatus(student: StudentRecord): JourneyStepStatus {
  switch (student.taobao.status) {
    case "Login Details Given to Student":
      return "Completed";
    case "Login Details Ready":
      return "In Progress";
    case "For Account Creation":
      return "Pending";
    default:
      return "Not Started";
  }
}

function computeMasterBrainStepStatus(student: StudentRecord): JourneyStepStatus {
  switch (student.masterBrainStatus) {
    case "Completed":
      return "Completed";
    case "Submitted":
    case "Under Review":
      return "Pending";
    case "In Progress":
      return "In Progress";
    default:
      return "Not Started";
  }
}

function computeTrainingStepStatus(ctx: JourneyContext): JourneyStepStatus {
  const mySessions = ctx.sessionEnrollments
    .map((e) => ctx.sessions.find((s) => s.id === e.sessionId))
    .filter((s): s is TrainingSession => Boolean(s));
  if (mySessions.length === 0) return "Not Started";
  const anyCompleted = mySessions.some((s) => s.status === "Completed");
  const anyUpcoming = mySessions.some((s) => s.status === "Scheduled" || s.status === "Ongoing");
  if (anyCompleted && !anyUpcoming) return "Completed";
  if (anyUpcoming) return "In Progress";
  return "Pending";
}

function computeCompletionStepStatus(student: StudentRecord, trainingStatus: JourneyStepStatus): JourneyStepStatus {
  if (student.enrollmentStatus === "Completed") return "Completed";
  if (trainingStatus === "Completed") return "In Progress";
  return "Not Started";
}

function computeCertificateStepStatus(certificates: CertificateRecord[]): JourneyStepStatus {
  if (certificates.length === 0) return "Not Started";
  if (certificates.some((c) => c.status === "Issued" || c.status === "Reissued")) return "Completed";
  if (certificates.some((c) => c.status === "Ready")) return "Pending";
  if (certificates.some((c) => c.status === "For Preparation" || c.status === "Eligible")) return "In Progress";
  return "Not Started";
}

export function computeJourneySteps(ctx: JourneyContext): JourneyStep[] {
  const trainingStatus = computeTrainingStepStatus(ctx);
  return [
    { key: "enrolled", label: "Enrolled", status: computeEnrollmentStepStatus(ctx.student) },
    { key: "payment", label: "Payment", status: computePaymentStepStatus(ctx.finance) },
    { key: "requirements", label: "Requirements", status: computeRequirementsStepStatus(ctx.student) },
    { key: "taobao", label: "Taobao", status: computeTaobaoStepStatus(ctx.student) },
    { key: "masterBrain", label: "Master Brain", status: computeMasterBrainStepStatus(ctx.student) },
    { key: "training", label: "Training", status: trainingStatus },
    { key: "completion", label: "Completion", status: computeCompletionStepStatus(ctx.student, trainingStatus) },
    { key: "certificate", label: "Certificate", status: computeCertificateStepStatus(ctx.certificates) },
  ];
}

export interface NextAction {
  title: string;
  description: string;
  ctaLabel: string;
  ctaPath: string;
}

/**
 * Picks the ONE most important next action for the student — see spec
 * section 7 ("one of the MOST important student widgets"). Walks the
 * journey in order and returns the first step needing attention, with
 * "Needs Action" steps jumping the queue ahead of a same-position "Pending"
 * one since those require the student to actually do something now.
 */
export function computeNextAction(steps: JourneyStep[]): NextAction | null {
  const needsAction = steps.find((s) => s.status === "Needs Action");
  if (needsAction) return buildNextAction(needsAction);

  const actionable = steps.find((s) => s.status === "Not Started" || s.status === "In Progress");
  if (actionable) return buildNextAction(actionable);

  const pending = steps.find((s) => s.status === "Pending");
  if (pending) return buildNextAction(pending, true);

  return null;
}

function buildNextAction(step: JourneyStep, waitingOnAcademy = false): NextAction {
  const map: Record<string, NextAction> = {
    enrolled: {
      title: "Your enrollment is being verified",
      description: "The Academy is reviewing your enrollment submission.",
      ctaLabel: "View My Enrollment",
      ctaPath: "/portal/enrollment",
    },
    payment: {
      title: step.status === "Needs Action" ? "Payment needs your attention" : "Complete your payment",
      description:
        step.status === "Pending"
          ? "Your submitted payment is awaiting verification."
          : "Submit your payment or proof of payment to move forward.",
      ctaLabel: "Go to My Payments",
      ctaPath: "/portal/payments",
    },
    requirements: {
      title: step.status === "Needs Action" ? "A requirement needs resubmission" : "Submit your requirements",
      description:
        step.status === "Needs Action"
          ? "One of your documents needs to be resubmitted — please check the reason and upload an updated file."
          : "Your documents are being reviewed by the Academy.",
      ctaLabel: "Go to My Requirements",
      ctaPath: "/portal/requirements",
    },
    taobao: {
      title: "Your Taobao account is in progress",
      description: "The Academy is preparing your Taobao account details.",
      ctaLabel: "View My Taobao",
      ctaPath: "/portal/taobao",
    },
    masterBrain: {
      title: "Start your Master Brain questionnaire",
      description: "Complete your Master Brain business questionnaire when you're ready.",
      ctaLabel: "Go to My Master Brain",
      ctaPath: "/portal/master-brain",
    },
    training: {
      title: "Check your upcoming training",
      description: "See your scheduled sessions and what to prepare.",
      ctaLabel: "View My Training",
      ctaPath: "/portal/training",
    },
    completion: {
      title: "You're almost done with the program!",
      description: "Finish your remaining training sessions to complete the program.",
      ctaLabel: "View My Training",
      ctaPath: "/portal/training",
    },
    certificate: {
      title: "Your certificate is in progress",
      description: "The Academy is preparing your certificate.",
      ctaLabel: "View My Certificates",
      ctaPath: "/portal/certificates",
    },
  };

  const base = map[step.key];
  if (waitingOnAcademy) {
    return { ...base, title: `${base.title} (waiting on the Academy)` };
  }
  return base;
}
