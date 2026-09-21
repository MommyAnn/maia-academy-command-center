// Training, Attendance & Certificate domain types for Step 6. Backed by
// demo/local state — see src/data/trainingStore.tsx.

import type { Batch, UploadedFileMeta } from "@/types/student";

export type TrainingType =
  | "Face-to-Face"
  | "Early Access Zoom"
  | "Masterclass"
  | "Workshop"
  | "Orientation"
  | "Special Session"
  | "Other";

export const TRAINING_TYPES: TrainingType[] = [
  "Face-to-Face",
  "Early Access Zoom",
  "Masterclass",
  "Workshop",
  "Orientation",
  "Special Session",
  "Other",
];

export function isOnlineTrainingType(type: TrainingType): boolean {
  return type === "Early Access Zoom";
}

export type TrainingSessionStatus = "Draft" | "Scheduled" | "Ongoing" | "Completed" | "Cancelled";

export const TRAINING_SESSION_STATUSES: TrainingSessionStatus[] = [
  "Draft",
  "Scheduled",
  "Ongoing",
  "Completed",
  "Cancelled",
];

/** A required material line for a specific session (spec section 11) — informational planning only, never an automatic stock deduction. */
export interface SessionMaterialLine {
  itemId: string;
  quantity: number;
}

export interface TrainingSession {
  id: string;
  sessionId: string; // e.g. TRN-B14-0001
  title: string;
  type: TrainingType;
  batch: Batch;
  date: string; // yyyy-mm-dd
  startTime: string;
  endTime: string;
  // Face-to-Face fields
  venueName: string;
  venueAddress: string;
  capacity: number | null;
  // Online fields — visibility of these is a UI/permission concern, not enforced here (see PermissionsMatrixView notice)
  platform: string;
  zoomLink: string;
  meetingId: string;
  passcode: string;
  trainer: string;
  assignedStaffIds: string[];
  materials: SessionMaterialLine[];
  description: string;
  status: TrainingSessionStatus;
  notes: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type AttendanceStatus = "Registered" | "Present" | "Late" | "Absent" | "Excused" | "Online Attended";

export const ATTENDANCE_STATUSES: AttendanceStatus[] = [
  "Registered",
  "Present",
  "Late",
  "Absent",
  "Excused",
  "Online Attended",
];

export type SessionEligibility = "Eligible" | "Not Eligible" | "Pending Review";

/**
 * One student's entry on a training session's roster. Removing a student
 * from a session only deletes this roster row — never the student's
 * Academy record (spec section 13).
 */
export interface SessionEnrollment {
  id: string;
  sessionId: string; // TrainingSession.id
  studentId: string; // StudentRecord.id
  eligibility: SessionEligibility;
  attendanceStatus: AttendanceStatus;
  checkInTime: string | null;
  checkOutTime: string | null;
  recordedBy: string | null;
  recordedAt: string | null;
  notes: string;
  addedAt: string;
}

export type CertificateStatus = "Not Eligible" | "Eligible" | "For Preparation" | "Ready" | "Issued" | "Reissued";

export const CERTIFICATE_STATUSES: CertificateStatus[] = [
  "Not Eligible",
  "Eligible",
  "For Preparation",
  "Ready",
  "Issued",
  "Reissued",
];

export interface CertificateRecord {
  id: string;
  certificateId: string; // e.g. CERT-B14-000001
  studentId: string;
  batch: Batch;
  program: string;
  certificateType: string;
  completionDate: string | null;
  issueDate: string | null;
  status: CertificateStatus;
  file: UploadedFileMeta | null;
  preparedBy: string | null;
  preparedAt: string | null;
  issuedBy: string | null;
  issuedAt: string | null;
  notes: string;
  /** Set when this record is a reissue — points at the original certificate's id. The original is never erased. */
  reissueOfId: string | null;
  createdAt: string;
}

/**
 * Configurable certificate eligibility rules (spec section 20) — Owner/Admin
 * editable, never one permanently hard-coded rule. `minAttendancePercent`
 * of 0 disables that check. Payment status is intentionally off by default
 * — the Academy must explicitly turn it on.
 */
export interface CertificateEligibilitySettings {
  requireConfirmedEnrollment: boolean;
  requireRequirementsVerified: boolean;
  minAttendancePercent: number;
  requireFullyPaid: boolean;
}

export const DEFAULT_ELIGIBILITY_SETTINGS: CertificateEligibilitySettings = {
  requireConfirmedEnrollment: true,
  requireRequirementsVerified: true,
  minAttendancePercent: 80,
  requireFullyPaid: false,
};
