import { Layers } from "lucide-react";
import { FilterSelect } from "@/components/common/FilterSelect";
import { BATCH_OPTIONS } from "@/data/enrollmentConfig";
import { DatePresetSelect } from "./DatePresetSelect";
import type { DateFilterValue } from "@/utils/finance";

export { DEFAULT_DATE_FILTER } from "./DatePresetSelect";

export function FinanceDateFilter({
  value,
  onChange,
  batch,
  onBatchChange,
}: {
  value: DateFilterValue;
  onChange: (v: DateFilterValue) => void;
  batch: string;
  onBatchChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <DatePresetSelect value={value} onChange={onChange} />
      <FilterSelect
        icon={<Layers size={15} />}
        value={batch}
        onChange={onBatchChange}
        options={[{ value: "all", label: "All Batches" }, ...BATCH_OPTIONS.map((b) => ({ value: b, label: b }))]}
      />
    </div>
  );
}
