import { useMemo, useState } from "react";
import { History } from "lucide-react";
import { Card } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { SearchInput } from "@/components/common/SearchInput";
import { FilterSelect } from "@/components/common/FilterSelect";
import { INVENTORY_TRANSACTION_TYPE_TONE } from "@/components/inventory/statusMeta";
import { useInventoryStore } from "@/data/inventoryStore";
import { INVENTORY_TRANSACTION_TYPES } from "@/types/inventory";

export function InventoryHistory() {
  const { items, transactions } = useInventoryStore();
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");

  const sorted = useMemo(
    () => [...transactions].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [transactions],
  );

  const filtered = sorted.filter((t) => {
    const item = items.find((i) => i.id === t.itemId);
    const searchable = `${item?.name ?? ""} ${item?.itemId ?? ""} ${t.id} ${t.notes}`.toLowerCase();
    if (search.trim() && !searchable.includes(search.trim().toLowerCase())) return false;
    if (type !== "all" && t.type !== type) return false;
    return true;
  });

  return (
    <div className="flex flex-col gap-6 pb-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-maia-gold-deep">Inventory</p>
        <h1 className="mt-1 font-display text-2xl font-extrabold text-maia-ink sm:text-[28px]">Inventory History</h1>
        <p className="mt-1 text-sm text-maia-ink-soft">
          Every stock movement, ever recorded — Current Stock is always derived from this ledger, never overwritten.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search by item, transaction ID, notes..." />
        <FilterSelect
          value={type}
          onChange={setType}
          options={[{ value: "all", label: "All Types" }, ...INVENTORY_TRANSACTION_TYPES.map((t) => ({ value: t, label: t }))]}
        />
      </div>

      <Card padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-maia-border bg-maia-bg/60 text-left text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">
                <th className="px-4 py-3">Transaction ID</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Item</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Quantity</th>
                <th className="px-4 py-3">Previous Stock</th>
                <th className="px-4 py-3">New Stock</th>
                <th className="px-4 py-3">Related Batch</th>
                <th className="px-4 py-3">Recorded By</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => {
                const item = items.find((i) => i.id === t.itemId);
                return (
                  <tr key={t.id} className="border-b border-maia-border/60 last:border-0 hover:bg-maia-bg/40">
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-semibold text-maia-ink">{t.id}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{t.date}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-maia-ink">{item?.name ?? "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Badge tone={INVENTORY_TRANSACTION_TYPE_TONE[t.type]}>{t.type}</Badge>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{t.quantity}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{t.previousStock}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-semibold text-maia-ink">{t.newStock}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{t.relatedBatch ?? "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{t.recordedBy}</td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-sm text-maia-ink-soft">
                    <History className="mx-auto mb-2 text-maia-ink-soft/50" size={22} />
                    No transactions match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
