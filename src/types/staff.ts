// Staff & Role/Permission domain types for Step 5 (Staff, Task Management &
// Operations System). Backed by demo/local state — see src/data/staffStore.tsx.
//
// IMPORTANT: the permission matrix here is real, reusable data — every page
// in the app can (and should) check it before showing an action. But hiding
// a sidebar item or a button based on this matrix is NOT security. A real
// production build must also enforce every one of these checks server-side;
// a demo user editing localStorage could otherwise grant themselves anything.

import type { Batch } from "@/types/student";

export type StaffRoleName =
  | "Owner"
  | "Administrator"
  | "Finance Officer"
  | "Enrollment Officer"
  | "Student Success Coordinator"
  | "Training Coordinator"
  | "Inventory Officer"
  | "Marketing Staff"
  | "Support Staff"
  | "Custom Role";

export const STAFF_ROLES: StaffRoleName[] = [
  "Owner",
  "Administrator",
  "Finance Officer",
  "Enrollment Officer",
  "Student Success Coordinator",
  "Training Coordinator",
  "Inventory Officer",
  "Marketing Staff",
  "Support Staff",
  "Custom Role",
];

export type StaffAccountStatus = "Active" | "Inactive" | "Suspended";

export const STAFF_ACCOUNT_STATUS_OPTIONS: StaffAccountStatus[] = ["Active", "Inactive", "Suspended"];

export const PERMISSION_MODULES = [
  "Dashboard",
  "Students",
  "Enrollment",
  "Finance - Payments",
  "Finance - Expenses",
  "Finance - Reports",
  "Batches",
  "Master Brain",
  "Taobao",
  "Training",
  "Certificates",
  "Inventory",
  "Staff",
  "Tasks",
  "Calendar",
  "Reports",
  "Announcements",
  "Courses",
  "Feedback",
  "Feedback - Marketing",
  "System Settings",
] as const;

export type PermissionModule = (typeof PERMISSION_MODULES)[number];

export const PERMISSION_ACTIONS = ["view", "create", "edit", "verify", "export"] as const;

export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

export type PermissionMatrix = Record<PermissionModule, Record<PermissionAction, boolean>>;

export interface StaffActivityEntry {
  id: string;
  action: string;
  date: string;
  time: string;
  by: string;
}

export interface StaffRecord {
  id: string;
  staffId: string; // e.g. STAFF-000001
  fullName: string;
  email: string;
  contactNumber: string;
  role: StaffRoleName;
  /** Only used when role === "Custom Role" — the human-readable label shown instead. */
  customRoleLabel: string;
  permissions: PermissionMatrix;
  accountStatus: StaffAccountStatus;
  dateJoined: string;
  avatarInitials: string;
  notes: string;
  /** Batches this staff member is primarily assigned to (for workload/filtering — not an access restriction). */
  assignedBatches: Batch[];
  activity: StaffActivityEntry[];
}
