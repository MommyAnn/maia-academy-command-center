// Global Feedback & Testimonial System calculation helpers — Step 9.

import type {
  FeedbackIncentive,
  FeedbackRequest,
  FeedbackSourceType,
  FeedbackSubmission,
  MarketingConsent,
} from "@/types/feedback";

function currentYear(): string {
  return String(new Date().getFullYear());
}

/** Generates the next sequential year-scoped demo Feedback Request ID, e.g. FREQ-2026-000001. */
export function generateFeedbackRequestId(existing: FeedbackRequest[]): string {
  const year = currentYear();
  const prefix = `FREQ-${year}-`;
  const count = existing.filter((r) => r.requestId.startsWith(prefix)).length;
  return `${prefix}${String(count + 1).padStart(6, "0")}`;
}

/** Generates the next sequential year-scoped demo Feedback Submission ID, e.g. FDBK-2026-000001. */
export function generateFeedbackId(existing: FeedbackSubmission[]): string {
  const year = currentYear();
  const prefix = `FDBK-${year}-`;
  const count = existing.filter((f) => f.feedbackId.startsWith(prefix)).length;
  return `${prefix}${String(count + 1).padStart(6, "0")}`;
}

/** Generates the next sequential year-scoped demo Marketing Consent ID, e.g. CONS-2026-000001. */
export function generateConsentId(existing: MarketingConsent[]): string {
  const year = currentYear();
  const prefix = `CONS-${year}-`;
  const count = existing.filter((c) => c.consentId.startsWith(prefix)).length;
  return `${prefix}${String(count + 1).padStart(6, "0")}`;
}

/**
 * Prevents duplicate feedback requests for the same person/source (spec
 * section 28). A student already has an open or submitted request for this
 * exact source when either an open FeedbackRequest already targets them
 * (or "All Eligible Students") for this source, or they've already
 * submitted feedback for it.
 */
export function hasExistingFeedbackRequest(
  studentId: string,
  sourceType: FeedbackSourceType,
  sourceId: string | null,
  requests: FeedbackRequest[],
  submissions: FeedbackSubmission[],
): boolean {
  const alreadySubmitted = submissions.some(
    (s) => s.studentId === studentId && s.sourceType === sourceType && s.sourceId === sourceId && !s.isDraft,
  );
  if (alreadySubmitted) return true;

  return requests.some(
    (r) =>
      r.sourceType === sourceType &&
      r.sourceId === sourceId &&
      r.status === "Open" &&
      (r.audience === "All Eligible Students" || r.audienceStudentId === studentId),
  );
}

/**
 * A submission qualifies a student for the linked incentive purely by
 * having been genuinely submitted — never by rating or sentiment (spec
 * section 34). This is intentionally the ONLY gate: no positive-rating or
 * "recommend" check belongs here or in any caller.
 */
export function isEligibleForIncentive(submission: FeedbackSubmission, incentive: FeedbackIncentive): boolean {
  if (incentive.status !== "Active") return false;
  if (submission.isDraft) return false;
  if (incentive.sourceTypeFilter !== "Any" && incentive.sourceTypeFilter !== submission.sourceType) return false;
  const hasWritten = submission.writtenFeedback.trim().length > 0;
  const hasVideo = Boolean(submission.videoAsset);
  return hasWritten || hasVideo;
}

/** A testimonial may enter the Marketing Library ONLY with both admin approval AND a currently-Granted consent (spec sections 32/40/41). */
export function isEligibleForMarketingLibrary(submission: FeedbackSubmission, consent: MarketingConsent | undefined): boolean {
  return submission.status === "Approved for Marketing" && Boolean(consent) && consent!.status === "Granted";
}
