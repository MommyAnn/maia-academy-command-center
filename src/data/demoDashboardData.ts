// ---------------------------------------------------------------------------
// DEMO DATA ONLY
// ---------------------------------------------------------------------------
// Staff Task Management and Inventory Management have not been built yet
// (planned for later steps). Everything in this file is hardcoded sample
// data so the Owner Dashboard's "Staff Tasks" and "Inventory" widgets have
// something real-looking to render in the meantime.
//
// This is NOT connected to a database, and these numbers are NOT derived
// from any other module — unlike every other Owner Dashboard widget, which
// is calculated live from the student/finance stores. Treat this file as a
// placeholder for the Step 5 (Staff & Task Management) and future
// Inventory Management builds.
// ---------------------------------------------------------------------------

import type { InventoryAlert, StaffTask } from "@/types";

export const DEMO_STAFF_TASKS: StaffTask[] = [
  {
    id: "task-1",
    task: "Verify Proof of Payment",
    assignedTo: "Anna",
    relatedStudent: "Bea Fernandez",
    priority: "High",
    due: "Today",
    status: "To Do",
  },
  {
    id: "task-2",
    task: "Review Master Brain",
    assignedTo: "Jane",
    relatedStudent: "Miguel Torres",
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
  {
    id: "task-4",
    task: "Follow up on outstanding balance",
    assignedTo: "Anna",
    relatedStudent: "Ronald Cruz",
    priority: "High",
    due: "Yesterday",
    status: "To Do",
  },
];

export const DEMO_STAFF_TASK_SNAPSHOT = {
  dueToday: 2,
  overdue: 1,
  inProgress: 1,
  forReview: 1,
  completedToday: 3,
};

export const DEMO_INVENTORY_ALERTS: InventoryAlert[] = [
  { id: "inv-1", item: "Student ID Cards", remaining: 12, reorderLevel: 20 },
  { id: "inv-2", item: "Lanyards", remaining: 8, reorderLevel: 15 },
  { id: "inv-3", item: "Training Kits", remaining: 5, reorderLevel: 10 },
  { id: "inv-4", item: "Certificates", remaining: 20, reorderLevel: 25 },
];

export const DEMO_INVENTORY_SNAPSHOT = {
  totalItems: 8,
  lowStock: DEMO_INVENTORY_ALERTS.length,
  outOfStock: 0,
  inventoryValue: 48_500,
};
