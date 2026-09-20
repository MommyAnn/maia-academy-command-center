// ---------------------------------------------------------------------------
// DEMO DATA ONLY
// ---------------------------------------------------------------------------
// Inventory Management has not been built yet (planned for a later step).
// Everything in this file is hardcoded sample data so the Owner Dashboard's
// "Inventory" widget has something real-looking to render in the meantime.
//
// This is NOT connected to a database, and these numbers are NOT derived
// from any other module — unlike every other Owner Dashboard widget, which
// is calculated live from the student/finance/task/staff stores. Treat this
// file as a placeholder for the future Inventory Management build.
//
// Staff Task Management (Step 5) is now real — see src/data/taskStore.tsx
// and src/utils/staffTasks.ts, which replaced the old DEMO_STAFF_TASKS /
// DEMO_STAFF_TASK_SNAPSHOT constants that used to live here.
// ---------------------------------------------------------------------------

import type { InventoryAlert } from "@/types";

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
