import { CalendarDays, MonitorPlay, Users } from "lucide-react";
import clsx from "clsx";
import type { AttendancePreference } from "@/types/student";

const ICONS: Record<AttendancePreference, React.ComponentType<{ size?: number; strokeWidth?: number }>> = {
  "Face-to-Face": Users,
  "Early Access via Zoom": MonitorPlay,
  Both: CalendarDays,
};

export function AttendanceOptionCard({
  value,
  label,
  description,
  selected,
  onSelect,
}: {
  value: AttendancePreference;
  label: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const Icon = ICONS[value];

  return (
    <button
      type="button"
      onClick={onSelect}
      className={clsx(
        "flex flex-col items-start gap-3 rounded-xl border-2 px-4 py-4 text-left transition-all",
        selected
          ? "border-maia-gold bg-maia-gold-bg/50 shadow-[0_0_0_3px_rgba(200,164,77,0.15)]"
          : "border-maia-border bg-maia-surface hover:border-maia-gold/50",
      )}
    >
      <div
        className={clsx(
          "flex h-10 w-10 items-center justify-center rounded-lg",
          selected ? "bg-maia-black text-maia-gold" : "bg-maia-bg text-maia-gold-deep",
        )}
      >
        <Icon size={19} strokeWidth={1.75} />
      </div>
      <div>
        <p className="text-sm font-bold text-maia-ink">{label}</p>
        <p className="mt-0.5 text-xs text-maia-ink-soft">{description}</p>
      </div>
    </button>
  );
}
