import { AlertTriangle } from "lucide-react";
import { Card } from "@/components/common/Card";
import type { AttentionItem, AttentionSeverity } from "@/types";

const SEVERITY_DOT: Record<AttentionSeverity, string> = {
  high: "bg-maia-danger",
  medium: "bg-maia-warning",
  low: "bg-maia-info",
};

export function NeedsAttentionCard({ items }: { items: AttentionItem[] }) {
  return (
    <Card>
      <div className="mb-5 flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-maia-danger-bg text-maia-danger">
          <AlertTriangle size={18} strokeWidth={1.75} />
        </div>
        <h3 className="font-display text-[15px] font-bold uppercase tracking-wide text-maia-ink">
          Needs Your Attention
        </h3>
      </div>

      {items.length === 0 ? (
        <p className="rounded-lg bg-maia-bg px-3 py-6 text-center text-sm text-maia-ink-soft">
          Nothing needs attention right now.
        </p>
      ) : (
        <ul className="space-y-1">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={item.onClick}
                disabled={!item.onClick}
                className="flex w-full items-center justify-between rounded-lg px-2.5 py-2.5 text-left transition-colors hover:bg-maia-bg disabled:cursor-default disabled:hover:bg-transparent"
              >
                <span className="flex items-center gap-2.5 text-sm text-maia-ink">
                  <span className={`h-2 w-2 flex-shrink-0 rounded-full ${SEVERITY_DOT[item.severity]}`} />
                  {item.label}
                </span>
                <span className="flex h-6 min-w-6 flex-shrink-0 items-center justify-center rounded-full bg-maia-bg px-1.5 text-xs font-bold text-maia-ink">
                  {item.count}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
