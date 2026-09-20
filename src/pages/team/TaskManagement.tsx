import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ClipboardList, LayoutTemplate, Plus, X } from "lucide-react";
import { Card } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { Tabs } from "@/components/common/Tabs";
import { TaskFiltersBar, DEFAULT_TASK_FILTERS, matchesTaskFilters } from "@/components/team/TaskFiltersBar";
import { TaskFormModal } from "@/components/team/TaskFormModal";
import { ApplyTemplateModal } from "@/components/team/ApplyTemplateModal";
import { TASK_STATUS_TONE, TASK_PRIORITY_TONE } from "@/components/team/statusMeta";
import { useTaskStore } from "@/data/taskStore";
import { useStaffStore } from "@/data/staffStore";
import { useAuth } from "@/context/AuthContext";
import { isTaskDueToday, isTaskOverdue } from "@/utils/staffTasks";
import type { TaskRecord } from "@/types/task";

type ViewTab = "my" | "all" | "due-today" | "overdue" | "upcoming" | "for-review" | "completed";

const VIEW_TABS: { value: ViewTab; label: string }[] = [
  { value: "my", label: "My Tasks" },
  { value: "all", label: "All Tasks" },
  { value: "due-today", label: "Due Today" },
  { value: "overdue", label: "Overdue" },
  { value: "upcoming", label: "Upcoming" },
  { value: "for-review", label: "For Review" },
  { value: "completed", label: "Completed" },
];

export function TaskManagement() {
  const { tasks } = useTaskStore();
  const { staff } = useStaffStore();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const currentStaff = staff.find((s) => s.email === user?.email);

  const [view, setView] = useState<ViewTab>(() => {
    const raw = searchParams.get("view");
    return VIEW_TABS.some((v) => v.value === raw) ? (raw as ViewTab) : "all";
  });
  const [filters, setFilters] = useState(() => ({
    ...DEFAULT_TASK_FILTERS,
    status: searchParams.get("status") ?? DEFAULT_TASK_FILTERS.status,
    assignee: searchParams.get("assignee") ?? DEFAULT_TASK_FILTERS.assignee,
  }));
  const [batchFilter] = useState(() => searchParams.get("batch"));
  const [dashboardBanner] = useState(
    () => searchParams.get("view") || searchParams.get("status") || searchParams.get("assignee") || searchParams.get("batch"),
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);

  const now = new Date();

  const viewFiltered = useMemo(() => {
    switch (view) {
      case "my":
        return currentStaff ? tasks.filter((t) => t.assignedTo === currentStaff.id) : [];
      case "due-today":
        return tasks.filter((t) => isTaskDueToday(t, now));
      case "overdue":
        return tasks.filter((t) => isTaskOverdue(t, now));
      case "upcoming":
        return tasks.filter((t) => {
          const due = new Date(`${t.dueDate}T00:00:00`);
          const diffDays = (due.getTime() - now.getTime()) / 86_400_000;
          return diffDays > 0 && diffDays <= 7 && (t.status === "To Do" || t.status === "In Progress");
        });
      case "for-review":
        return tasks.filter((t) => t.status === "For Review");
      case "completed":
        return tasks.filter((t) => t.status === "Completed");
      default:
        return tasks;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, tasks, currentStaff]);

  const filtered = useMemo(
    () =>
      viewFiltered
        .filter((t) => !batchFilter || t.relatedBatch === batchFilter)
        .filter((t) =>
          matchesTaskFilters(filters, {
            searchable: `${t.id} ${t.title} ${t.relatedStudentName ?? ""} ${t.assignedToName}`,
            status: t.status,
            priority: t.priority,
            category: t.category,
            assignee: t.assignedTo,
          }),
        ),
    [viewFiltered, filters, batchFilter],
  );

  const sorted = useMemo(
    () => [...filtered].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()),
    [filtered],
  );

  return (
    <div className="flex flex-col gap-6 pb-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-maia-gold-deep">Team</p>
          <h1 className="mt-1 font-display text-2xl font-extrabold text-maia-ink sm:text-[28px]">Task Management</h1>
          <p className="mt-1 text-sm text-maia-ink-soft">{tasks.length} tasks tracked across every staff member.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setTemplateOpen(true)}>
            <LayoutTemplate size={15} />
            APPLY TEMPLATE
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus size={15} />
            NEW TASK
          </Button>
        </div>
      </div>

      {dashboardBanner && (
        <div className="flex items-center justify-between rounded-lg border border-maia-gold/30 bg-maia-gold-bg px-4 py-2.5 text-sm text-maia-gold-deep">
          <span className="font-medium">Filtered from dashboard</span>
          <button onClick={() => navigate("/team/tasks", { replace: true })} className="flex items-center gap-1 rounded-md px-2 py-1 font-semibold hover:bg-maia-gold/15">
            <X size={13} />
            Clear
          </button>
        </div>
      )}

      <Tabs tabs={VIEW_TABS} active={view} onChange={(v) => setView(v as ViewTab)} />

      <TaskFiltersBar filters={filters} onChange={setFilters} staff={staff} />

      <Card padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-maia-border bg-maia-bg/60 text-left text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">
                <Th>Task ID</Th>
                <Th>Title</Th>
                <Th>Category</Th>
                <Th>Priority</Th>
                <Th>Status</Th>
                <Th>Assigned To</Th>
                <Th>Related Student</Th>
                <Th>Due Date</Th>
                <Th>Action</Th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((t) => (
                <TaskRow key={t.id} task={t} onView={() => navigate(`/team/tasks/${encodeURIComponent(t.id)}`)} />
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-sm text-maia-ink-soft">
                    <ClipboardList className="mx-auto mb-2 text-maia-ink-soft/50" size={22} />
                    No tasks match this view.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <TaskFormModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <ApplyTemplateModal open={templateOpen} onClose={() => setTemplateOpen(false)} />
    </div>
  );
}

function TaskRow({ task, onView }: { task: TaskRecord; onView: () => void }) {
  const overdue = isTaskOverdue(task);
  return (
    <tr className="border-b border-maia-border/60 last:border-0 hover:bg-maia-bg/40">
      <Td className="font-mono text-xs font-semibold text-maia-ink">{task.id}</Td>
      <Td className="max-w-[240px] truncate font-medium text-maia-ink">{task.title}</Td>
      <Td className="text-maia-ink-soft">{task.category}</Td>
      <Td>
        <Badge tone={TASK_PRIORITY_TONE[task.priority]}>{task.priority}</Badge>
      </Td>
      <Td>
        <Badge tone={TASK_STATUS_TONE[task.status]}>{task.status}</Badge>
      </Td>
      <Td className="text-maia-ink-soft">{task.assignedToName}</Td>
      <Td className="text-maia-ink-soft">{task.relatedStudentName ?? "—"}</Td>
      <Td className={overdue ? "font-semibold text-maia-danger" : "text-maia-ink-soft"}>{task.dueDate}</Td>
      <Td>
        <Button size="sm" variant="secondary" onClick={onView}>
          VIEW TASK
        </Button>
      </Td>
    </tr>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="whitespace-nowrap px-4 py-3">{children}</th>;
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={`whitespace-nowrap px-4 py-3 ${className ?? ""}`}>{children}</td>;
}
