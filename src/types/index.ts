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

export type AttentionSeverity = "high" | "medium" | "low";

export interface AttentionItem {
  id: string;
  label: string;
  count: number;
  severity: AttentionSeverity;
  onClick?: () => void;
}

export type TaskPriority = "High" | "Medium" | "Low";
export type TaskStatus = "To Do" | "In Progress" | "Done";

export interface StaffTask {
  id: string;
  task: string;
  assignedTo: string;
  relatedStudent?: string;
  priority: TaskPriority;
  due: string;
  status: TaskStatus;
}

export interface InventoryAlert {
  id: string;
  item: string;
  remaining: number;
  reorderLevel: number;
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
