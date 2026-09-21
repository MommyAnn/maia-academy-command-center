// Training/Attendance/Certificate calculation helpers for Step 6.

import type { Batch, StudentRecord } from "@/types/student";
import type { PackageAdjustment, PaymentTransaction } from "@/types/finance";
import type { CertificateEligibilitySettings, CertificateRecord, SessionEnrollment, TrainingSession } from "@/types/training";
import { getRequirementsBucket } from "@/utils/dashboard";
import { getStudentFinanceSummary } from "@/utils/finance";

function batchCode(batch: Batch): string {
  const match = batch.match(/\d+/);
  return match ? match[0] : "00";
}

/** Generates the next sequential demo Training Session ID for a batch, e.g. TRN-B14-0002. */
export function generateSessionId(batch: Batch, existingSessions: TrainingSession[]): string {
  const code = batchCode(batch);
  const prefix = `TRN-B${code}-`;
  const count = existingSessions.filter((s) => s.sessionId.startsWith(prefix)).length;
  const nextSeq = String(count + 1).padStart(4, "0");
  return `${prefix}${nextSeq}`;
}

/** Generates the next sequential demo Certificate ID for a batch, e.g. CERT-B14-000001. */
export function generateCertificateId(batch: Batch, existingCertificates: CertificateRecord[]): string {
  const code = batchCode(batch);
  const prefix = `CERT-B${code}-`;
  const count = existingCertificates.filter((c) => c.certificateId.startsWith(prefix)).length;
  const nextSeq = String(count + 1).padStart(6, "0");
  return `${prefix}${nextSeq}`;
}

const ATTENDED_STATUSES = new Set(["Present", "Late", "Online Attended"]);

/**
 * Percentage (0-100) of the student's COMPLETED sessions they attended.
 * Excused entries are excluded from both sides of the ratio (neither help
 * nor hurt). Returns 0 when the student has no completed sessions yet.
 */
export function getStudentAttendanceRate(
  studentId: string,
  sessions: TrainingSession[],
  enrollments: SessionEnrollment[],
): number {
  const completedSessionIds = new Set(sessions.filter((s) => s.status === "Completed").map((s) => s.id));
  const relevant = enrollments.filter(
    (e) => e.studentId === studentId && completedSessionIds.has(e.sessionId) && e.attendanceStatus !== "Excused",
  );
  if (relevant.length === 0) return 0;
  const attended = relevant.filter((e) => ATTENDED_STATUSES.has(e.attendanceStatus)).length;
  return Math.round((attended / relevant.length) * 100);
}

export interface CertificateEligibilityResult {
  eligible: boolean;
  reasons: string[];
}

const NOT_ENROLLMENT_READY = new Set(["Pending Verification", "Incomplete Requirements", "On Hold"]);

/** Evaluates a student against the (configurable) certificate eligibility rules — see CertificateEligibilitySettings doc comment. */
export function computeCertificateEligibility(
  student: StudentRecord,
  sessions: TrainingSession[],
  enrollments: SessionEnrollment[],
  transactions: PaymentTransaction[],
  adjustments: PackageAdjustment[],
  settings: CertificateEligibilitySettings,
): CertificateEligibilityResult {
  const reasons: string[] = [];

  if (settings.requireConfirmedEnrollment && NOT_ENROLLMENT_READY.has(student.enrollmentStatus)) {
    reasons.push(`Enrollment status is "${student.enrollmentStatus}", not confirmed.`);
  }

  if (settings.requireRequirementsVerified && getRequirementsBucket(student) !== "Verified") {
    reasons.push("Requirements are not fully verified.");
  }

  if (settings.minAttendancePercent > 0) {
    const rate = getStudentAttendanceRate(student.id, sessions, enrollments);
    if (rate < settings.minAttendancePercent) {
      reasons.push(`Attendance is ${rate}%, below the required ${settings.minAttendancePercent}%.`);
    }
  }

  if (settings.requireFullyPaid) {
    const summary = getStudentFinanceSummary(student, transactions, adjustments);
    if (summary.status !== "Fully Paid") {
      reasons.push(`Payment status is "${summary.status}", not Fully Paid.`);
    }
  }

  return { eligible: reasons.length === 0, reasons };
}
