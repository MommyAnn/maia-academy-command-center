import { useNavigate } from "react-router-dom";
import { PackageSearch } from "lucide-react";
import { Card, CardHeader } from "@/components/common/Card";
import { Button } from "@/components/common/Button";
import type { InventoryAlert } from "@/types";

export function InventoryAlertsCard({ items }: { items: InventoryAlert[] }) {
  const navigate = useNavigate();

  return (
    <Card>
      <CardHeader title="Inventory Alerts" />

      <ul className="space-y-2.5">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex items-center justify-between rounded-lg bg-maia-bg px-3 py-2.5"
          >
            <span className="flex items-center gap-2.5 text-sm text-maia-ink">
              <PackageSearch size={16} className="text-maia-gold-deep" />
              {item.item}
            </span>
            <span className="text-sm font-semibold text-maia-warning">
              {item.remaining} Remaining
            </span>
          </li>
        ))}
      </ul>

      <Button
        variant="secondary"
        className="mt-5 w-full justify-center"
        onClick={() => navigate("/inventory/low-stock")}
      >
        VIEW INVENTORY
      </Button>
    </Card>
  );
}
