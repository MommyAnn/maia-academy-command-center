import type { JourneyStepStatus } from "@/utils/portal";
import type { SupportStatus, UpdateRequestStatus } from "@/types/portal";

type Tone = "success" | "warning" | "danger" | "info" | "neutral" | "gold";

export const JOURNEY_STEP_STATUS_TONE: Record<JourneyStepStatus, Tone> = {
  Completed: "success",
  "In Progress": "info",
  Pending: "warning",
  "Needs Action": "danger",
  "Not Started": "neutral",
};

export const UPDATE_REQUEST_STATUS_TONE: Record<UpdateRequestStatus, Tone> = {
  Pending: "warning",
  Approved: "success",
  Rejected: "danger",
};

export const SUPPORT_STATUS_TONE: Record<SupportStatus, Tone> = {
  Open: "warning",
  "In Progress": "info",
  "Waiting for Student": "gold",
  Resolved: "success",
  Closed: "neutral",
};
