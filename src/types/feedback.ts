// M.A.I.A. Global Feedback & Testimonial System domain types — Step 9.
//
// Deliberately global, not nested inside Courses — see spec section 25.
// Backed by demo/local state — see src/data/feedbackStore.tsx.
//
// CRITICAL DISTINCTION (spec section 32): a FeedbackSubmission (private,
// for the Academy) and MarketingConsent (optional, separate permission to
// use it publicly) are never the same thing and are never merged. A
// student can submit feedback with zero marketing consent, and consent can
// later be withdrawn without deleting the historical consent record — see
// MarketingConsent.history below.

import type { Batch } from "@/types/student";

export type FeedbackSourceType =
  | "Free Webinar"
  | "Course"
  | "Module"
  | "Masterclass"
  | "Workshop"
  | "Face-to-Face Training"
  | "Zoom Training"
  | "Special Session"
  | "Full Program"
  | "Other";

export const FEEDBACK_SOURCE_TYPES: FeedbackSourceType[] = [
  "Free Webinar",
  "Course",
  "Module",
  "Masterclass",
  "Workshop",
  "Face-to-Face Training",
  "Zoom Training",
  "Special Session",
  "Full Program",
  "Other",
];

export type FeedbackRequestStatus = "Draft" | "Open" | "Closed";

/** A question shown on the feedback form — configurable per request, defaulting to the spec's suggested question bank (see src/data/feedbackConfig.ts). */
export interface FeedbackQuestion {
  id: string;
  text: string;
}

export interface FeedbackRequest {
  id: string;
  requestId: string; // e.g. FREQ-2026-000001
  title: string;
  sourceType: FeedbackSourceType;
  sourceId: string | null; // a Course.id / TrainingSession.id / MasterBrainSubmission-adjacent record, when applicable
  sourceLabel: string; // human-readable label snapshot (e.g. "Facebook Ads Masterclass")
  batch: Batch | "";
  audience: "All Eligible Students" | "Individual Student";
  audienceStudentId: string | null; // only set when audience === "Individual Student"
  message: string;
  questions: FeedbackQuestion[];
  allowWritten: boolean;
  allowVideo: boolean;
  incentiveId: string | null;
  openDate: string;
  closeDate: string | null;
  status: FeedbackRequestStatus;
  createdBy: string;
  createdAt: string;
}

export interface FeedbackAnswer {
  questionId: string;
  questionText: string; // snapshot, so an edited/deleted question never breaks history
  answer: string;
}

/**
 * Metadata-only — same rule as every "uploaded file" in this build. No real
 * video bytes are stored, and this must never be presented as securely
 * hosted (spec section 31/57).
 */
export interface VideoFeedbackAsset {
  fileName: string;
  fileSizeLabel: string;
  fileType: string;
  uploadedAt: string;
}

export type FeedbackReviewStatus = "Submitted" | "Reviewed" | "Approved for Marketing" | "Kept Private" | "Featured" | "Archived";

export const FEEDBACK_REVIEW_STATUSES: FeedbackReviewStatus[] = [
  "Submitted",
  "Reviewed",
  "Approved for Marketing",
  "Kept Private",
  "Featured",
  "Archived",
];

export interface FeedbackSubmission {
  id: string;
  feedbackId: string; // e.g. FDBK-2026-000001
  requestId: string | null; // null for an ad-hoc submission not tied to a specific request
  studentId: string;
  sourceType: FeedbackSourceType;
  sourceId: string | null;
  sourceLabel: string;
  batch: Batch;
  rating: number | null; // 1-5, optional
  writtenFeedback: string;
  videoAsset: VideoFeedbackAsset | null;
  answers: FeedbackAnswer[];
  status: FeedbackReviewStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  internalNotes: { id: string; text: string; author: string; timestamp: string }[];
  /** Internal organization tags (spec section 43) — never shown to the public, only inside the admin Marketing Library. */
  marketingTags: string[];
  incentiveId: string | null;
  submittedAt: string;
  lastSaved: string | null; // supports Save Draft before Submit
  isDraft: boolean;
}

export const MARKETING_PERMITTED_ASSETS = [
  "Written Feedback",
  "Video Feedback",
  "First Name",
  "Full Name",
  "Business Name",
  "Profile Photo",
] as const;

export type MarketingPermittedAsset = (typeof MARKETING_PERMITTED_ASSETS)[number];

export type MarketingConsentStatus = "Granted" | "Withdrawn";

/** One point-in-time change to a consent record — appended, never overwritten, so the historical record always survives a withdrawal (spec section 33). */
export interface MarketingConsentHistoryEntry {
  status: MarketingConsentStatus;
  date: string;
  permittedAssets: MarketingPermittedAsset[];
}

export interface MarketingConsent {
  id: string;
  consentId: string; // e.g. CONS-2026-000001
  feedbackId: string;
  studentId: string;
  status: MarketingConsentStatus;
  consentDate: string;
  consentVersion: string;
  permittedAssets: MarketingPermittedAsset[];
  history: MarketingConsentHistoryEntry[];
}

export const CURRENT_CONSENT_VERSION = "v1.0";

/** Placeholder wording only — spec section 33 explicitly requires the Academy's legal adviser to approve final consent wording before production. */
export const MARKETING_CONSENT_STATEMENT =
  "I give M.A.I.A. permission to use the testimonial I submitted, together with the selected identifying information below, for marketing and promotional purposes.";

export type IncentiveDeliveryType =
  | "Bonus Course"
  | "PDF"
  | "Template"
  | "Checklist"
  | "Prompt Pack"
  | "Recorded Training"
  | "Digital Resource"
  | "Coupon / Offer"
  | "Other";

export const INCENTIVE_DELIVERY_TYPES: IncentiveDeliveryType[] = [
  "Bonus Course",
  "PDF",
  "Template",
  "Checklist",
  "Prompt Pack",
  "Recorded Training",
  "Digital Resource",
  "Coupon / Offer",
  "Other",
];

export type FeedbackIncentiveStatus = "Active" | "Inactive";

/**
 * The reward is for SUBMITTING genuine feedback — never for a positive
 * rating (spec section 34). Nothing in this shape or in
 * feedbackStore.redeemIncentive() checks rating/sentiment before unlocking.
 */
export interface FeedbackIncentive {
  id: string;
  name: string;
  description: string;
  eligibility: string;
  sourceTypeFilter: FeedbackSourceType | "Any";
  deliveryType: IncentiveDeliveryType;
  bonusCourseId: string | null; // only set when deliveryType === "Bonus Course"
  resourceFileMeta: { fileName: string; fileSizeLabel: string; fileType: string } | null; // metadata only, honestly empty if no real file exists
  status: FeedbackIncentiveStatus;
  createdAt: string;
}

/** Internal marketing-organization tags (spec section 43) — never shown to the public, only inside the admin Marketing Library. */
export const MARKETING_TAGS = [
  "Importation",
  "Beginner",
  "Business Growth",
  "Facebook Ads",
  "AI",
  "Automation",
  "Supplier Sourcing",
  "Masterclass",
  "Student Experience",
  "Training Experience",
  "Video Testimonial",
  "Strong Transformation",
] as const;

/**
 * Configurable automatic feedback-request triggers (spec section 28) — all
 * must be admin-toggleable, never permanently hard-coded. "On Course
 * Completed" defaults on since course completion already exists in this
 * build (src/data/lmsStore.tsx); the others default off until their
 * underlying "completed" event exists to trigger them. Free Webinar is
 * intentionally prepared as a source type only — spec section 48 says not
 * to build the full webinar lead system in Step 9.
 */
export interface FeedbackAutomationSettings {
  onCourseCompleted: boolean;
  onTrainingCompleted: boolean;
  onMasterclassCompleted: boolean;
  onFreeWebinarAttended: boolean;
  onFullProgramCompleted: boolean;
}

export const DEFAULT_FEEDBACK_AUTOMATION_SETTINGS: FeedbackAutomationSettings = {
  onCourseCompleted: true,
  onTrainingCompleted: false,
  onMasterclassCompleted: false,
  onFreeWebinarAttended: false,
  onFullProgramCompleted: false,
};

export type IncentiveDeliveryStatus = "Unlocked" | "Delivered";

export interface IncentiveRedemption {
  id: string;
  incentiveId: string;
  studentId: string;
  feedbackSubmissionId: string;
  unlockedAt: string;
  deliveryStatus: IncentiveDeliveryStatus;
  deliveredAt: string | null;
}
