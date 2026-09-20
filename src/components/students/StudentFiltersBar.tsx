import { Layers, ListFilter, Package } from "lucide-react";
import { SearchInput } from "@/components/common/SearchInput";
import { FilterSelect } from "@/components/common/FilterSelect";
import { BATCH_OPTIONS, PACKAGE_OPTIONS } from "@/data/enrollmentConfig";

export interface StudentFiltersState {
  search: string;
  batch: string;
  pkg: string;
  status: string;
}

export function StudentFiltersBar({
  filters,
  onChange,
  statusOptions,
  searchPlaceholder,
}: {
  filters: StudentFiltersState;
  onChange: (next: StudentFiltersState) => void;
  statusOptions: { value: string; label: string }[];
  searchPlaceholder: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <SearchInput
        value={filters.search}
        onChange={(v) => onChange({ ...filters, search: v })}
        placeholder={searchPlaceholder}
      />
      <FilterSelect
        icon={<Layers size={15} />}
        value={filters.batch}
        onChange={(v) => onChange({ ...filters, batch: v })}
        options={[{ value: "all", label: "All Batches" }, ...BATCH_OPTIONS.map((b) => ({ value: b, label: b }))]}
      />
      <FilterSelect
        icon={<Package size={15} />}
        value={filters.pkg}
        onChange={(v) => onChange({ ...filters, pkg: v })}
        options={[{ value: "all", label: "All Packages" }, ...PACKAGE_OPTIONS.map((p) => ({ value: p, label: p }))]}
      />
      <FilterSelect
        icon={<ListFilter size={15} />}
        value={filters.status}
        onChange={(v) => onChange({ ...filters, status: v })}
        options={statusOptions}
      />
    </div>
  );
}

export const DEFAULT_STUDENT_FILTERS: StudentFiltersState = {
  search: "",
  batch: "all",
  pkg: "all",
  status: "all",
};

export function matchesStudentFilters(
  filters: StudentFiltersState,
  fields: { searchable: string; batch: string; pkg: string; status: string },
): boolean {
  const search = filters.search.trim().toLowerCase();
  if (search && !fields.searchable.toLowerCase().includes(search)) return false;
  if (filters.batch !== "all" && fields.batch !== filters.batch) return false;
  if (filters.pkg !== "all" && fields.pkg !== filters.pkg) return false;
  if (filters.status !== "all" && fields.status !== filters.status) return false;
  return true;
}
