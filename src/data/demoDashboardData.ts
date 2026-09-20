// ---------------------------------------------------------------------------
// DEMO DATA ONLY
// ---------------------------------------------------------------------------
// Everything in this file is hardcoded sample data for Step 1 of the build.
// None of it is connected to a real database, API, or authentication system.
// It exists purely so the Owner Dashboard UI can be designed and reviewed.
// In a future step this file will be replaced by real data-fetching logic
// (e.g. hooks that call a backend/database), while the components that
// consume this shape (see src/types/index.ts) remain unchanged.
// ---------------------------------------------------------------------------

import type {
  ActivityItem,
  AttentionItem,
  BatchEnrollmentSummary,
  FinancialOverview,
  InventoryAlert,
  KpiCardData,
  MasterBrainProgress,
  StaffTask,
} from "@/types";

export const DEMO_KPI_CARDS: KpiCardData[] = [
  {
    id: "total-students",
    label: "Total Students",
    value: "390",
    helperText: "All enrolled students",
    icon: "students",
  },
  {
    id: "new-enrollments",
    label: "New Enrollments",
    value: "24",
    helperText: "This month",
    icon: "enrollments",
  },
  {
    id: "confirmed-students",
    label: "Confirmed Students",
    value: "319",
    helperText: "Enrollment confirmed",
    icon: "confirmed",
  },
  {
    id: "total-collections",
    label: "Total Collections",
    value: "₱2,450,000",
    helperText: "Selected period",
    icon: "collections",
    accent: "gold",
  },
  {
    id: "receivables",
    label: "Receivables",
    value: "₱485,000",
    helperText: "Outstanding student balances",
    icon: "receivables",
  },
  {
    id: "expenses",
    label: "Expenses",
    value: "₱320,000",
    helperText: "Selected period",
    icon: "expenses",
  },
];

export const DEMO_BATCH_ENROLLMENT: BatchEnrollmentSummary = {
  batchName: "Batch 14",
  currentCount: 83,
  targetCount: 100,
  remaining: 17,
  progressPercent: 83,
};

export const DEMO_FINANCIAL_OVERVIEW: FinancialOverview = {
  collections: 2_450_000,
  receivables: 485_000,
  expenses: 320_000,
  estimatedNet: 2_130_000,
  monthly: [
    { month: "Apr", collections: 1_820_000, expenses: 240_000 },
    { month: "May", collections: 1_960_000, expenses: 260_000 },
    { month: "Jun", collections: 2_040_000, expenses: 255_000 },
    { month: "Jul", collections: 2_180_000, expenses: 280_000 },
    { month: "Aug", collections: 2_310_000, expenses: 300_000 },
    { month: "Sep", collections: 2_450_000, expenses: 320_000 },
  ],
};

export const DEMO_ATTENTION_ITEMS: AttentionItem[] = [
  { id: "payments-verify", label: "Payments Need Verification", count: 7, severity: "high" },
  { id: "missing-ids", label: "Missing Valid IDs", count: 12, severity: "medium" },
  { id: "outstanding-balance", label: "Students Have Outstanding Balance", count: 15, severity: "high" },
  { id: "taobao-accounts", label: "Taobao Login Accounts Not Yet Created", count: 12, severity: "medium" },
  { id: "master-brain-not-started", label: "Master Brains Not Started", count: 16, severity: "medium" },
  { id: "master-brain-review", label: "Master Brains Awaiting Review", count: 6, severity: "low" },
  { id: "staff-tasks-overdue", label: "Staff Tasks Overdue", count: 3, severity: "high" },
  { id: "inventory-low-stock", label: "Inventory Items Low Stock", count: 4, severity: "low" },
];

export const DEMO_MASTER_BRAIN_PROGRESS: MasterBrainProgress = {
  notStarted: 16,
  inProgress: 28,
  submitted: 12,
  underReview: 6,
  completed: 45,
};

export const DEMO_STAFF_TASKS: StaffTask[] = [
  {
    id: "task-1",
    task: "Verify Proof of Payment",
    assignedTo: "Anna",
    priority: "High",
    due: "Today",
    status: "To Do",
  },
  {
    id: "task-2",
    task: "Review Master Brain",
    assignedTo: "Jane",
    priority: "Medium",
    due: "Today",
    status: "In Progress",
  },
  {
    id: "task-3",
    task: "Prepare Certificates",
    assignedTo: "Mark",
    priority: "Low",
    due: "Tomorrow",
    status: "To Do",
  },
];

export const DEMO_INVENTORY_ALERTS: InventoryAlert[] = [
  { id: "inv-1", item: "Student ID Cards", remaining: 12 },
  { id: "inv-2", item: "Lanyards", remaining: 8 },
  { id: "inv-3", item: "Training Kits", remaining: 5 },
  { id: "inv-4", item: "Certificates", remaining: 20 },
];

export const DEMO_RECENT_ACTIVITY: ActivityItem[] = [
  { id: "act-1", message: "New student enrollment received.", timestamp: "10 minutes ago" },
  { id: "act-2", message: "Payment verified for Maria Santos.", timestamp: "42 minutes ago" },
  { id: "act-3", message: "Student Master Brain submitted.", timestamp: "1 hour ago" },
  { id: "act-4", message: "Staff task completed.", timestamp: "2 hours ago" },
  { id: "act-5", message: "Taobao login details marked as given.", timestamp: "3 hours ago" },
];
