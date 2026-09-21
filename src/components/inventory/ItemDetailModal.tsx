import { Modal } from "@/components/common/Modal";
import { Badge } from "@/components/common/Badge";
import { INVENTORY_ITEM_STATUS_TONE, INVENTORY_TRANSACTION_TYPE_TONE } from "@/components/inventory/statusMeta";
import { useInventoryStore } from "@/data/inventoryStore";
import { getCurrentStock, getInventoryItemStatus } from "@/utils/inventory";
import { formatPeso } from "@/utils/format";
import type { InventoryItem } from "@/types/inventory";

export function ItemDetailModal({ open, onClose, item }: { open: boolean; onClose: () => void; item: InventoryItem }) {
  const { transactions, getSupplierById } = useInventoryStore();
  const stock = getCurrentStock(item.id, transactions);
  const status = getInventoryItemStatus(item, stock);
  const supplier = item.supplierId ? getSupplierById(item.supplierId) : undefined;
  const history = transactions.filter((t) => t.itemId === item.id).slice(0, 10);

  return (
    <Modal open={open} onClose={onClose} title={item.name} size="lg">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs font-semibold text-maia-ink-soft">{item.itemId}</span>
          <Badge tone={INVENTORY_ITEM_STATUS_TONE[status]}>{status}</Badge>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Field label="Category" value={item.category} />
          <Field label="SKU" value={item.sku || "—"} />
          <Field label="Unit" value={item.unit} />
          <Field label="Current Stock" value={String(stock)} />
          <Field label="Reorder Level" value={String(item.reorderLevel)} />
          <Field label="Unit Cost" value={formatPeso(item.unitCost)} />
          <Field label="Inventory Value" value={formatPeso(stock * item.unitCost)} />
          <Field label="Location" value={item.location || "—"} />
          <Field label="Supplier" value={supplier?.name ?? "—"} />
        </div>
        {item.notes && <Field label="Notes" value={item.notes} />}

        <div className="border-t border-maia-border pt-3">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-maia-ink-soft">Recent Transactions</p>
          {history.length === 0 ? (
            <p className="text-sm text-maia-ink-soft">No transactions yet.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {history.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-2 rounded-lg bg-maia-bg px-3 py-2 text-xs">
                  <span className="flex items-center gap-2">
                    <Badge tone={INVENTORY_TRANSACTION_TYPE_TONE[t.type]}>{t.type}</Badge>
                    <span className="text-maia-ink-soft">{t.date}</span>
                  </span>
                  <span className="font-semibold text-maia-ink">
                    {t.type === "Stock In" ? "+" : "-"}
                    {t.quantity}
                  </span>
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
