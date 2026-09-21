// ---------------------------------------------------------------------------
// DEMO DATA ONLY
// ---------------------------------------------------------------------------
// Seed inventory items, suppliers, and stock transactions for Step 6. None
// of this is connected to a real database or a real supplier. Current
// stock is never seeded directly — every item's stock comes from the seed
// InventoryTransactions below, exactly the way it would from real Stock
// In/Out entries (see src/utils/inventory.ts for the live calculation).
// ---------------------------------------------------------------------------

import type { InventoryItem, InventoryTransaction, Supplier } from "@/types/inventory";

export const DEMO_SUPPLIERS: Supplier[] = [
  {
    id: "sup-1",
    name: "Manila Print & Supplies Co.",
    contactPerson: "Rey Bautista",
    contactNumber: "0917 200 1001",
    email: "rey@manilaprint.demo",
    address: "Quezon City, Metro Manila",
    notes: "Primary supplier for IDs, lanyards, and certificates.",
    status: "Active",
    createdAt: "2024-01-15T09:00:00.000Z",
  },
  {
    id: "sup-2",
    name: "Academy Kits Trading",
    contactPerson: "Liza Domingo",
    contactNumber: "0917 200 1002",
    email: "liza@academykits.demo",
    address: "Makati City, Metro Manila",
    notes: "Training kits and notebooks.",
    status: "Active",
    createdAt: "2024-02-10T09:00:00.000Z",
  },
  {
    id: "sup-3",
    name: "OfficePro Distributors",
    contactPerson: "Mark Villamor",
    contactNumber: "0917 200 1003",
    email: "mark@officepro.demo",
    address: "Pasig City, Metro Manila",
    notes: "Office and event materials.",
    status: "Active",
    createdAt: "2024-03-05T09:00:00.000Z",
  },
];

export const DEMO_INVENTORY_ITEMS: InventoryItem[] = [
  {
    id: "item-student-ids",
    itemId: "INV-000001",
    name: "Student ID Cards (Blank)",
    sku: "SID-BLANK",
    category: "Student IDs",
    supplierId: "sup-1",
    unit: "pcs",
    reorderLevel: 30,
    unitCost: 25,
    location: "Main Storage Room A",
    active: true,
    notes: "",
    createdAt: "2024-01-20T09:00:00.000Z",
  },
  {
    id: "item-lanyards",
    itemId: "INV-000002",
    name: "M.A.I.A. Lanyards",
    sku: "LNY-MAIA",
    category: "Lanyards",
    supplierId: "sup-1",
    unit: "pcs",
    reorderLevel: 40,
    unitCost: 15,
    location: "Main Storage Room A",
    active: true,
    notes: "",
    createdAt: "2024-01-20T09:00:00.000Z",
  },
  {
    id: "item-certificates",
    itemId: "INV-000003",
    name: "Certificate Paper (Premium)",
    sku: "CERT-PAPER",
    category: "Certificates",
    supplierId: "sup-1",
    unit: "pcs",
    reorderLevel: 50,
    unitCost: 20,
    location: "Main Storage Room B",
    active: true,
    notes: "",
    createdAt: "2024-01-20T09:00:00.000Z",
  },
  {
    id: "item-training-kits",
    itemId: "INV-000004",
    name: "Training Kits (Folder + Materials)",
    sku: "KIT-TRN",
    category: "Training Kits",
    supplierId: "sup-2",
    unit: "set",
    reorderLevel: 20,
    unitCost: 180,
    location: "Main Storage Room B",
    active: true,
    notes: "",
    createdAt: "2024-02-15T09:00:00.000Z",
  },
  {
    id: "item-notebooks",
    itemId: "INV-000005",
    name: "M.A.I.A. Branded Notebooks",
    sku: "NTB-MAIA",
    category: "Notebooks",
    supplierId: "sup-2",
    unit: "pcs",
    reorderLevel: 30,
    unitCost: 45,
    location: "Main Storage Room B",
    active: true,
    notes: "",
    createdAt: "2024-02-15T09:00:00.000Z",
  },
  {
    id: "item-pens",
    itemId: "INV-000006",
    name: "Ballpoint Pens (Branded)",
    sku: "PEN-MAIA",
    category: "Pens",
    supplierId: "sup-2",
    unit: "box",
    reorderLevel: 5,
    unitCost: 120,
    location: "Main Storage Room B",
    active: true,
    notes: "1 box = 50 pcs.",
    createdAt: "2024-02-15T09:00:00.000Z",
  },
  {
    id: "item-event-materials",
    itemId: "INV-000007",
    name: "Event Banners & Signage",
    sku: "EVT-SIGN",
    category: "Event Materials",
    supplierId: "sup-3",
    unit: "pcs",
    reorderLevel: 3,
    unitCost: 850,
    location: "Event Storage",
    active: true,
    notes: "",
    createdAt: "2024-03-10T09:00:00.000Z",
  },
  {
    id: "item-office-supplies",
    itemId: "INV-000008",
    name: "Bond Paper (A4, Ream)",
    sku: "PPR-A4",
    category: "Office Supplies",
    supplierId: "sup-3",
    unit: "ream",
    reorderLevel: 10,
    unitCost: 220,
    location: "Office Storage",
    active: true,
    notes: "",
    createdAt: "2024-03-10T09:00:00.000Z",
  },
  {
    id: "item-marketing",
    itemId: "INV-000009",
    name: "Tarpaulin Streamers",
    sku: "MKT-TARP",
    category: "Marketing Materials",
    supplierId: "sup-3",
    unit: "pcs",
    reorderLevel: 5,
    unitCost: 350,
    location: "Event Storage",
    active: true,
    notes: "",
    createdAt: "2024-03-12T09:00:00.000Z",
  },
  {
    id: "item-equipment",
    itemId: "INV-000010",
    name: "Wireless Microphone Set",
    sku: "EQP-MIC",
    category: "Equipment",
    supplierId: "sup-3",
    unit: "set",
    reorderLevel: 1,
    unitCost: 4500,
    location: "Equipment Room",
    active: true,
    notes: "",
    createdAt: "2024-03-12T09:00:00.000Z",
  },
  {
    id: "item-other",
    itemId: "INV-000011",
    name: "Old Banner Stands (Discontinued Design)",
    sku: "OTH-BNR",
    category: "Other",
    supplierId: null,
    unit: "pcs",
    reorderLevel: 2,
    unitCost: 500,
    location: "Event Storage",
    active: false,
    notes: "Retired design — kept for records only.",
    createdAt: "2024-04-01T09:00:00.000Z",
  },
];

let seq = 0;
function nextTxnId(): string {
  seq += 1;
  const year = new Date().getFullYear();
  return `STK-${year}-${String(seq).padStart(6, "0")}`;
}

function stockIn(
  itemId: string,
  quantity: number,
  unitCost: number,
  supplierId: string,
  date: string,
  previousStock = 0,
): InventoryTransaction {
  return {
    id: nextTxnId(),
    itemId,
    type: "Stock In",
    quantity,
    previousStock,
    newStock: previousStock + quantity,
    unitCost,
    supplierId,
    reason: null,
    relatedBatch: null,
    relatedSessionId: null,
    releasedTo: "",
    referenceNumber: `PO-${date.replace(/-/g, "")}`,
    receipt: null,
    notes: "",
    recordedBy: "Mommy Ann",
    date,
    createdAt: new Date(date).toISOString(),
  };
}

function stockOut(
  itemId: string,
  quantity: number,
  reason: InventoryTransaction["reason"],
  date: string,
  previousStock: number,
  extra: Partial<InventoryTransaction> = {},
): InventoryTransaction {
  return {
    id: nextTxnId(),
    itemId,
    type: "Stock Out",
    quantity,
    previousStock,
    newStock: previousStock - quantity,
    unitCost: null,
    supplierId: null,
    reason,
    relatedBatch: null,
    relatedSessionId: null,
    releasedTo: "",
    referenceNumber: "",
    receipt: null,
    notes: "",
    recordedBy: "Mommy Ann",
    date,
    createdAt: new Date(date).toISOString(),
    ...extra,
  };
}

export const DEMO_INVENTORY_TRANSACTIONS: InventoryTransaction[] = [
  stockIn("item-student-ids", 120, 25, "sup-1", "2025-06-01", 0),
  stockOut("item-student-ids", 92, "Student Distribution", "2025-08-10", 120, { relatedBatch: "Batch 13" }),

  stockIn("item-lanyards", 100, 15, "sup-1", "2025-06-01", 0),
  stockOut("item-lanyards", 88, "Student Distribution", "2025-08-10", 100, { relatedBatch: "Batch 13" }),

  stockIn("item-certificates", 150, 20, "sup-1", "2025-05-15", 0),
  stockOut("item-certificates", 40, "Training Event", "2025-08-20", 150, { relatedBatch: "Batch 13" }),

  stockIn("item-training-kits", 90, 180, "sup-2", "2025-06-05", 0),
  stockOut("item-training-kits", 70, "Training Event", "2025-08-10", 90, { relatedBatch: "Batch 13" }),

  stockIn("item-notebooks", 60, 45, "sup-2", "2025-06-05", 0),
  stockOut("item-notebooks", 20, "Student Distribution", "2025-08-10", 60, { relatedBatch: "Batch 13" }),

  stockIn("item-pens", 8, 120, "sup-2", "2025-06-05", 0),
  stockOut("item-pens", 5, "Office Use", "2025-07-01", 8),

  stockIn("item-event-materials", 4, 850, "sup-3", "2025-05-01", 0),
  stockOut("item-event-materials", 2, "Training Event", "2025-08-10", 4, { relatedBatch: "Batch 13" }),

  stockIn("item-office-supplies", 25, 220, "sup-3", "2025-06-10", 0),
  stockOut("item-office-supplies", 12, "Office Use", "2025-07-15", 25),

  stockIn("item-marketing", 20, 350, "sup-3", "2025-05-01", 0),
  stockOut("item-marketing", 20, "Training Event", "2025-08-05", 20, { relatedBatch: "Batch 13" }),

  stockIn("item-equipment", 2, 4500, "sup-3", "2024-11-01", 0),

  stockIn("item-other", 3, 500, "", "2024-04-05", 0),
];
