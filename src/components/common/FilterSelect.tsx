import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export function FilterSelect({
  icon,
  value,
  onChange,
  options,
}: {
  icon?: ReactNode;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="relative flex items-center gap-2 rounded-lg border border-maia-border bg-maia-surface px-3 py-2 text-sm text-maia-ink shadow-sm">
      {icon && <span className="text-maia-gold-deep">{icon}</span>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="cursor-pointer appearance-none bg-transparent pr-5 text-sm font-medium text-maia-ink outline-none"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute right-2.5 text-maia-ink-soft" />
    </div>
  );
}
