import type { NavLeafItem } from "@/types";

// Student Portal navigation — deliberately separate from NAV_SECTIONS
// (src/data/navigation.ts). No Admin items (Finance, All Students, Staff,
// Inventory, Reports, System, ...) ever appear here.
export const PORTAL_NAV_ITEMS: NavLeafItem[] = [
  { label: "Home", path: "/portal" },
  { label: "My Enrollment", path: "/portal/enrollment" },
  { label: "My Payments", path: "/portal/payments" },
  { label: "My Requirements", path: "/portal/requirements" },
  { label: "My Taobao", path: "/portal/taobao" },
  { label: "My Master Brain", path: "/portal/master-brain" },
  { label: "My Training", path: "/portal/training" },
  { label: "My Courses", path: "/portal/courses" },
  { label: "My Certificates", path: "/portal/certificates" },
  { label: "My Feedback", path: "/portal/feedback" },
  { label: "Announcements", path: "/portal/announcements" },
  { label: "My Profile", path: "/portal/profile" },
  { label: "Need Help", path: "/portal/support" },
];
