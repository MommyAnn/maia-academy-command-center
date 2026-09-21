// Student Portal support domain types for Step 7 — announcements, support
// requests, profile/enrollment update requests, and portal access records.
// Backed by demo/local state — see src/data/portalStore.tsx.
//
// These are intentionally kept separate from StudentRecord itself (Step 2)
// rather than bolted onto it, so the Student Portal reads/writes through
// its own small store while still treating StudentRecord as the one
// source of truth for enrollment/payment/requirements/Taobao/Master Brain
// data — see the doc comment on PortalAccessRecord below for why it exists
// as its own record instead.

export type AnnouncementAudienceType =
  | "All Students"
  | "Batch"
  | "Package"
  | "Face-to-Face"
  | "Zoom"
  | "Both"
  | "Individual Student";

export const ANNOUNCEMENT_AUDIENCE_TYPES: AnnouncementAudienceType[] = [
  "All Students",
  "Batch",
  "Package",
  "Face-to-Face",
  "Zoom",
  "Both",
  "Individual Student",
];

export interface Announcement {
  id: string;
  title: string;
  message: string;
  audienceType: AnnouncementAudienceType;
  /** Batch name / Package name / StudentRecord.id — only set when audienceType needs it. */
  audienceValue: string | null;
  pinned: boolean;
  important: boolean;
  attachmentLabel: string;
  attachmentUrl: string;
  createdBy: string;
  createdAt: string;
  date: string;
}

export type SupportCategory =
  | "Enrollment"
  | "Payment"
  | "Taobao"
  | "Master Brain"
  | "Training"
  | "Certificate"
  | "Technical";

export const SUPPORT_CATEGORIES: SupportCategory[] = [
  "Enrollment",
  "Payment",
  "Taobao",
  "Master Brain",
  "Training",
  "Certificate",
  "Technical",
];

export type SupportStatus = "Open" | "In Progress" | "Waiting for Student" | "Resolved" | "Closed";

export const SUPPORT_STATUSES: SupportStatus[] = ["Open", "In Progress", "Waiting for Student", "Resolved", "Closed"];

export interface SupportRequest {
  id: string;
  supportId: string; // e.g. SUP-000001
  studentId: string;
  category: SupportCategory;
  subject: string;
  message: string;
  status: SupportStatus;
  assignedStaffId: string | null;
  createdAt: string;
  updatedAt: string;
}

export type UpdateRequestStatus = "Pending" | "Approved" | "Rejected";

export const UPDATE_REQUEST_STATUSES: UpdateRequestStatus[] = ["Pending", "Approved", "Rejected"];

/**
 * A single-field change request (used by both My Enrollment's and My
 * Profile's "REQUEST UPDATE" actions). `field` is a human-readable label
 * (e.g. "Contact Number", "Batch") rather than a strict enum, since the two
 * pages cover different field sets — Admin approval is what actually
 * changes the verified StudentRecord, never this record itself.
 */
export interface UpdateRequest {
  id: string;
  requestId: string; // e.g. PUR-000001
  studentId: string;
  field: string;
  oldValue: string;
  newValue: string;
  reason: string;
  status: UpdateRequestStatus;
  createdAt: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNotes: string;
}

/**
 * Portal login/activation state for one student. Kept separate from
 * StudentRecord (rather than adding fields to it) because this is
 * account/session metadata, not Academy enrollment data — a real backend
 * would likely model this as a separate "user account" table linked by
 * student id, so this mirrors that shape now.
 */
export interface PortalAccessRecord {
  studentId: string;
  activated: boolean;
  accessCreatedDate: string | null;
  lastLogin: string | null;
  instructionsSentAt: string | null;
}

// NOTE: Course/CourseAccessRule/CourseAccessGrant used to live here as a
// Step 7 stub ("prepare access rules, not a full LMS yet"). Step 9 builds
// the complete Course/Module/Lesson/CourseAccess system — see
// src/types/lms.ts — which fully supersedes this stub. The old fields were
// never wired to any admin action (no UI ever called grantCourseAccess),
// so removing them here breaks nothing.

/**
 * Save & Continue Later architecture for Master Brain (spec section 15).
 * This is NOT the questionnaire itself — there are no answers here yet,
 * only the progress metadata a future full questionnaire would read/write.
 */
export interface MasterBrainProgress {
  studentId: string;
  submissionId: string;
  businessBrand: string;
  questionnaireVersion: string;
  progressPercent: number;
  lastSaved: string | null;
}
