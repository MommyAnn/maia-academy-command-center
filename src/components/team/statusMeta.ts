import type { TaskCategory, TaskPriority, TaskStatus } from "@/types/task";
import type { StaffAccountStatus } from "@/types/staff";

type Tone = "success" | "warning" | "danger" | "info" | "neutral" | "gold";

export const TASK_STATUS_TONE: Record<TaskStatus, Tone> = {
  "To Do": "neutral",
  "In Progress": "info",
  "For Review": "gold",
  Completed: "success",
  Blocked: "danger",
  Cancelled: "neutral",
};

export const TASK_PRIORITY_TONE: Record<TaskPriority, Tone> = {
  Urgent: "danger",
  High: "warning",
  Medium: "info",
  Low: "neutral",
};

export const TASK_CATEGORY_TONE: Record<TaskCategory, Tone> = {
  Enrollment: "gold",
  "Payment Verification": "warning",
  Requirements: "info",
  Taobao: "info",
  "Master Brain": "gold",
  Training: "success",
  Certificates: "success",
  Inventory: "neutral",
  Marketing: "neutral",
  "Event Prep": "warning",
  General: "neutral",
};

export const STAFF_STATUS_TONE: Record<StaffAccountStatus, Tone> = {
  Active: "success",
  Inactive: "neutral",
  Suspended: "danger",
};
