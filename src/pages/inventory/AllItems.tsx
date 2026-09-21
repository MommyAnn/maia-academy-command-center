import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Boxes, Layers, Package, PackageX, Plus, TrendingUp } from "lucide-react";
import { Card } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { SearchInput } from "@/components/common/SearchInput";
import { FilterSelect } from "@/components/common/FilterSelect";
import { FinanceStatCard } from "@/components/finance/FinanceStatCard";
import { INVENTORY_ITEM_STATUS_TONE } from "@/components/inventory/statusMeta";
import { ItemFormModal } from "@/components/inventory/ItemFormModal";
import { StockInModal } from "@/components/inventory/StockInModal";
import { StockOutModal } from "@/components/inventory/StockOutModal";
import { ItemDetailModal } from "@/components/inventory/ItemDetailModal";
import { useInventoryStore } from "@/data/inventoryStore";
import { INVENTORY_CATEGORIES, INVENTORY_ITEM_STATUSES, type InventoryItem } from "@/types/inventory";
import { getCurrentStock, getInventoryItemStatus, getInventoryValue } from "@/utils/inventory";
import { formatNumber, formatPeso } from "@/utils/format";

export function AllItems() {
  const { items, transactions, getSupplierById } = useInventoryStore();
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [stockInFor, setStockInFor] = useState<string | null>(null);
  const [stockOutFor, setStockOutFor] = useState<string | null>(null);
  const [viewingItem, setViewingItem] = useState<InventoryItem | null>(null);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

  const rows = useMemo(
    () =>
      items.map((item) => {
        const stock = getCurrentStock(item.id, transactions);
        return { item, stock, status: getInventoryItemStatus(item, stock) };
      }),
    [items, transactions],
  );

  const totalItems = items.length;
  const totalQuantity = rows.reduce((sum, r) => sum + r.stock, 0);
  const lowStockCount = rows.filter((r) => r.status === "Low Stock").length;
  const outOfStockCount = rows.filter((r) => r.status === "Out of Stock").length;
  const totalValue = getInventoryValue(items, transactions);
  const now = new Date();
  const recentMovements = transactions.filter((t) => {
    const days = (now.getTime() - new Date(t.createdAt).getTime()) / 86_400_000;
    return days <= 7;
  }).length;

  const filtered = rows.filter(({ item, status: itemStatus }) => {
    const searchable = `${item.name} ${item.itemId} ${item.sku}`.toLowerCase();
    if (search.trim() && !searchable.includes(search.trim().toLowerCase())) return false;
    if (category !== "all" && item.category !== category) return false;
    if (status !== "all" && itemStatus !== status) return false;
    return true;
  });

  return (
    <div className="flex flex-col gap-6 pb-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-maia-gold-deep">Inventory</p>
          <h1 className="mt-1 font-display text-2xl font-extrabold text-maia-ink sm:text-[28px]">All Items</h1>
          <p className="mt-1 text-sm text-maia-ink-soft">{totalItems} items tracked across all categories.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus size={15} />
          ADD ITEM
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <FinanceStatCard label="Total Items" value={formatNumber(totalItems)} icon={<Package size={18} />} />
        <FinanceStatCard label="Total Stock Quantity" value={formatNumber(totalQuantity)} icon={<Boxes size={18} />} />
        <FinanceStatCard label="Low Stock Items" value={formatNumber(lowStockCount)} icon={<AlertTriangle size={18} />} accent={lowStockCount > 0 ? "danger" : "neutral"} />
        <FinanceStatCard label="Out of Stock" value={formatNumber(outOfStockCount)} icon={<PackageX size={18} />} accent={outOfStockCount > 0 ? "danger" : "neutral"} />
        <FinanceStatCard label="Total Inventory Value" value={formatPeso(totalValue)} icon={<Layers size={18} />} accent="gold" />
        <FinanceStatCard label="Recent Stock Movements" value={formatNumber(recentMovements)} helperText="Last 7 days" icon={<TrendingUp size={18} />} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search by name, item ID, or SKU..." />
        <FilterSelect
          value={category}
          onChange={setCategory}
          options={[{ value: "all", label: "All Categories" }, ...INVENTORY_CATEGORIES.map((c) => ({ value: c, label: c }))]}
        />
        <FilterSelect
          value={status}
          onChange={setStatus}
          options={[{ value: "all", label: "All Statuses" }, ...INVENTORY_ITEM_STATUSES.map((s) => ({ value: s, label: s }))]}
        />
      </div>

      <Card padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-maia-border bg-maia-bg/60 text-left text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">
                <th className="px-4 py-3">Item ID</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">Stock</th>
                <th className="px-4 py-3">Reorder Level</th>
                <th className="px-4 py-3">Unit Cost</th>
                <th className="px-4 py-3">Value</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(({ item, stock, status: itemStatus }) => (
                <tr key={item.id} className="border-b border-maia-border/60 last:border-0 hover:bg-maia-bg/40">
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-semibold text-maia-ink">{item.itemId}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-maia-ink">{item.name}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{item.category}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">
                    {item.supplierId ? getSupplierById(item.supplierId)?.name ?? "—" : "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-maia-ink">
                    {stock} {item.unit}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{item.reorderLevel}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{formatPeso(item.unitCost)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{formatPeso(stock * item.unitCost)}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <Badge tone={INVENTORY_ITEM_STATUS_TONE[itemStatus]}>{itemStatus}</Badge>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      <Button size="sm" variant="secondary" onClick={() => setStockInFor(item.id)}>
                        STOCK IN
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => setStockOutFor(item.id)}>
                        STOCK OUT
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setViewingItem(item)}>
                        VIEW
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingItem(item)}>
                        EDIT
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-sm text-maia-ink-soft">
                    No items match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="flex justify-end">
        <button onClick={() => navigate("/inventory/history")} className="text-xs font-semibold text-maia-gold-deep hover:underline">
          View full Inventory History →
        </button>
      </div>

      <ItemFormModal open={createOpen} onClose={() => setCreateOpen(false)} />
      {editingItem && <ItemFormModal open={Boolean(editingItem)} onClose={() => setEditingItem(null)} editingItem={editingItem} />}
      {viewingItem && <ItemDetailModal open={Boolean(viewingItem)} onClose={() => setViewingItem(null)} item={viewingItem} />}
      {stockInFor && <StockInModal open={Boolean(stockInFor)} onClose={() => setStockInFor(null)} defaultItemId={stockInFor} />}
      {stockOutFor && <StockOutModal open={Boolean(stockOutFor)} onClose={() => setStockOutFor(null)} defaultItemId={stockOutFor} />}
    </div>
  );
}
