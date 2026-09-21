// Student Management domain types for Step 2 (Enrollment Form, Student
// Records, Student Profile). These describe the shapes the UI expects.
// Backed by demo/local state for now — see src/data/studentStore.tsx.

export type Batch = "Batch 14" | "Batch 13" | "Batch 12";

export type PackageType = "Premium" | "VIP" | "Dual VIP";

export type AttendancePreference = "Face-to-Face" | "Early Access via Zoom" | "Both";

export type EnrollmentStatus =
  | "Pending Verification"
  | "Confirmed Student"
  | "Incomplete Requirements"
  | "Active Student"
  | "Completed"
  | "On Hold";

export type PaymentStatus =
  | "Fully Paid"
  | "Partial Payment"
  | "Reservation Paid"
  | "Pending Verification"
  | "Unpaid";

export type DocumentReviewStatus = "Pending" | "Verified" | "Needs Resubmission";

export type RequirementsSummary = "For Verification" | "Verified" | "Needs Resubmission";

export type TaobaoStatus =
  | "Not Yet Created"
  | "For Account Creation"
  | "Login Details Ready"
  | "Login Details Given to Student";

// Expanded for Step 8 (Brand Master Brain Builder) — see src/types/masterBrain.ts
// for the full questionnaire/document data model this status heads up. Kept
// on StudentRecord (rather than only inside the Master Brain store) since
// existing Step 2/4/5 code already reads/filters on this single field.
export type MasterBrainStatus =
  | "Not Started"
  | "In Progress"
  | "Submitted"
  | "Under Review"
  | "Needs Revision"
  | "Approved for Generation"
  | "Generating"
  | "Draft Ready"
  | "Final Review"
  | "Completed"
  | "Published";

/**
 * Metadata about a file the student "uploaded" during enrollment.
 * IMPORTANT: no real, secure file storage backend exists yet. Only
 * lightweight metadata (name/size/type/timestamp) is kept — never the raw
 * file bytes — so nothing here should be presented as securely stored.
 */
export interface UploadedFileMeta {
  fileName: string;
  fileSizeLabel: string;
  fileType: string;
  uploadedAt: string;
}

export interface DocumentRequirement {
  status: DocumentReviewStatus;
  file: UploadedFileMeta | null;
  /** Student-facing explanation of why a document needs resubmission — set by the reviewing admin, cleared on Verified or a new submission. Optional so existing demo records without it still type-check. */
  note?: string;
}

export interface AdminNote {
  id: string;
  text: string;
  author: string;
  timestamp: string;
}

export interface StudentActivityEntry {
  id: string;
  action: string;
  date: string;
  time: string;
  user: string;
}

export interface TaobaoDetails {
  status: TaobaoStatus;
  username: string;
  dateCreated: string | null;
  dateGiven: string | null;
  adminNotes: string;
}

/**
 * The ORIGINAL package price only. Do not add an "amount paid" or "status"
 * field here — those are never stored directly. They are always calculated
 * from the verified PaymentTransaction ledger (see src/utils/finance.ts),
 * so a single number can never be edited out of sync with real payments.
 */
export interface PackagePricing {
  packagePrice: number;
}

export interface StudentRecord {
  id: string;
  studentId: string;

  // Personal Information
  facebookName: string;
  fullName: string;
  companionName: string;
  email: string;
  contactNumber: string;
  city: string;

  // Enrollment
  batch: Batch;
  package: PackageType;
  attendance: AttendancePreference;
  enrollmentDate: string;
  enrollmentStatus: EnrollmentStatus;
  dateSubmitted: string;

  // Requirements
  validId: DocumentRequirement;
  proofOfPayment: DocumentRequirement;

  // Payment (original pricing only — see PackagePricing doc comment)
  payment: PackagePricing;

  // Taobao
  taobao: TaobaoDetails;

  // Master Brain (display only in Step 2)
  masterBrainStatus: MasterBrainStatus;

  // Terms & Conditions
  termsAccepted: boolean;
  termsAcceptedDate: string | null;
  termsVersion: string;

  // Admin
  adminNotes: AdminNote[];
  activity: StudentActivityEntry[];
}

/** Shape submitted by the public Enrollment Form. */
export interface EnrollmentSubmission {
  facebookName: string;
  fullName: string;
  companionName: string;
  email: string;
  contactNumber: string;
  city: string;
  batch: Batch;
  package: PackageType;
  attendance: AttendancePreference;
  validIdFile: UploadedFileMeta | null;
  proofOfPaymentFile: UploadedFileMeta | null;
  termsAccepted: boolean;
  termsVersion: string;
}
