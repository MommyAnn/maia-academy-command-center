import type { AttendanceStatus, CertificateStatus, TrainingSessionStatus } from "@/types/training";

type Tone = "success" | "warning" | "danger" | "info" | "neutral" | "gold";

export const SESSION_STATUS_TONE: Record<TrainingSessionStatus, Tone> = {
  Draft: "neutral",
  Scheduled: "info",
  Ongoing: "gold",
  Completed: "success",
  Cancelled: "danger",
};

export const ATTENDANCE_STATUS_TONE: Record<AttendanceStatus, Tone> = {
  Registered: "neutral",
  Present: "success",
  Late: "warning",
  Absent: "danger",
  Excused: "info",
  "Online Attended": "success",
};

export const CERTIFICATE_STATUS_TONE: Record<CertificateStatus, Tone> = {
  "Not Eligible": "neutral",
  Eligible: "info",
  "For Preparation": "warning",
  Ready: "gold",
  Issued: "success",
  Reissued: "info",
};
