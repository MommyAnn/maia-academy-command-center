import { Calendar } from "lucide-react";
import { FilterSelect } from "@/components/common/FilterSelect";
import type { DateFilterValue, DateRangePreset } from "@/utils/finance";

const DATE_OPTIONS: { value: DateRangePreset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "this_week", label: "This Week" },
  { value: "this_month", label: "This Month" },
  { value: "this_year", label: "This Year" },
  { value: "all_time", label: "All Time" },
  { value: "custom", label: "Custom Date Range" },
];

export function DatePresetSelect({ value, onChange }: { value: DateFilterValue; onChange: (v: DateFilterValue) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <FilterSelect
        icon={<Calendar size={15} />}
        value={value.preset}
        onChange={(v) => onChange({ ...value, preset: v as DateRangePreset })}
        options={DATE_OPTIONS}
      />
      {value.preset === "custom" && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={value.from ?? ""}
            onChange={(e) => onChange({ ...value, from: e.target.value })}
            className="rounded-lg border border-maia-border bg-maia-surface px-3 py-2 text-sm text-maia-ink outline-none focus:border-maia-gold"
          />
          <span className="text-sm text-maia-ink-soft">to</span>
          <input
            type="date"
            value={value.to ?? ""}
            onChange={(e) => onChange({ ...value, to: e.target.value })}
            className="rounded-lg border border-maia-border bg-maia-surface px-3 py-2 text-sm text-maia-ink outline-none focus:border-maia-gold"
          />
        </div>
      )}
    </div>
  );
}

export const DEFAULT_DATE_FILTER: DateFilterValue = { preset: "all_time" };
