import type { ReactNode } from "react";
import clsx from "clsx";

type BadgeTone = "success" | "warning" | "danger" | "info" | "neutral" | "gold";

const TONE_CLASSES: Record<BadgeTone, string> = {
  success: "bg-maia-success-bg text-maia-success",
  warning: "bg-maia-warning-bg text-maia-warning",
  danger: "bg-maia-danger-bg text-maia-danger",
  info: "bg-maia-info-bg text-maia-info",
  neutral: "bg-maia-bg text-maia-ink-soft border border-maia-border",
  gold: "bg-maia-gold-bg text-maia-gold-deep",
};

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: BadgeTone }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        TONE_CLASSES[tone],
      )}
    >
      {children}
    </span>
  );
}
