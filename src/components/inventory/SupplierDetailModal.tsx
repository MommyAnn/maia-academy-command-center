import { Modal } from "@/components/common/Modal";
import { Badge } from "@/components/common/Badge";
import { SUPPLIER_STATUS_TONE } from "@/components/inventory/statusMeta";
import { useInventoryStore } from "@/data/inventoryStore";
import { getCurrentStock } from "@/utils/inventory";
import type { Supplier } from "@/types/inventory";

export function SupplierDetailModal({ open, onClose, supplier }: { open: boolean; onClose: () => void; supplier: Supplier }) {
  const { items, transactions } = useInventoryStore();
  const itemsSupplied = items.filter((i) => i.supplierId === supplier.id);

  return (
    <Modal open={open} onClose={onClose} title={supplier.name} size="lg">
      <div className="flex flex-col gap-4">
        <Badge tone={SUPPLIER_STATUS_TONE[supplier.status]}>{supplier.status}</Badge>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Contact Person" value={supplier.contactPerson || "—"} />
          <Field label="Contact Number" value={supplier.contactNumber || "—"} />
          <Field label="Email" value={supplier.email || "—"} />
          <Field label="Address" value={supplier.address || "—"} />
        </div>
        {supplier.notes && <Field label="Notes" value={supplier.notes} />}

        <div className="border-t border-maia-border pt-3">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-maia-ink-soft">Items Supplied</p>
          {itemsSupplied.length === 0 ? (
            <p className="text-sm text-maia-ink-soft">No items linked to this supplier yet.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {itemsSupplied.map((item) => (
                <li key={item.id} className="flex items-center justify-between rounded-lg bg-maia-bg px-3 py-2 text-sm">
                  <span className="text-maia-ink">{item.name}</span>
                  <span className="text-xs text-maia-ink-soft">{getCurrentStock(item.id, transactions)} {item.unit}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-maia-ink-soft">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-maia-ink">{value}</p>
    </div>
  );
}
