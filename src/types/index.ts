// Shared application types for M.A.I.A. Academy Command Center.
// These describe the shapes the UI expects. In later steps these will be
// backed by real API/database responses instead of demo data.

export type UserRole = "Owner" | "Administrator" | "Staff" | "Student";

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarInitials: string;
  /** Set when role === "Student" — the StudentRecord.id this session is scoped to. */
  linkedStudentId?: string;
  /** Set when role === "Staff" — the StaffRecord.id this session is scoped to. */
  linkedStaffId?: string;
}

export type AttentionSeverity = "high" | "medium" | "low";

export interface AttentionItem {
  id: string;
  label: string;
  count: number;
  severity: AttentionSeverity;
  onClick?: () => void;
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
