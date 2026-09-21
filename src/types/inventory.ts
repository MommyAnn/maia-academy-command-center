// Inventory domain types for Step 6 (Inventory + Training + Attendance +
// Certificate Operations). Backed by demo/local state — see
// src/data/inventoryStore.tsx.
//
// Core principle (mirrors the Step 3 finance ledger rule): a "Current
// Stock" number is never a single editable field on InventoryItem. Every
// stock movement is its own InventoryTransaction, and current stock is
// always CALCULATED LIVE from that ledger — see src/utils/inventory.ts.
// This means Current Stock can never silently drift out of sync with what
// actually happened.

import type { Batch, UploadedFileMeta } from "@/types/student";

export type InventoryCategory =
  | "Student IDs"
  | "Lanyards"
  | "Certificates"
  | "Training Kits"
  | "Notebooks"
  | "Pens"
  | "Event Materials"
  | "Office Supplies"
  | "Marketing Materials"
  | "Equipment"
  | "Other";

export const INVENTORY_CATEGORIES: InventoryCategory[] = [
  "Student IDs",
  "Lanyards",
  "Certificates",
  "Training Kits",
  "Notebooks",
  "Pens",
  "Event Materials",
  "Office Supplies",
  "Marketing Materials",
  "Equipment",
  "Other",
];

/**
 * Display-only status. "Inactive" is the one manually-set flag (`active`
 * below); every other value is derived live from current stock vs reorder
 * level — see getInventoryItemStatus() in src/utils/inventory.ts.
 */
export type InventoryItemStatus = "In Stock" | "Low Stock" | "Out of Stock" | "Inactive";

export const INVENTORY_ITEM_STATUSES: InventoryItemStatus[] = ["In Stock", "Low Stock", "Out of Stock", "Inactive"];

export interface InventoryItem {
  id: string;
  itemId: string; // e.g. INV-000001
  name: string;
  sku: string;
  category: InventoryCategory;
  supplierId: string | null;
  unit: string; // free text, e.g. "pcs", "box", "pack"
  reorderLevel: number;
  unitCost: number;
  location: string;
  /** The only manually-set status flag — everything else is derived from stock. */
  active: boolean;
  notes: string;
  createdAt: string;
}

export type InventoryTransactionType = "Stock In" | "Stock Out" | "Adjustment" | "Damaged" | "Lost";

export const INVENTORY_TRANSACTION_TYPES: InventoryTransactionType[] = [
  "Stock In",
  "Stock Out",
  "Adjustment",
  "Damaged",
  "Lost",
];

export type StockOutReason =
  | "Student Distribution"
  | "Training Event"
  | "Office Use"
  | "Damaged"
  | "Lost"
  | "Adjustment"
  | "Other";

export const STOCK_OUT_REASONS: StockOutReason[] = [
  "Student Distribution",
  "Training Event",
  "Office Use",
  "Damaged",
  "Lost",
  "Adjustment",
  "Other",
];

/**
 * One inventory transaction — the only thing that can ever change an
 * item's stock. `previousStock`/`newStock` are snapshots recorded at the
 * moment of the transaction, purely for a readable history; live
 * calculations always re-derive from the full ledger, never from these
 * snapshots.
 */
export interface InventoryTransaction {
  id: string; // e.g. STK-2026-000001
  itemId: string; // InventoryItem.id
  type: InventoryTransactionType;
  quantity: number; // always a positive count; direction implied by `type`
  previousStock: number;
  newStock: number;
  unitCost: number | null; // set on Stock In
  supplierId: string | null;
  reason: StockOutReason | null; // set on Stock Out
  relatedBatch: Batch | null;
  relatedSessionId: string | null; // TrainingSession.id
  releasedTo: string;
  referenceNumber: string;
  receipt: UploadedFileMeta | null;
  notes: string;
  recordedBy: string;
  date: string; // yyyy-mm-dd
  createdAt: string;
}

export type SupplierStatus = "Active" | "Inactive";

export interface Supplier {
  id: string;
  name: string;
  contactPerson: string;
  contactNumber: string;
  email: string;
  address: string;
  notes: string;
  status: SupplierStatus;
  createdAt: string;
}

/**
 * Batch Materials Planning (spec section 25): a *requirement*, never a
 * deduction. Setting/changing this never touches inventory transactions —
 * inventory is only ever moved by a confirmed Stock Out.
 */
export interface BatchMaterialRequirement {
  id: string;
  batch: Batch;
  itemId: string;
  requiredQuantity: number;
}
