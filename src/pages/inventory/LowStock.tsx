import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { Card } from "@/components/common/Card";
import { Button } from "@/components/common/Button";
import { StockInModal } from "@/components/inventory/StockInModal";
import { ItemDetailModal } from "@/components/inventory/ItemDetailModal";
import { SupplierDetailModal } from "@/components/inventory/SupplierDetailModal";
import { useInventoryStore } from "@/data/inventoryStore";
import { getCurrentStock, getInventoryItemStatus } from "@/utils/inventory";
import type { InventoryItem, Supplier } from "@/types/inventory";

export function LowStock() {
  const { items, transactions, getSupplierById } = useInventoryStore();
  const navigate = useNavigate();
  const [stockInFor, setStockInFor] = useState<string | null>(null);
  const [viewingItem, setViewingItem] = useState<InventoryItem | null>(null);
  const [viewingSupplier, setViewingSupplier] = useState<Supplier | null>(null);

  const lowStockRows = useMemo(() => {
    return items
      .map((item) => {
        const stock = getCurrentStock(item.id, transactions);
        const status = getInventoryItemStatus(item, stock);
        return { item, stock, status };
      })
      .filter((r) => r.status === "Low Stock" || r.status === "Out of Stock");
  }, [items, transactions]);

  return (
    <div className="flex flex-col gap-6 pb-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-maia-gold-deep">Inventory</p>
        <h1 className="mt-1 font-display text-2xl font-extrabold text-maia-ink sm:text-[28px]">Low Stock</h1>
        <p className="mt-1 text-sm text-maia-ink-soft">
          Items where current stock has reached or dropped below their reorder level.
        </p>
      </div>

      <Card padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-maia-border bg-maia-bg/60 text-left text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">
                <th className="px-4 py-3">Item</th>
                <th className="px-4 py-3">Current Stock</th>
                <th className="px-4 py-3">Reorder Level</th>
                <th className="px-4 py-3">Suggested Quantity</th>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {lowStockRows.map(({ item, stock }) => {
                const suggested = Math.max(item.reorderLevel * 2 - stock, item.reorderLevel);
                const supplier = item.supplierId ? getSupplierById(item.supplierId) : undefined;
                return (
                  <tr key={item.id} className="border-b border-maia-border/60 last:border-0 hover:bg-maia-bg/40">
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-maia-ink">{item.name}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-semibold text-maia-danger">
                      {stock} {item.unit}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{item.reorderLevel}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{suggested}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{supplier?.name ?? "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        <Button size="sm" onClick={() => setStockInFor(item.id)}>
                          STOCK IN
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => setViewingItem(item)}>
                          VIEW ITEM
                        </Button>
                        {supplier && (
                          <Button size="sm" variant="ghost" onClick={() => setViewingSupplier(supplier)}>
                            VIEW SUPPLIER
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {lowStockRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-maia-ink-soft">
                    <AlertTriangle className="mx-auto mb-2 text-maia-ink-soft/50" size={22} />
                    Nothing is low on stock right now.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="flex justify-end">
        <button onClick={() => navigate("/inventory/all-items")} className="text-xs font-semibold text-maia-gold-deep hover:underline">
          View all inventory items →
        </button>
      </div>

      {stockInFor && <StockInModal open={Boolean(stockInFor)} onClose={() => setStockInFor(null)} defaultItemId={stockInFor} />}
      {viewingItem && <ItemDetailModal open={Boolean(viewingItem)} onClose={() => setViewingItem(null)} item={viewingItem} />}
      {viewingSupplier && (
        <SupplierDetailModal open={Boolean(viewingSupplier)} onClose={() => setViewingSupplier(null)} supplier={viewingSupplier} />
      )}
    </div>
  );
}
