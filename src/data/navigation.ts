import type { NavSection } from "@/types";

// Sidebar navigation structure for M.A.I.A. Academy Command Center.
// Only "Dashboard" is a fully built page in Step 1. Every other route
// renders the shared <ComingSoon /> placeholder page.
export const NAV_SECTIONS: NavSection[] = [
  {
    label: "Overview",
    items: [{ label: "Dashboard", path: "/dashboard" }],
  },
  {
    label: "Students",
    items: [
      { label: "All Students", path: "/students/all" },
      { label: "New Enrollments", path: "/students/new-enrollments" },
      { label: "Batches", path: "/students/batches" },
      { label: "Attendance", path: "/students/attendance" },
    ],
  },
  {
    label: "Finance",
    items: [
      { label: "Overview", path: "/finance/overview" },
      { label: "Payments", path: "/finance/payments" },
      { label: "Receivables", path: "/finance/receivables" },
      { label: "Expenses", path: "/finance/expenses" },
      { label: "Reports", path: "/finance/reports" },
    ],
  },
  {
    label: "Master Brain",
    items: [
      { label: "Overview", path: "/master-brain/overview" },
      { label: "Submissions", path: "/master-brain/submissions" },
      { label: "Templates / Versions", path: "/master-brain/templates" },
    ],
  },
  {
    label: "Training",
    items: [
      { label: "Sessions", path: "/training/sessions" },
      { label: "Attendance", path: "/training/attendance" },
      { label: "Certificates", path: "/training/certificates" },
    ],
  },
  {
    label: "Inventory",
    items: [
      { label: "All Items", path: "/inventory/all-items" },
      { label: "Stock In", path: "/inventory/stock-in" },
      { label: "Stock Out", path: "/inventory/stock-out" },
      { label: "Low Stock", path: "/inventory/low-stock" },
      { label: "Suppliers", path: "/inventory/suppliers" },
      { label: "Inventory History", path: "/inventory/history" },
    ],
  },
  {
    label: "Team",
    items: [
      { label: "Staff", path: "/team/staff" },
      { label: "Tasks", path: "/team/tasks" },
      { label: "Calendar", path: "/team/calendar" },
      { label: "Workload", path: "/team/workload" },
      { label: "Activity", path: "/team/activity" },
    ],
  },
  {
    label: "Communication",
    items: [
      { label: "Announcements", path: "/communication/announcements" },
      { label: "Support Requests", path: "/communication/support-requests" },
    ],
  },
  {
    label: "Reports",
    items: [{ label: "Reports", path: "/reports" }],
  },
  {
    label: "System",
    items: [
      { label: "Users", path: "/system/users" },
      { label: "Roles & Permissions", path: "/system/roles-permissions" },
      { label: "Activity Log", path: "/system/activity-log" },
      { label: "Settings", path: "/system/settings" },
    ],
  },
];
