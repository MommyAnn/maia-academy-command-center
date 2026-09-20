import { useMemo, useState } from "react";
import { History } from "lucide-react";
import { Card } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { SearchInput } from "@/components/common/SearchInput";
import { FilterSelect } from "@/components/common/FilterSelect";
import { useStudentStore } from "@/data/studentStore";
import { useStaffStore } from "@/data/staffStore";
import { useTaskStore } from "@/data/taskStore";

type LogCategory = "Student" | "Staff" | "Task";

interface LogEntry {
  id: string;
  message: string;
  user: string;
  category: LogCategory;
  sortKey: number;
  timestampLabel: string;
}

const CATEGORY_TONE: Record<LogCategory, "gold" | "info" | "success"> = {
  Student: "gold",
  Staff: "info",
  Task: "success",
};

function tryParseDateTime(date: string, time: string): number {
  const parsed = Date.parse(`${date} ${time}`);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function ActivityLog() {
  const { students } = useStudentStore();
  const { staff } = useStaffStore();
  const { tasks } = useTaskStore();

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<"all" | LogCategory>("all");

  const entries = useMemo<LogEntry[]>(() => {
    const list: LogEntry[] = [];

    for (const s of students) {
      for (const a of s.activity) {
        const sortKey = tryParseDateTime(a.date, a.time);
        list.push({
          id: a.id,
          message: `${a.action} — ${s.fullName} (${s.studentId})`,
          user: a.user,
          category: "Student",
          sortKey,
          timestampLabel: `${a.date} · ${a.time}`,
        });
      }
    }

    for (const s of staff) {
      for (const a of s.activity) {
        const sortKey = tryParseDateTime(a.date, a.time);
        list.push({
          id: a.id,
          message: `${a.action} — ${s.fullName}`,
          user: a.by,
          category: "Staff",
          sortKey,
          timestampLabel: `${a.date} · ${a.time}`,
        });
      }
    }

    for (const t of tasks) {
      const created = new Date(t.createdAt);
      list.push({
        id: `${t.id}-created`,
        message: `Task created: ${t.title} (${t.id})`,
        user: t.createdBy,
        category: "Task",
        sortKey: created.getTime(),
        timestampLabel: created.toLocaleString("en-PH"),
      });
      if (t.completedAt) {
        const completed = new Date(t.completedAt);
        list.push({
          id: `${t.id}-completed`,
          message: `Task completed: ${t.title} (${t.id})`,
          user: t.reviewedBy ?? "—",
          category: "Task",
          sortKey: completed.getTime(),
          timestampLabel: completed.toLocaleString("en-PH"),
        });
      }
      for (const c of t.comments) {
        const commented = new Date(c.timestamp);
        list.push({
          id: c.id,
          message: `Comment on ${t.title} (${t.id}): "${c.text}"`,
          user: c.author,
          category: "Task",
          sortKey: commented.getTime(),
          timestampLabel: commented.toLocaleString("en-PH"),
        });
      }
    }

    return list.sort((a, b) => b.sortKey - a.sortKey);
  }, [students, staff, tasks]);

  const filtered = useMemo(
    () =>
      entries
        .filter((e) => category === "all" || e.category === category)
        .filter((e) => !search.trim() || `${e.message} ${e.user}`.toLowerCase().includes(search.trim().toLowerCase()))
        .slice(0, 200),
    [entries, category, search],
  );

  return (
    <div className="flex flex-col gap-6 pb-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-maia-gold-deep">Team</p>
        <h1 className="mt-1 font-display text-2xl font-extrabold text-maia-ink sm:text-[28px]">Activity Log</h1>
        <p className="mt-1 text-sm text-maia-ink-soft">
          A combined feed of student, staff, and task activity — most recent 200 entries.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search activity..." />
        <FilterSelect
          value={category}
          onChange={(v) => setCategory(v as "all" | LogCategory)}
          options={[
            { value: "all", label: "All Modules" },
            { value: "Student", label: "Student" },
            { value: "Staff", label: "Staff" },
            { value: "Task", label: "Task" },
          ]}
        />
      </div>

      <Card padded={false}>
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-maia-ink-soft">
            <History className="mx-auto mb-2 text-maia-ink-soft/50" size={22} />
            No activity matches your filters.
          </div>
        ) : (
          <ul className="divide-y divide-maia-border/60">
            {filtered.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 sm:px-6">
                <div className="flex min-w-0 items-center gap-2.5">
                  <Badge tone={CATEGORY_TONE[e.category]}>{e.category}</Badge>
                  <span className="truncate text-sm text-maia-ink">{e.message}</span>
                </div>
                <span className="whitespace-nowrap text-xs text-maia-ink-soft">
                  {e.user} &middot; {e.timestampLabel}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
