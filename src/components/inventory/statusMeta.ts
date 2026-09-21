import type { InventoryItemStatus, InventoryTransactionType, SupplierStatus } from "@/types/inventory";

type Tone = "success" | "warning" | "danger" | "info" | "neutral" | "gold";

export const INVENTORY_ITEM_STATUS_TONE: Record<InventoryItemStatus, Tone> = {
  "In Stock": "success",
  "Low Stock": "warning",
  "Out of Stock": "danger",
  Inactive: "neutral",
};

export const INVENTORY_TRANSACTION_TYPE_TONE: Record<InventoryTransactionType, Tone> = {
  "Stock In": "success",
  "Stock Out": "info",
  Adjustment: "gold",
  Damaged: "danger",
  Lost: "danger",
};

export const SUPPLIER_STATUS_TONE: Record<SupplierStatus, Tone> = {
  Active: "success",
  Inactive: "neutral",
};
