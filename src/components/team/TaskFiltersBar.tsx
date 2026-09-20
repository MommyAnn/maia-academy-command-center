import { AlertOctagon, Flag, ListFilter, User } from "lucide-react";
import { SearchInput } from "@/components/common/SearchInput";
import { FilterSelect } from "@/components/common/FilterSelect";
import { TASK_CATEGORIES, TASK_PRIORITIES, TASK_STATUSES } from "@/types/task";
import type { StaffRecord } from "@/types/staff";

export interface TaskFiltersState {
  search: string;
  status: string;
  priority: string;
  category: string;
  assignee: string;
}

export const DEFAULT_TASK_FILTERS: TaskFiltersState = {
  search: "",
  status: "all",
  priority: "all",
  category: "all",
  assignee: "all",
};

export function TaskFiltersBar({
  filters,
  onChange,
  staff,
}: {
  filters: TaskFiltersState;
  onChange: (next: TaskFiltersState) => void;
  staff: StaffRecord[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <SearchInput
        value={filters.search}
        onChange={(v) => onChange({ ...filters, search: v })}
        placeholder="Search tasks, students, IDs..."
      />
      <FilterSelect
        icon={<ListFilter size={15} />}
        value={filters.status}
        onChange={(v) => onChange({ ...filters, status: v })}
        options={[{ value: "all", label: "All Statuses" }, ...TASK_STATUSES.map((s) => ({ value: s, label: s }))]}
      />
      <FilterSelect
        icon={<Flag size={15} />}
        value={filters.priority}
        onChange={(v) => onChange({ ...filters, priority: v })}
        options={[{ value: "all", label: "All Priorities" }, ...TASK_PRIORITIES.map((p) => ({ value: p, label: p }))]}
      />
      <FilterSelect
        icon={<AlertOctagon size={15} />}
        value={filters.category}
        onChange={(v) => onChange({ ...filters, category: v })}
        options={[{ value: "all", label: "All Categories" }, ...TASK_CATEGORIES.map((c) => ({ value: c, label: c }))]}
      />
      <FilterSelect
        icon={<User size={15} />}
        value={filters.assignee}
        onChange={(v) => onChange({ ...filters, assignee: v })}
        options={[{ value: "all", label: "All Staff" }, ...staff.map((s) => ({ value: s.id, label: s.fullName }))]}
      />
    </div>
  );
}

export function matchesTaskFilters(
  filters: TaskFiltersState,
  fields: { searchable: string; status: string; priority: string; category: string; assignee: string },
): boolean {
  const search = filters.search.trim().toLowerCase();
  if (search && !fields.searchable.toLowerCase().includes(search)) return false;
  if (filters.status !== "all" && fields.status !== filters.status) return false;
  if (filters.priority !== "all" && fields.priority !== filters.priority) return false;
  if (filters.category !== "all" && fields.category !== filters.category) return false;
  if (filters.assignee !== "all" && fields.assignee !== filters.assignee) return false;
  return true;
}
