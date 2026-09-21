import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type {
  BatchMaterialRequirement,
  InventoryCategory,
  InventoryItem,
  InventoryTransaction,
  StockOutReason,
  Supplier,
  SupplierStatus,
} from "@/types/inventory";
import type { Batch, UploadedFileMeta } from "@/types/student";
import { DEMO_INVENTORY_ITEMS, DEMO_INVENTORY_TRANSACTIONS, DEMO_SUPPLIERS } from "@/data/demoInventory";
import { CURRENT_DEMO_USER } from "@/data/inventoryConfig";
import { generateItemId, generateTransactionId, getCurrentStock } from "@/utils/inventory";

// ---------------------------------------------------------------------------
// DEMO / LOCAL PERSISTENCE ONLY
// ---------------------------------------------------------------------------
// Same caveats as every other store in this build: items, suppliers, and
// stock transactions live in React state and are mirrored to this browser's
// localStorage only. Not a real inventory/accounting system — not shared
// across devices/users, not encrypted or backed up, cleared if browser data
// is cleared. Uploaded "receipt" files are never stored, only metadata.
//
// Core rule this store enforces in code: Current Stock is NEVER a field you
// can set directly — it is always the sum of that item's transaction
// ledger (see src/utils/inventory.ts). Stock In/Out/Adjustment are the only
// ways stock changes, and Stock Out never lets stock go negative unless the
// reason is an explicit "Adjustment" (an authorized correction).
// ---------------------------------------------------------------------------

const STORAGE_KEY = "maia_demo_inventory_v1";

interface InventoryState {
  items: InventoryItem[];
  transactions: InventoryTransaction[];
  suppliers: Supplier[];
  materialPlans: BatchMaterialRequirement[];
}

function loadInitialState(): InventoryState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as InventoryState;
      if (parsed && Array.isArray(parsed.items)) return { ...parsed, materialPlans: parsed.materialPlans ?? [] };
    }
  } catch {
    // Corrupt/blocked localStorage falls back to seed demo data below.
  }
  return { items: DEMO_INVENTORY_ITEMS, transactions: DEMO_INVENTORY_TRANSACTIONS, suppliers: DEMO_SUPPLIERS, materialPlans: [] };
}

function persist(state: InventoryState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Demo-only persistence — safe to ignore quota/availability errors.
  }
}

function nowParts() {
  const d = new Date();
  return {
    iso: d.toISOString(),
    date: d.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }),
    time: d.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" }),
  };
}

export interface CreateItemInput {
  name: string;
  sku: string;
  category: InventoryCategory;
  supplierId: string | null;
  unit: string;
  reorderLevel: number;
  unitCost: number;
  location: string;
  notes: string;
}

export interface StockInInput {
  itemId: string;
  quantity: number;
  unitCost: number;
  supplierId: string | null;
  date: string;
  referenceNumber: string;
  relatedBatch: Batch | null;
  receipt: UploadedFileMeta | null;
  notes: string;
}

export interface StockOutInput {
  itemId: string;
  quantity: number;
  reason: StockOutReason;
  relatedBatch: Batch | null;
  relatedSessionId: string | null;
  releasedTo: string;
  date: string;
  notes: string;
}

export interface CreateSupplierInput {
  name: string;
  contactPerson: string;
  contactNumber: string;
  email: string;
  address: string;
  notes: string;
}

function reasonToTransactionType(reason: StockOutReason): InventoryTransaction["type"] {
  if (reason === "Damaged") return "Damaged";
  if (reason === "Lost") return "Lost";
  if (reason === "Adjustment") return "Adjustment";
  return "Stock Out";
}

interface InventoryStoreValue {
  items: InventoryItem[];
  transactions: InventoryTransaction[];
  suppliers: Supplier[];
  materialPlans: BatchMaterialRequirement[];
  getItemById: (id: string) => InventoryItem | undefined;
  getSupplierById: (id: string) => Supplier | undefined;
  createItem: (input: CreateItemInput) => InventoryItem;
  updateItem: (id: string, patch: Partial<CreateItemInput>) => void;
  setItemActive: (id: string, active: boolean) => void;
  recordStockIn: (input: StockInInput) => InventoryTransaction;
  /** Returns null (and does not record anything) if the requested quantity would take stock negative and the reason isn't an authorized Adjustment. */
  recordStockOut: (input: StockOutInput) => InventoryTransaction | null;
  createSupplier: (input: CreateSupplierInput) => Supplier;
  updateSupplier: (id: string, patch: Partial<CreateSupplierInput>) => void;
  setSupplierStatus: (id: string, status: SupplierStatus) => void;
  setMaterialRequirement: (batch: Batch, itemId: string, requiredQuantity: number) => void;
}

const InventoryStoreContext = createContext<InventoryStoreValue | undefined>(undefined);

export function InventoryStoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<InventoryState>(() => loadInitialState());

  const updateState = useCallback((updater: (prev: InventoryState) => InventoryState) => {
    setState((prev) => {
      const next = updater(prev);
      persist(next);
      return next;
    });
  }, []);

  const getItemById = useCallback((id: string) => state.items.find((i) => i.id === id), [state.items]);
  const getSupplierById = useCallback((id: string) => state.suppliers.find((s) => s.id === id), [state.suppliers]);

  const createItem = useCallback((input: CreateItemInput): InventoryItem => {
    const { iso } = nowParts();
    let created!: InventoryItem;
    updateState((prev) => {
      created = {
        id: crypto.randomUUID(),
        itemId: generateItemId(prev.items),
        name: input.name,
        sku: input.sku,
        category: input.category,
        supplierId: input.supplierId,
        unit: input.unit,
        reorderLevel: input.reorderLevel,
        unitCost: input.unitCost,
        location: input.location,
        active: true,
        notes: input.notes,
        createdAt: iso,
      };
      return { ...prev, items: [created, ...prev.items] };
    });
    return created;
  }, [updateState]);

  const updateItem = useCallback(
    (id: string, patch: Partial<CreateItemInput>) => {
      updateState((prev) => ({ ...prev, items: prev.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) }));
    },
    [updateState],
  );

  const setItemActive = useCallback(
    (id: string, active: boolean) => {
      updateState((prev) => ({ ...prev, items: prev.items.map((i) => (i.id === id ? { ...i, active } : i)) }));
    },
    [updateState],
  );

  const recordStockIn = useCallback(
    (input: StockInInput): InventoryTransaction => {
      const { iso } = nowParts();
      let created!: InventoryTransaction;
      updateState((prev) => {
        const previousStock = getCurrentStock(input.itemId, prev.transactions);
        created = {
          id: generateTransactionId(prev.transactions),
          itemId: input.itemId,
          type: "Stock In",
          quantity: input.quantity,
          previousStock,
          newStock: previousStock + input.quantity,
          unitCost: input.unitCost,
          supplierId: input.supplierId,
          reason: null,
          relatedBatch: input.relatedBatch,
          relatedSessionId: null,
          releasedTo: "",
          referenceNumber: input.referenceNumber,
          receipt: input.receipt,
          notes: input.notes,
          recordedBy: CURRENT_DEMO_USER,
          date: input.date,
          createdAt: iso,
        };
        return { ...prev, transactions: [created, ...prev.transactions] };
      });
      return created;
    },
    [updateState],
  );

  const recordStockOut = useCallback(
    (input: StockOutInput): InventoryTransaction | null => {
      const { iso } = nowParts();
      let created: InventoryTransaction | null = null;
      let blocked = false;

      updateState((prev) => {
        const previousStock = getCurrentStock(input.itemId, prev.transactions);
        if (input.quantity > previousStock && input.reason !== "Adjustment") {
          blocked = true;
          return prev;
        }
        created = {
          id: generateTransactionId(prev.transactions),
          itemId: input.itemId,
          type: reasonToTransactionType(input.reason),
          quantity: input.quantity,
          previousStock,
          newStock: previousStock - input.quantity,
          unitCost: null,
          supplierId: null,
          reason: input.reason,
          relatedBatch: input.relatedBatch,
          relatedSessionId: input.relatedSessionId,
          releasedTo: input.releasedTo,
          referenceNumber: "",
          receipt: null,
          notes: input.notes,
          recordedBy: CURRENT_DEMO_USER,
          date: input.date,
          createdAt: iso,
        };
        return { ...prev, transactions: [created, ...prev.transactions] };
      });

      return blocked ? null : created;
    },
    [updateState],
  );

  const createSupplier = useCallback((input: CreateSupplierInput): Supplier => {
    const { iso } = nowParts();
    let created!: Supplier;
    updateState((prev) => {
      created = {
        id: crypto.randomUUID(),
        name: input.name,
        contactPerson: input.contactPerson,
        contactNumber: input.contactNumber,
        email: input.email,
        address: input.address,
        notes: input.notes,
        status: "Active",
        createdAt: iso,
      };
      return { ...prev, suppliers: [created, ...prev.suppliers] };
    });
    return created;
  }, [updateState]);

  const updateSupplier = useCallback(
    (id: string, patch: Partial<CreateSupplierInput>) => {
      updateState((prev) => ({ ...prev, suppliers: prev.suppliers.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));
    },
    [updateState],
  );

  const setSupplierStatus = useCallback(
    (id: string, status: SupplierStatus) => {
      updateState((prev) => ({ ...prev, suppliers: prev.suppliers.map((s) => (s.id === id ? { ...s, status } : s)) }));
    },
    [updateState],
  );

  const setMaterialRequirement = useCallback(
    (batch: Batch, itemId: string, requiredQuantity: number) => {
      updateState((prev) => {
        const existing = prev.materialPlans.find((p) => p.batch === batch && p.itemId === itemId);
        if (existing) {
          return {
            ...prev,
            materialPlans: prev.materialPlans.map((p) => (p.id === existing.id ? { ...p, requiredQuantity } : p)),
          };
        }
        const plan: BatchMaterialRequirement = { id: crypto.randomUUID(), batch, itemId, requiredQuantity };
        return { ...prev, materialPlans: [...prev.materialPlans, plan] };
      });
    },
    [updateState],
  );

  const value = useMemo<InventoryStoreValue>(
    () => ({
      items: state.items,
      transactions: state.transactions,
      suppliers: state.suppliers,
      materialPlans: state.materialPlans,
      getItemById,
      getSupplierById,
      createItem,
      updateItem,
      setItemActive,
      recordStockIn,
      recordStockOut,
      createSupplier,
      updateSupplier,
      setSupplierStatus,
      setMaterialRequirement,
    }),
    [
      state,
      getItemById,
      getSupplierById,
      createItem,
      updateItem,
      setItemActive,
      recordStockIn,
      recordStockOut,
      createSupplier,
      updateSupplier,
      setSupplierStatus,
      setMaterialRequirement,
    ],
  );

  return <InventoryStoreContext.Provider value={value}>{children}</InventoryStoreContext.Provider>;
}

export function useInventoryStore() {
  const ctx = useContext(InventoryStoreContext);
  if (!ctx) throw new Error("useInventoryStore must be used within an InventoryStoreProvider");
  return ctx;
}
