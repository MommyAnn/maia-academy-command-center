// Task Management domain types for Step 5 (Staff, Task Management &
// Operations System). Backed by demo/local state — see src/data/taskStore.tsx.
//
// Data integrity rules enforced by the store (not just the UI):
//   - Every task gets a unique, sequential ID (e.g. TASK-2026-000001).
//   - Completed tasks are never permanently deleted — only Cancelled/Archived.
//   - Automatically-created tasks carry an `autoTriggerKey` so the same
//     real-world event (e.g. one student's payment needing verification)
//     never creates a duplicate task.

import type { Batch } from "@/types/student";

export type TaskCategory =
  | "Enrollment"
  | "Payment Verification"
  | "Requirements"
  | "Taobao"
  | "Master Brain"
  | "Training"
  | "Certificates"
  | "Inventory"
  | "Marketing"
  | "Event Prep"
  | "Courses"
  | "Feedback"
  | "Free Webinar"
  | "Communications"
  | "General";

export const TASK_CATEGORIES: TaskCategory[] = [
  "Enrollment",
  "Payment Verification",
  "Requirements",
  "Taobao",
  "Master Brain",
  "Training",
  "Certificates",
  "Inventory",
  "Marketing",
  "Event Prep",
  "Courses",
  "Feedback",
  "Free Webinar",
  "Communications",
  "General",
];

export type TaskPriority = "Urgent" | "High" | "Medium" | "Low";

export const TASK_PRIORITIES: TaskPriority[] = ["Urgent", "High", "Medium", "Low"];

export type TaskStatus = "To Do" | "In Progress" | "For Review" | "Completed" | "Blocked" | "Cancelled";

export const TASK_STATUSES: TaskStatus[] = ["To Do", "In Progress", "For Review", "Completed", "Blocked", "Cancelled"];

export type TaskSource = "Manual" | "Automatic" | "Template";

export interface TaskChecklistItem {
  id: string;
  label: string;
  done: boolean;
}

export interface TaskComment {
  id: string;
  author: string;
  text: string;
  timestamp: string;
}

/**
 * Metadata about a file attached to a task. Same rule as everywhere else in
 * this build: no real, secure file storage backend exists yet, so only
 * lightweight metadata is kept — never the raw file bytes.
 */
export interface TaskAttachmentMeta {
  fileName: string;
  fileSizeLabel: string;
  fileType: string;
  uploadedAt: string;
}

export interface TaskRecord {
  id: string; // e.g. TASK-2026-000001
  title: string;
  description: string;
  category: TaskCategory;
  priority: TaskPriority;
  status: TaskStatus;
  assignedTo: string; // StaffRecord.id
  assignedToName: string;
  createdBy: string;
  relatedStudentId: string | null;
  relatedStudentName: string | null;
  relatedBatch: Batch | null;
  /** Set only for tasks triggered by a Free Webinar Lead (spec section 27, Step 10) — a Lead isn't a Student, so it gets its own reference. */
  relatedLeadId: string | null;
  relatedLeadName: string | null;
  dueDate: string; // yyyy-mm-dd
  createdAt: string;
  startedAt: string | null;
  sentForReviewAt: string | null;
  completedAt: string | null;
  blockedReason: string | null;
  cancelledReason: string | null;
  checklist: TaskChecklistItem[];
  comments: TaskComment[];
  attachments: TaskAttachmentMeta[];
  source: TaskSource;
  /** Present only on Source === "Automatic" tasks — used to prevent duplicate auto-creation and to auto-complete once the trigger condition resolves. */
  autoTriggerKey: string | null;
  templateId: string | null;
  reviewedBy: string | null;
  reviewNotes: string | null;
}

export interface TaskTemplateItem {
  title: string;
  description: string;
  category: TaskCategory;
  priority: TaskPriority;
  daysFromNow: number;
  checklist: string[];
}

export interface TaskTemplate {
  id: string;
  name: string;
  description: string;
  items: TaskTemplateItem[];
}

/**
 * Prepared, reusable Automation Rule shape — architecture only. This build's
 * automatic task creation runs on hardcoded trigger checks (see
 * src/data/taskStore.tsx) rather than a rules engine, but the shape below is
 * what a future "Automation Rules" settings page would read/write so no
 * component code needs to change when that page is built.
 */
export interface AutomationRule {
  id: string;
  label: string;
  triggerEvent: string;
  categoryCreated: TaskCategory;
  enabled: boolean;
  description: string;
}
