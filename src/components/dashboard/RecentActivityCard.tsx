import { Card, CardHeader } from "@/components/common/Card";
import type { ActivityItem } from "@/types";

export function RecentActivityCard({ items }: { items: ActivityItem[] }) {
  return (
    <Card>
      <CardHeader title="Recent Activity" />
      <ul className="relative space-y-5 pl-1">
        {items.map((item, idx) => (
          <li key={item.id} className="relative flex gap-3 pl-5">
            <span className="absolute left-0 top-1.5 h-2 w-2 rounded-full bg-maia-gold ring-4 ring-maia-gold-bg" />
            {idx < items.length - 1 && (
              <span className="absolute left-[3px] top-3.5 h-[calc(100%+8px)] w-px bg-maia-border" />
            )}
            <div>
              <p className="text-sm text-maia-ink">{item.message}</p>
              <p className="mt-0.5 text-xs text-maia-ink-soft">{item.timestamp}</p>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
