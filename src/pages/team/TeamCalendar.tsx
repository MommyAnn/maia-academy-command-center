import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { TASK_PRIORITY_TONE } from "@/components/team/statusMeta";
import { SESSION_STATUS_TONE } from "@/components/training/statusMeta";
import { useTaskStore } from "@/data/taskStore";
import { useTrainingStore } from "@/data/trainingStore";
import { isTaskActive } from "@/utils/staffTasks";

type CalendarView = "month" | "week" | "day";
type EventTone = "danger" | "warning" | "info" | "neutral" | "gold" | "success";

interface CalendarEvent {
  id: string;
  title: string;
  kind: "Task" | "Session";
  badgeLabel: string;
  tone: EventTone;
  onSelect: () => void;
}

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
  const { sessions } = useTrainingStore();
  const navigate = useNavigate();
  const [view, setView] = useState<CalendarView>("month");
  const [cursor, setCursor] = useState(() => new Date());

  const activeTasks = useMemo(() => tasks.filter((t) => isTaskActive(t.status) || t.status === "Completed"), [tasks]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    function add(dateKey: string, event: CalendarEvent) {
      const list = map.get(dateKey) ?? [];
      list.push(event);
      map.set(dateKey, list);
    }

    for (const t of activeTasks) {
      add(t.dueDate, {
        id: `task-${t.id}`,
        title: t.title,
        kind: "Task",
        badgeLabel: t.priority,
        tone: TASK_PRIORITY_TONE[t.priority],
        onSelect: () => navigate(`/team/tasks/${encodeURIComponent(t.id)}`),
      });
    }

    for (const s of sessions.filter((s) => s.status !== "Cancelled")) {
      add(s.date, {
        id: `session-${s.id}`,
        title: `${s.title} (${s.type})`,
        kind: "Session",
        badgeLabel: s.status,
        tone: SESSION_STATUS_TONE[s.status],
        onSelect: () => navigate(`/training/sessions/${s.id}`),
      });
    }

    return map;
  }, [activeTasks, sessions, navigate]);

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
          <p className="mt-1 text-sm text-maia-ink-soft">Task due dates and training sessions (F2F, Zoom, Masterclass, Workshop) across the Academy.</p>
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

      {view === "month" && <MonthView cursor={cursor} eventsByDate={eventsByDate} />}
      {view === "week" && <WeekView cursor={cursor} eventsByDate={eventsByDate} />}
      {view === "day" && <DayView cursor={cursor} eventsByDate={eventsByDate} />}
    </div>
  );
}

function MonthView({ cursor, eventsByDate }: { cursor: Date; eventsByDate: Map<string, CalendarEvent[]> }) {
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
          const dayEvents = eventsByDate.get(key) ?? [];
          return (
            <div
              key={key}
              className={`min-h-[92px] border-b border-r border-maia-border/60 p-1.5 ${inMonth ? "bg-maia-surface" : "bg-maia-bg/30"}`}
            >
              <p className={`mb-1 text-xs font-semibold ${key === today ? "text-maia-gold-deep" : inMonth ? "text-maia-ink" : "text-maia-ink-soft/50"}`}>
                {d.getDate()}
              </p>
              <div className="flex flex-col gap-1">
                {dayEvents.slice(0, 3).map((e) => (
                  <button
                    key={e.id}
                    onClick={e.onSelect}
                    className={`truncate rounded px-1.5 py-0.5 text-left text-[10px] font-medium hover:opacity-80 ${
                      e.kind === "Session" ? "bg-maia-info-bg text-maia-info" : "bg-maia-gold-bg text-maia-gold-deep"
                    }`}
                    title={e.title}
                  >
                    {e.title}
                  </button>
                ))}
                {dayEvents.length > 3 && <p className="text-[10px] text-maia-ink-soft">+{dayEvents.length - 3} more</p>}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function WeekView({ cursor, eventsByDate }: { cursor: Date; eventsByDate: Map<string, CalendarEvent[]> }) {
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
        const dayEvents = eventsByDate.get(key) ?? [];
        return (
          <Card key={key} className="!p-3">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-maia-ink-soft">
              {d.toLocaleDateString("en-PH", { weekday: "short", day: "numeric" })}
            </p>
            <div className="flex flex-col gap-1.5">
              {dayEvents.map((e) => (
                <EventChip key={e.id} event={e} />
              ))}
              {dayEvents.length === 0 && <p className="text-xs text-maia-ink-soft/70">No events</p>}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function DayView({ cursor, eventsByDate }: { cursor: Date; eventsByDate: Map<string, CalendarEvent[]> }) {
  const dayEvents = eventsByDate.get(toDateKey(cursor)) ?? [];
  return (
    <Card>
      {dayEvents.length === 0 ? (
        <p className="py-6 text-center text-sm text-maia-ink-soft">No tasks or sessions this day.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {dayEvents.map((e) => (
            <EventChip key={e.id} event={e} expanded />
          ))}
        </div>
      )}
    </Card>
  );
}

function EventChip({ event, expanded }: { event: CalendarEvent; expanded?: boolean }) {
  return (
    <button
      onClick={event.onSelect}
      className={`flex items-center justify-between gap-2 rounded-lg bg-maia-bg px-3 py-2 text-left text-xs transition-colors hover:bg-maia-gold-bg ${expanded ? "text-sm" : ""}`}
    >
      <span className="truncate text-maia-ink">{event.title}</span>
      <div className="flex flex-shrink-0 items-center gap-1.5">
        <Badge tone="neutral">{event.kind}</Badge>
        <Badge tone={event.tone}>{event.badgeLabel}</Badge>
      </div>
    </button>
  );
}
