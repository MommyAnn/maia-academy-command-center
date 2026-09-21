// Configuration + demo seed data for the Global Feedback & Testimonial
// System (Step 9). Seed records are looked up by a student's stable display
// ID (StudentRecord.studentId) rather than their internal id — see the
// matching note in src/data/masterBrainConfig.ts for why.

import type {
  FeedbackIncentive,
  FeedbackQuestion,
  FeedbackRequest,
  FeedbackSubmission,
  IncentiveRedemption,
  MarketingConsent,
} from "@/types/feedback";
import { CURRENT_CONSENT_VERSION } from "@/types/feedback";
import { DEMO_STUDENTS } from "@/data/demoStudents";
import { COURSE_IMPORTATION, COURSE_AI_CREATIVE } from "@/data/lmsConfig";

export const CURRENT_DEMO_USER = "Mommy Ann";

function findStudentId(studentDisplayId: string): string {
  const student = DEMO_STUDENTS.find((s) => s.studentId === studentDisplayId);
  if (!student) throw new Error(`Demo student not found: ${studentDisplayId}`);
  return student.id;
}

// ---------------------------------------------------------------------------
// Suggested question bank (spec section 29) — a starting point copied onto
// every new FeedbackRequest, then fully editable per-request.
// ---------------------------------------------------------------------------
export const DEFAULT_QUESTION_BANK: FeedbackQuestion[] = [
  { id: "q-experience", text: "How was your overall experience?" },
  { id: "q-learned", text: "What did you learn?" },
  { id: "q-valuable", text: "What was most valuable to you?" },
  { id: "q-apply", text: "How will you apply what you learned?" },
  { id: "q-liked", text: "What did you like most?" },
  { id: "q-improve", text: "What could we improve?" },
  { id: "q-recommend", text: "Would you recommend this to others? Why or why not?" },
];

export function cloneDefaultQuestions(): FeedbackQuestion[] {
  return DEFAULT_QUESTION_BANK.map((q) => ({ ...q, id: `${q.id}-${crypto.randomUUID().slice(0, 8)}` }));
}

// ---------------------------------------------------------------------------
// Demo Feedback Requests
// ---------------------------------------------------------------------------
function request(input: Omit<FeedbackRequest, "id" | "questions" | "createdBy" | "createdAt"> & { questions?: FeedbackQuestion[] }): FeedbackRequest {
  return {
    ...input,
    id: crypto.randomUUID(),
    questions: input.questions ?? cloneDefaultQuestions(),
    createdBy: CURRENT_DEMO_USER,
    createdAt: "2026-09-01T09:00:00+08:00",
  };
}

export const REQUEST_FB_MASTERCLASS = request({
  requestId: "FREQ-2026-000001",
  title: "Facebook Ads Masterclass — Share Your Experience",
  sourceType: "Masterclass",
  sourceId: null,
  sourceLabel: "Facebook Ads Masterclass",
  batch: "Batch 14",
  audience: "All Eligible Students",
  audienceStudentId: null,
  message: "You just finished the Facebook Ads Masterclass! We'd love to hear how it went.",
  allowWritten: true,
  allowVideo: true,
  incentiveId: null, // linked below once the incentive is created
  openDate: "2026-09-01T09:00:00+08:00",
  closeDate: null,
  status: "Open",
});

export const REQUEST_IMPORTATION_COURSE = request({
  requestId: "FREQ-2026-000002",
  title: "Importation Foundation — Course Feedback",
  sourceType: "Course",
  sourceId: COURSE_IMPORTATION.id,
  sourceLabel: COURSE_IMPORTATION.title,
  batch: "",
  audience: "All Eligible Students",
  audienceStudentId: null,
  message: "Congratulations on completing Importation Foundation! Please share your feedback.",
  allowWritten: true,
  allowVideo: true,
  incentiveId: null,
  openDate: "2026-08-15T09:00:00+08:00",
  closeDate: null,
  status: "Open",
});

export const REQUEST_ZOOM_TRAINING_B13 = request({
  requestId: "FREQ-2026-000003",
  title: "Batch 13 Zoom Training — Feedback",
  sourceType: "Zoom Training",
  sourceId: null,
  sourceLabel: "Batch 13 Weekly Zoom Training",
  batch: "Batch 13",
  audience: "All Eligible Students",
  audienceStudentId: null,
  message: "Thanks for attending! A quick round of feedback helps us improve future sessions.",
  allowWritten: true,
  allowVideo: false,
  incentiveId: null,
  openDate: "2026-07-01T09:00:00+08:00",
  closeDate: "2026-07-15T09:00:00+08:00",
  status: "Closed",
});

export const DEMO_FEEDBACK_REQUESTS: FeedbackRequest[] = [
  REQUEST_FB_MASTERCLASS,
  REQUEST_IMPORTATION_COURSE,
  REQUEST_ZOOM_TRAINING_B13,
];

// ---------------------------------------------------------------------------
// Demo Incentives
// ---------------------------------------------------------------------------
function incentive(input: Omit<FeedbackIncentive, "id" | "createdAt">): FeedbackIncentive {
  return { ...input, id: crypto.randomUUID(), createdAt: "2026-09-01T09:00:00+08:00" };
}

export const INCENTIVE_FB_MASTERCLASS = incentive({
  name: "Bonus: AI Creative Mastery Course",
  description: "Unlocked automatically for any student who submits feedback on the Facebook Ads Masterclass.",
  eligibility: "Submit written or video feedback for the Facebook Ads Masterclass — any rating qualifies.",
  sourceTypeFilter: "Masterclass",
  deliveryType: "Bonus Course",
  bonusCourseId: COURSE_AI_CREATIVE.id, // demo: grants a related bonus course, not the source itself
  resourceFileMeta: null,
  status: "Active",
});

export const INCENTIVE_IMPORTATION_COURSE = incentive({
  name: "Bonus: Supplier Outreach Script Pack",
  description: "A set of ready-to-send supplier outreach message templates.",
  eligibility: "Submit feedback for Importation Foundation — any rating qualifies.",
  sourceTypeFilter: "Course",
  deliveryType: "Template",
  bonusCourseId: null,
  resourceFileMeta: { fileName: "supplier-outreach-scripts.pdf", fileSizeLabel: "480 KB", fileType: "PDF" },
  status: "Active",
});

export const DEMO_FEEDBACK_INCENTIVES: FeedbackIncentive[] = [INCENTIVE_FB_MASTERCLASS, INCENTIVE_IMPORTATION_COURSE];

REQUEST_FB_MASTERCLASS.incentiveId = INCENTIVE_FB_MASTERCLASS.id;
REQUEST_IMPORTATION_COURSE.incentiveId = INCENTIVE_IMPORTATION_COURSE.id;

// ---------------------------------------------------------------------------
// Demo Feedback Submissions — one written (private only), one video (with
// marketing consent, approved), one negative/constructive (still qualifies
// for its incentive — spec section 34).
// ---------------------------------------------------------------------------
function submission(
  input: Omit<FeedbackSubmission, "id" | "answers" | "internalNotes" | "marketingTags" | "isDraft" | "lastSaved"> & {
    answers?: FeedbackSubmission["answers"];
  },
): FeedbackSubmission {
  return {
    ...input,
    id: crypto.randomUUID(),
    answers: input.answers ?? [],
    internalNotes: [],
    marketingTags: [],
    isDraft: false,
    lastSaved: input.submittedAt,
  };
}

// Maria Santos — written feedback only, no marketing consent (kept private).
export const SUBMISSION_MARIA_WRITTEN = submission({
  feedbackId: "FDBK-2026-000001",
  requestId: REQUEST_FB_MASTERCLASS.id,
  studentId: findStudentId("MAIA-B14-0001"),
  sourceType: "Masterclass",
  sourceId: null,
  sourceLabel: "Facebook Ads Masterclass",
  batch: "Batch 14",
  rating: 5,
  writtenFeedback:
    "The masterclass was incredibly clear and practical. I finally understand how to structure my campaigns instead of just guessing.",
  videoAsset: null,
  status: "Kept Private",
  reviewedBy: CURRENT_DEMO_USER,
  reviewedAt: "2026-09-06T10:00:00+08:00",
  incentiveId: INCENTIVE_FB_MASTERCLASS.id,
  submittedAt: "2026-09-05T15:00:00+08:00",
  answers: [
    { questionId: "q-experience", questionText: "How was your overall experience?", answer: "Excellent — clear and practical." },
    { questionId: "q-recommend", questionText: "Would you recommend this to others? Why or why not?", answer: "Yes, definitely." },
  ],
});

// Carlos Dizon — video feedback, marketing consent GRANTED and admin-approved: enters the Marketing Library.
export const SUBMISSION_CARLOS_VIDEO = submission({
  feedbackId: "FDBK-2026-000002",
  requestId: REQUEST_IMPORTATION_COURSE.id,
  studentId: findStudentId("MAIA-B14-0002"),
  sourceType: "Course",
  sourceId: COURSE_IMPORTATION.id,
  sourceLabel: COURSE_IMPORTATION.title,
  batch: "Batch 14",
  rating: 5,
  writtenFeedback: "",
  videoAsset: {
    fileName: "carlos-dizon-testimonial.mp4",
    fileSizeLabel: "42 MB",
    fileType: "video/mp4",
    uploadedAt: "2026-09-08T11:00:00+08:00",
  },
  status: "Approved for Marketing",
  reviewedBy: CURRENT_DEMO_USER,
  reviewedAt: "2026-09-09T09:00:00+08:00",
  incentiveId: INCENTIVE_IMPORTATION_COURSE.id,
  submittedAt: "2026-09-08T11:05:00+08:00",
});

// Bea Fernandez — constructive/critical feedback: still fully eligible for its incentive (spec section 34).
export const SUBMISSION_BEA_CONSTRUCTIVE = submission({
  feedbackId: "FDBK-2026-000003",
  requestId: REQUEST_IMPORTATION_COURSE.id,
  studentId: findStudentId("MAIA-B14-0003"),
  sourceType: "Course",
  sourceId: COURSE_IMPORTATION.id,
  sourceLabel: COURSE_IMPORTATION.title,
  batch: "Batch 14",
  rating: 3,
  writtenFeedback:
    "The content was good but Module 3 on customs documents felt rushed. I had to rewatch it a few times to understand the checklist.",
  videoAsset: null,
  status: "Reviewed",
  reviewedBy: CURRENT_DEMO_USER,
  reviewedAt: "2026-09-10T09:00:00+08:00",
  incentiveId: INCENTIVE_IMPORTATION_COURSE.id,
  submittedAt: "2026-09-09T20:00:00+08:00",
});

export const DEMO_FEEDBACK_SUBMISSIONS: FeedbackSubmission[] = [
  SUBMISSION_MARIA_WRITTEN,
  SUBMISSION_CARLOS_VIDEO,
  SUBMISSION_BEA_CONSTRUCTIVE,
];

// ---------------------------------------------------------------------------
// Marketing Consent — a separate, optional record from the submission
// itself (spec section 32). Only Carlos granted consent.
// ---------------------------------------------------------------------------
function consent(input: Omit<MarketingConsent, "id" | "history">): MarketingConsent {
  return {
    ...input,
    id: crypto.randomUUID(),
    history: [{ status: input.status, date: input.consentDate, permittedAssets: input.permittedAssets }],
  };
}

export const CONSENT_CARLOS = consent({
  consentId: "CONS-2026-000001",
  feedbackId: SUBMISSION_CARLOS_VIDEO.feedbackId,
  studentId: findStudentId("MAIA-B14-0002"),
  status: "Granted",
  consentDate: "2026-09-08T11:05:00+08:00",
  consentVersion: CURRENT_CONSENT_VERSION,
  permittedAssets: ["Video Feedback", "First Name", "Business Name"],
});

export const DEMO_MARKETING_CONSENTS: MarketingConsent[] = [CONSENT_CARLOS];

// ---------------------------------------------------------------------------
// Incentive Redemptions — the unlock/deliver loop from spec section 36.
// Submission-based only, never rating-based (Bea's constructive feedback
// still qualifies here, exactly like Carlos's 5-star one).
// ---------------------------------------------------------------------------
function redemption(input: Omit<IncentiveRedemption, "id">): IncentiveRedemption {
  return { ...input, id: crypto.randomUUID() };
}

export const DEMO_INCENTIVE_REDEMPTIONS: IncentiveRedemption[] = [
  // Maria — Bonus Course delivery type, delivered via a real CourseAccessGrant (see lmsConfig.ts).
  redemption({
    incentiveId: INCENTIVE_FB_MASTERCLASS.id,
    studentId: SUBMISSION_MARIA_WRITTEN.studentId,
    feedbackSubmissionId: SUBMISSION_MARIA_WRITTEN.id,
    unlockedAt: "2026-09-05T15:05:00+08:00",
    deliveryStatus: "Delivered",
    deliveredAt: "2026-09-06T09:00:00+08:00",
  }),
  // Carlos — resource-file delivery, metadata already exists so it's marked Delivered.
  redemption({
    incentiveId: INCENTIVE_IMPORTATION_COURSE.id,
    studentId: SUBMISSION_CARLOS_VIDEO.studentId,
    feedbackSubmissionId: SUBMISSION_CARLOS_VIDEO.id,
    unlockedAt: "2026-09-08T11:10:00+08:00",
    deliveryStatus: "Delivered",
    deliveredAt: "2026-09-08T11:10:00+08:00",
  }),
  // Bea — constructive/critical feedback still unlocks the same resource (spec section 34).
  redemption({
    incentiveId: INCENTIVE_IMPORTATION_COURSE.id,
    studentId: SUBMISSION_BEA_CONSTRUCTIVE.studentId,
    feedbackSubmissionId: SUBMISSION_BEA_CONSTRUCTIVE.id,
    unlockedAt: "2026-09-09T20:05:00+08:00",
    deliveryStatus: "Delivered",
    deliveredAt: "2026-09-09T20:05:00+08:00",
  }),
];
