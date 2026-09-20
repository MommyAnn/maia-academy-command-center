import type { ReactNode } from "react";
import clsx from "clsx";
import { Card } from "@/components/common/Card";
import { InfoTooltip } from "@/components/common/InfoTooltip";

export function FinanceStatCard({
  label,
  value,
  helperText,
  icon,
  tooltip,
  accent = "neutral",
}: {
  label: string;
  value: string;
  helperText?: string;
  icon: ReactNode;
  tooltip?: string;
  accent?: "gold" | "neutral" | "warning" | "danger";
}) {
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <p className="flex items-center gap-1.5 text-[13px] font-semibold uppercase tracking-wide text-maia-ink-soft">
          {label}
          {tooltip && <InfoTooltip text={tooltip} />}
        </p>
        <div
          className={clsx(
            "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg",
            accent === "gold" && "bg-maia-black text-maia-gold",
            accent === "neutral" && "bg-maia-gold-bg text-maia-gold-deep",
            accent === "warning" && "bg-maia-warning-bg text-maia-warning",
            accent === "danger" && "bg-maia-danger-bg text-maia-danger",
          )}
        >
          {icon}
        </div>
      </div>
      <div>
        <p className="font-display text-[26px] font-extrabold leading-none text-maia-ink">{value}</p>
        {helperText && <p className="mt-2 text-sm text-maia-ink-soft">{helperText}</p>}
      </div>
    </Card>
  );
}
