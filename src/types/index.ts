// Shared application types for M.A.I.A. Academy Command Center.
// These describe the shapes the UI expects. In later steps these will be
// backed by real API/database responses instead of demo data.

export type UserRole = "Owner" | "Administrator" | "Staff";

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarInitials: string;
}

export type DateRangeFilter =
  | "today"
  | "this_week"
  | "this_month"
  | "this_year"
  | "all_time"
  | "custom";

export type BatchFilter = "all" | "batch_14" | "batch_13" | "batch_12";

export interface KpiCardData {
  id: string;
  label: string;
  value: string;
  helperText: string;
  icon: KpiIconName;
  accent?: "gold" | "neutral";
}

export type KpiIconName =
  | "students"
  | "enrollments"
  | "confirmed"
  | "collections"
  | "receivables"
  | "expenses";

export interface BatchEnrollmentSummary {
  batchName: string;
  currentCount: number;
  targetCount: number;
  remaining: number;
  progressPercent: number;
}

export interface FinancialOverview {
  collections: number;
  receivables: number;
  expenses: number;
  estimatedNet: number;
  monthly: FinancialMonthPoint[];
}

export interface FinancialMonthPoint {
  month: string;
  collections: number;
  expenses: number;
}

export type AttentionSeverity = "high" | "medium" | "low";

export interface AttentionItem {
  id: string;
  label: string;
  count: number;
  severity: AttentionSeverity;
}

export interface MasterBrainProgress {
  notStarted: number;
  inProgress: number;
  submitted: number;
  underReview: number;
  completed: number;
}

export type TaskPriority = "High" | "Medium" | "Low";
export type TaskStatus = "To Do" | "In Progress" | "Done";

export interface StaffTask {
  id: string;
  task: string;
  assignedTo: string;
  priority: TaskPriority;
  due: string;
  status: TaskStatus;
}

export interface InventoryAlert {
  id: string;
  item: string;
  remaining: number;
}

export interface ActivityItem {
  id: string;
  message: string;
  timestamp: string;
}

export interface NavLeafItem {
  label: string;
  path: string;
}

export interface NavSection {
  label: string;
  items: NavLeafItem[];
}
