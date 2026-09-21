// Inventory calculation helpers for Step 6. Same principle as
// src/utils/finance.ts: a derived number (here, Current Stock) is always
// calculated live from the transaction ledger, never stored/edited directly.

import type { InventoryItem, InventoryItemStatus, InventoryTransaction } from "@/types/inventory";

const INBOUND_TYPES = new Set<InventoryTransaction["type"]>(["Stock In"]);
const OUTBOUND_TYPES = new Set<InventoryTransaction["type"]>(["Stock Out", "Damaged", "Lost"]);

/** Live current stock for one item, derived from every transaction ever recorded against it. Adjustment transactions carry a signed effect via their `newStock - previousStock` delta baked in at record time (see inventoryStore.applyAdjustment). */
export function getCurrentStock(itemId: string, transactions: InventoryTransaction[]): number {
  return transactions
    .filter((t) => t.itemId === itemId)
    .reduce((stock, t) => {
      if (INBOUND_TYPES.has(t.type)) return stock + t.quantity;
      if (OUTBOUND_TYPES.has(t.type)) return stock - t.quantity;
      // Adjustment: quantity is a signed delta baked into previous/new stock at record time.
      return stock + (t.newStock - t.previousStock);
    }, 0);
}

export function getInventoryItemStatus(item: InventoryItem, currentStock: number): InventoryItemStatus {
  if (!item.active) return "Inactive";
  if (currentStock <= 0) return "Out of Stock";
  if (currentStock <= item.reorderLevel) return "Low Stock";
  return "In Stock";
}

export function getInventoryValue(items: InventoryItem[], transactions: InventoryTransaction[]): number {
  return items.reduce((sum, item) => sum + getCurrentStock(item.id, transactions) * item.unitCost, 0);
}

/** Generates the next sequential demo Inventory Item ID, e.g. INV-000012. */
export function generateItemId(existingItems: InventoryItem[]): string {
  const nextSeq = String(existingItems.length + 1).padStart(6, "0");
  return `INV-${nextSeq}`;
}

/** Generates the next sequential demo Inventory Transaction ID for the current year, e.g. STK-2026-000001. */
export function generateTransactionId(existingTransactions: InventoryTransaction[]): string {
  const year = new Date().getFullYear();
  const prefix = `STK-${year}-`;
  const count = existingTransactions.filter((t) => t.id.startsWith(prefix)).length;
  const nextSeq = String(count + 1).padStart(6, "0");
  return `${prefix}${nextSeq}`;
}
