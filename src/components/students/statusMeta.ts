import type {
  DocumentReviewStatus,
  EnrollmentStatus,
  MasterBrainStatus,
  PaymentStatus,
  RequirementsSummary,
  TaobaoStatus,
} from "@/types/student";

type Tone = "success" | "warning" | "danger" | "info" | "neutral" | "gold";

export const ENROLLMENT_STATUS_TONE: Record<EnrollmentStatus, Tone> = {
  "Pending Verification": "warning",
  "Confirmed Student": "success",
  "Incomplete Requirements": "danger",
  "Active Student": "info",
  Completed: "gold",
  "On Hold": "neutral",
};

export const PAYMENT_STATUS_TONE: Record<PaymentStatus, Tone> = {
  "Fully Paid": "success",
  "Partial Payment": "warning",
  "Reservation Paid": "info",
  "Pending Verification": "warning",
  Unpaid: "danger",
};

export const DOCUMENT_STATUS_TONE: Record<DocumentReviewStatus, Tone> = {
  Pending: "warning",
  Verified: "success",
  "Needs Resubmission": "danger",
};

export const REQUIREMENTS_SUMMARY_TONE: Record<RequirementsSummary, Tone> = {
  "For Verification": "warning",
  Verified: "success",
  "Needs Resubmission": "danger",
};

export const TAOBAO_STATUS_TONE: Record<TaobaoStatus, Tone> = {
  "Not Yet Created": "neutral",
  "For Account Creation": "warning",
  "Login Details Ready": "info",
  "Login Details Given to Student": "success",
};

export const MASTER_BRAIN_STATUS_TONE: Record<MasterBrainStatus, Tone> = {
  "Not Started": "neutral",
  "In Progress": "info",
  Submitted: "warning",
  "Under Review": "gold",
  "Needs Revision": "danger",
  "Approved for Generation": "info",
  Generating: "info",
  "Draft Ready": "gold",
  "Final Review": "gold",
  Completed: "success",
  Published: "success",
};

export const ENROLLMENT_STATUS_OPTIONS: EnrollmentStatus[] = [
  "Pending Verification",
  "Confirmed Student",
  "Incomplete Requirements",
  "Active Student",
  "Completed",
  "On Hold",
];

export const TAOBAO_STATUS_OPTIONS: TaobaoStatus[] = [
  "Not Yet Created",
  "For Account Creation",
  "Login Details Ready",
  "Login Details Given to Student",
];

export const DOCUMENT_STATUS_OPTIONS: DocumentReviewStatus[] = ["Pending", "Verified", "Needs Resubmission"];
