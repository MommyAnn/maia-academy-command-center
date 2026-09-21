import { useNavigate } from "react-router-dom";
import { Card, CardHeader } from "@/components/common/Card";
import { InventoryAlertsCard } from "@/components/dashboard/InventoryAlertsCard";
import { formatPeso } from "@/utils/format";
import type { InventoryAlert } from "@/types";

export function InventorySnapshotCard({
  snapshot,
  lowStockItems,
}: {
  snapshot: { totalItems: number; lowStock: number; outOfStock: number; inventoryValue: number };
  lowStockItems: InventoryAlert[];
}) {
  const navigate = useNavigate();

  const tiles = [
    { label: "Total Items", value: String(snapshot.totalItems), path: "/inventory/all-items" },
    { label: "Low Stock", value: String(snapshot.lowStock), path: "/inventory/low-stock", tone: "warning" as const },
    { label: "Out of Stock", value: String(snapshot.outOfStock), path: "/inventory/low-stock", tone: "danger" as const },
    { label: "Inventory Value", value: formatPeso(snapshot.inventoryValue), path: "/inventory/all-items" },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader title="Inventory Status" subtitle="Live snapshot from the Inventory module (Step 6)." />
        <div className="grid grid-cols-2 gap-3">
          {tiles.map((tile) => (
            <button
              key={tile.label}
              onClick={() => navigate(tile.path)}
              className="rounded-xl bg-maia-bg px-3.5 py-3 text-left transition-colors hover:bg-maia-gold-bg"
            >
              <p
                className={`font-display text-xl font-extrabold leading-none ${
                  tile.tone === "danger" ? "text-maia-danger" : tile.tone === "warning" ? "text-maia-warning" : "text-maia-ink"
                }`}
              >
                {tile.value}
              </p>
              <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-wide text-maia-ink-soft">{tile.label}</p>
            </button>
          ))}
        </div>
      </Card>
      <InventoryAlertsCard items={lowStockItems} />
    </div>
  );
}
