import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { TASK_PRIORITY_TONE } from "@/components/team/statusMeta";
import { useTaskStore } from "@/data/taskStore";
import { isTaskActive } from "@/utils/staffTasks";
import type { TaskRecord } from "@/types/task";

type CalendarView = "month" | "week" | "day";

function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfWeek(d: Date): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() - copy.getDay());
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function TeamCalendar() {
  const { tasks } = useTaskStore();
  const navigate = useNavigate();
  const [view, setView] = useState<CalendarView>("month");
  const [cursor, setCursor] = useState(() => new Date());

  const activeTasks = useMemo(() => tasks.filter((t) => isTaskActive(t.status) || t.status === "Completed"), [tasks]);

  const tasksByDate = useMemo(() => {
    const map = new Map<string, TaskRecord[]>();
    for (const t of activeTasks) {
      const list = map.get(t.dueDate) ?? [];
      list.push(t);
      map.set(t.dueDate, list);
    }
    return map;
  }, [activeTasks]);

  function shift(amount: number) {
    setCursor((prev) => {
      const next = new Date(prev);
      if (view === "month") next.setMonth(next.getMonth() + amount);
      else if (view === "week") next.setDate(next.getDate() + amount * 7);
      else next.setDate(next.getDate() + amount);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-6 pb-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-maia-gold-deep">Team</p>
          <h1 className="mt-1 font-display text-2xl font-extrabold text-maia-ink sm:text-[28px]">Calendar</h1>
          <p className="mt-1 text-sm text-maia-ink-soft">Task due dates across every staff member.</p>
        </div>
        <div className="flex gap-1.5 rounded-lg border border-maia-border bg-maia-surface p-1">
          {(["month", "week", "day"] as CalendarView[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors ${
                view === v ? "bg-maia-black text-maia-gold" : "text-maia-ink-soft hover:bg-maia-bg"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Button variant="secondary" size="sm" onClick={() => shift(-1)}>
          <ChevronLeft size={15} />
        </Button>
        <p className="font-display text-sm font-bold text-maia-ink">
          {view === "month" && cursor.toLocaleDateString("en-PH", { month: "long", year: "numeric" })}
          {view === "week" &&
            `Week of ${startOfWeek(cursor).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}`}
          {view === "day" && cursor.toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
        </p>
        <Button variant="secondary" size="sm" onClick={() => shift(1)}>
          <ChevronRight size={15} />
        </Button>
      </div>

      {view === "month" && <MonthView cursor={cursor} tasksByDate={tasksByDate} onSelectTask={(id) => navigate(`/team/tasks/${encodeURIComponent(id)}`)} />}
      {view === "week" && <WeekView cursor={cursor} tasksByDate={tasksByDate} onSelectTask={(id) => navigate(`/team/tasks/${encodeURIComponent(id)}`)} />}
      {view === "day" && <DayView cursor={cursor} tasksByDate={tasksByDate} onSelectTask={(id) => navigate(`/team/tasks/${encodeURIComponent(id)}`)} />}
    </div>
  );
}

function MonthView({
  cursor,
  tasksByDate,
  onSelectTask,
}: {
  cursor: Date;
  tasksByDate: Map<string, TaskRecord[]>;
  onSelectTask: (id: string) => void;
}) {
  const firstOfMonth = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const gridStart = startOfWeek(firstOfMonth);
  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(d.getDate() + i);
    return d;
  });
  const today = toDateKey(new Date());

  return (
    <Card padded={false}>
      <div className="grid grid-cols-7 border-b border-maia-border bg-maia-bg/60 text-center text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="px-2 py-2.5">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((d) => {
          const key = toDateKey(d);
          const inMonth = d.getMonth() === cursor.getMonth();
          const dayTasks = tasksByDate.get(key) ?? [];
          return (
            <div
              key={key}
              className={`min-h-[92px] border-b border-r border-maia-border/60 p-1.5 ${inMonth ? "bg-maia-surface" : "bg-maia-bg/30"}`}
            >
              <p className={`mb-1 text-xs font-semibold ${key === today ? "text-maia-gold-deep" : inMonth ? "text-maia-ink" : "text-maia-ink-soft/50"}`}>
                {d.getDate()}
              </p>
              <div className="flex flex-col gap-1">
                {dayTasks.slice(0, 3).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => onSelectTask(t.id)}
                    className="truncate rounded bg-maia-gold-bg px-1.5 py-0.5 text-left text-[10px] font-medium text-maia-gold-deep hover:bg-maia-gold/25"
                    title={t.title}
                  >
                    {t.title}
                  </button>
                ))}
                {dayTasks.length > 3 && <p className="text-[10px] text-maia-ink-soft">+{dayTasks.length - 3} more</p>}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function WeekView({
  cursor,
  tasksByDate,
  onSelectTask,
}: {
  cursor: Date;
  tasksByDate: Map<string, TaskRecord[]>;
  onSelectTask: (id: string) => void;
}) {
  const start = startOfWeek(cursor);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d;
  });

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-7">
      {days.map((d) => {
        const key = toDateKey(d);
        const dayTasks = tasksByDate.get(key) ?? [];
        return (
          <Card key={key} className="!p-3">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-maia-ink-soft">
              {d.toLocaleDateString("en-PH", { weekday: "short", day: "numeric" })}
            </p>
            <div className="flex flex-col gap-1.5">
              {dayTasks.map((t) => (
                <TaskChip key={t.id} task={t} onClick={() => onSelectTask(t.id)} />
              ))}
              {dayTasks.length === 0 && <p className="text-xs text-maia-ink-soft/70">No tasks</p>}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function DayView({
  cursor,
  tasksByDate,
  onSelectTask,
}: {
  cursor: Date;
  tasksByDate: Map<string, TaskRecord[]>;
  onSelectTask: (id: string) => void;
}) {
  const dayTasks = tasksByDate.get(toDateKey(cursor)) ?? [];
  return (
    <Card>
      {dayTasks.length === 0 ? (
        <p className="py-6 text-center text-sm text-maia-ink-soft">No tasks due this day.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {dayTasks.map((t) => (
            <TaskChip key={t.id} task={t} onClick={() => onSelectTask(t.id)} expanded />
          ))}
        </div>
      )}
    </Card>
  );
}

function TaskChip({ task, onClick, expanded }: { task: TaskRecord; onClick: () => void; expanded?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-between gap-2 rounded-lg bg-maia-bg px-3 py-2 text-left text-xs transition-colors hover:bg-maia-gold-bg ${expanded ? "text-sm" : ""}`}
    >
      <span className="truncate text-maia-ink">{task.title}</span>
      <Badge tone={TASK_PRIORITY_TONE[task.priority]}>{task.priority}</Badge>
    </button>
  );
}
