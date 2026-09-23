// Kept intentionally identical to PERMISSION_MODULES in
// src/types/staff.ts (frontend) — this is the server-side source of truth
// those UI permission checks must eventually be validated against. If a
// module is ever renamed/added on the frontend, update both files in the
// same change so they never drift apart.

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
  "Free Webinar",
  "Free Webinar - Finance",
  "Free Webinar - Marketing",
  "Communications",
  "Communications - Templates",
  "Communications - Automation",
  "Communications - GHL Integration",
  "AI Business Tools - Usage",
  "AI Business Tools - Tool Library",
  "AI Business Tools - Access",
  "AI Business Tools - Prompts",
  "AI Business Tools - Providers",
  "AI Business Tools - Student Outputs",
  "AI Business Tools - Technical Logs",
  "System Settings",
  "Data Migration",
  "M.A.I.A. Intelligence",
  "Creative Studio",
  "Automation Studio",
] as const;

export type PermissionModule = (typeof PERMISSION_MODULES)[number];

export const PERMISSION_ACTIONS = ["VIEW", "CREATE", "EDIT", "VERIFY", "EXPORT"] as const;
export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

export function isPermissionModule(value: string): value is PermissionModule {
  return (PERMISSION_MODULES as readonly string[]).includes(value);
}

export const STAFF_ROLES = [
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
] as const;
