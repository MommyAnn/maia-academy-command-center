// ID generation and aggregation helpers for Step 5 (Staff & Task
// Management). Kept separate from the stores/UI, same pattern as
// src/utils/studentId.ts and src/utils/finance.ts.

import type { StaffRecord } from "@/types/staff";
import type { TaskRecord, TaskStatus } from "@/types/task";

/** Generates the next sequential demo Staff ID, e.g. STAFF-000007. */
export function generateStaffId(existingStaff: StaffRecord[]): string {
  const nextSeq = String(existingStaff.length + 1).padStart(6, "0");
  return `STAFF-${nextSeq}`;
}

/** Generates the next sequential demo Task ID for the current year, e.g. TASK-2026-000001. */
export function generateTaskId(existingTasks: TaskRecord[]): string {
  const year = new Date().getFullYear();
  const prefix = `TASK-${year}-`;
  const count = existingTasks.filter((t) => t.id.startsWith(prefix)).length;
  const nextSeq = String(count + 1).padStart(6, "0");
  return `${prefix}${nextSeq}`;
}

export function isTaskActive(status: TaskStatus): boolean {
  return status === "To Do" || status === "In Progress" || status === "For Review" || status === "Blocked";
}

export function isTaskOverdue(task: TaskRecord, now: Date = new Date()): boolean {
  if (!isTaskActive(task.status)) return false;
  const due = new Date(`${task.dueDate}T23:59:59`);
  return due.getTime() < now.getTime();
}

export function isTaskDueToday(task: TaskRecord, now: Date = new Date()): boolean {
  if (!isTaskActive(task.status)) return false;
  const due = new Date(`${task.dueDate}T00:00:00`);
  return (
    due.getFullYear() === now.getFullYear() && due.getMonth() === now.getMonth() && due.getDate() === now.getDate()
  );
}

function isSameCalendarDay(iso: string, now: Date): boolean {
  const d = new Date(iso);
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

/**
 * Neutral, operational per-staff task load — counts only, never a score or
 * ranking. Do NOT add a "performance" or "rating" field here: the Workload
 * page this feeds is explicitly required to stay a capacity view, not a
 * leaderboard.
 */
export interface StaffWorkload {
  staffId: string;
  staffName: string;
  role: string;
  accountStatus: StaffRecord["accountStatus"];
  toDo: number;
  inProgress: number;
  forReview: number;
  blocked: number;
  overdue: number;
  dueToday: number;
  completedToday: number;
  totalActive: number;
}

export function getStaffWorkloads(staff: StaffRecord[], tasks: TaskRecord[]): StaffWorkload[] {
  const now = new Date();
  return staff
    .filter((s) => s.accountStatus !== "Suspended")
    .map((s) => {
      const staffTasks = tasks.filter((t) => t.assignedTo === s.id);
      const toDo = staffTasks.filter((t) => t.status === "To Do").length;
      const inProgress = staffTasks.filter((t) => t.status === "In Progress").length;
      const forReview = staffTasks.filter((t) => t.status === "For Review").length;
      const blocked = staffTasks.filter((t) => t.status === "Blocked").length;
      const overdue = staffTasks.filter((t) => isTaskOverdue(t, now)).length;
      const dueToday = staffTasks.filter((t) => isTaskDueToday(t, now)).length;
      const completedToday = staffTasks.filter((t) => t.completedAt && isSameCalendarDay(t.completedAt, now)).length;
      return {
        staffId: s.id,
        staffName: s.fullName,
        role: s.role === "Custom Role" && s.customRoleLabel ? s.customRoleLabel : s.role,
        accountStatus: s.accountStatus,
        toDo,
        inProgress,
        forReview,
        blocked,
        overdue,
        dueToday,
        completedToday,
        totalActive: toDo + inProgress + forReview + blocked,
      };
    });
}

export interface TaskSnapshot {
  dueToday: number;
  overdue: number;
  inProgress: number;
  forReview: number;
  completedToday: number;
}

export function getTaskSnapshot(tasks: TaskRecord[]): TaskSnapshot {
  const now = new Date();
  return {
    dueToday: tasks.filter((t) => isTaskDueToday(t, now)).length,
    overdue: tasks.filter((t) => isTaskOverdue(t, now)).length,
    inProgress: tasks.filter((t) => t.status === "In Progress").length,
    forReview: tasks.filter((t) => t.status === "For Review").length,
    completedToday: tasks.filter((t) => t.completedAt && isSameCalendarDay(t.completedAt, now)).length,
  };
}
