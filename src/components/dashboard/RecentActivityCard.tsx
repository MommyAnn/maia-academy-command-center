import type { ReactNode } from "react";
import { Card, CardHeader } from "@/components/common/Card";
import type { ActivityItem } from "@/types";

export function RecentActivityCard({
  items,
  title = "Recent Activity",
  emptyMessage = "No activity recorded yet.",
  action,
}: {
  items: ActivityItem[];
  title?: string;
  emptyMessage?: string;
  action?: ReactNode;
}) {
  return (
    <Card>
      <CardHeader title={title} action={action} />
      {items.length === 0 ? (
        <p className="rounded-lg bg-maia-bg px-3 py-6 text-center text-sm text-maia-ink-soft">{emptyMessage}</p>
      ) : (
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
      )}
    </Card>
  );
}
