import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Card } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { SearchInput } from "@/components/common/SearchInput";
import { StockOutModal } from "@/components/inventory/StockOutModal";
import { useInventoryStore } from "@/data/inventoryStore";

export function StockOut() {
  const { items, transactions } = useInventoryStore();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const rows = useMemo(
    () => transactions.filter((t) => t.type === "Stock Out" || t.type === "Damaged" || t.type === "Lost"),
    [transactions],
  );

  const filtered = rows.filter((t) => {
    const item = items.find((i) => i.id === t.itemId);
    const searchable = `${item?.name ?? ""} ${item?.itemId ?? ""} ${t.releasedTo}`.toLowerCase();
    return !search.trim() || searchable.includes(search.trim().toLowerCase());
  });

  return (
    <div className="flex flex-col gap-6 pb-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-maia-gold-deep">Inventory</p>
          <h1 className="mt-1 font-display text-2xl font-extrabold text-maia-ink sm:text-[28px]">Stock Out</h1>
          <p className="mt-1 text-sm text-maia-ink-soft">{rows.length} stock-out transactions recorded.</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus size={15} />
          STOCK OUT
        </Button>
      </div>

      <SearchInput value={search} onChange={setSearch} placeholder="Search by item, released to..." />

      <Card padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-maia-border bg-maia-bg/60 text-left text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">
                <th className="px-4 py-3">Transaction ID</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Item</th>
                <th className="px-4 py-3">Quantity</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Related Batch</th>
                <th className="px-4 py-3">Released To</th>
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
                    <td className="whitespace-nowrap px-4 py-3 font-semibold text-maia-danger">-{t.quantity}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Badge tone="neutral">{t.reason ?? t.type}</Badge>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{t.relatedBatch ?? "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{t.releasedTo || "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{t.recordedBy}</td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-maia-ink-soft">
                    No stock-out transactions match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <StockOutModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
