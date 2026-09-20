import { useState } from "react";
import { Calendar, ChevronDown, Layers } from "lucide-react";
import type { BatchFilter, DateRangeFilter } from "@/types";

const DATE_OPTIONS: { value: DateRangeFilter; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "this_week", label: "This Week" },
  { value: "this_month", label: "This Month" },
  { value: "this_year", label: "This Year" },
  { value: "all_time", label: "All Time" },
  { value: "custom", label: "Custom" },
];

const BATCH_OPTIONS: { value: BatchFilter; label: string }[] = [
  { value: "all", label: "All Batches" },
  { value: "batch_14", label: "Batch 14" },
  { value: "batch_13", label: "Batch 13" },
  { value: "batch_12", label: "Batch 12" },
];

export function DashboardFilters() {
  const [dateRange, setDateRange] = useState<DateRangeFilter>("this_month");
  const [batch, setBatch] = useState<BatchFilter>("all");

  return (
    <div className="flex flex-wrap items-center gap-3">
      <FilterSelect
        icon={<Calendar size={15} />}
        value={dateRange}
        onChange={(v) => setDateRange(v as DateRangeFilter)}
        options={DATE_OPTIONS}
      />
      <FilterSelect
        icon={<Layers size={15} />}
        value={batch}
        onChange={(v) => setBatch(v as BatchFilter)}
        options={BATCH_OPTIONS}
      />
    </div>
  );
}

function FilterSelect({
  icon,
  value,
  onChange,
  options,
}: {
  icon: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="relative flex items-center gap-2 rounded-lg border border-maia-border bg-maia-surface px-3 py-2 text-sm text-maia-ink shadow-sm">
      <span className="text-maia-gold-deep">{icon}</span>
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
