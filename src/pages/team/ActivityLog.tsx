import { useMemo, useState } from "react";
import { History } from "lucide-react";
import { Card } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { SearchInput } from "@/components/common/SearchInput";
import { FilterSelect } from "@/components/common/FilterSelect";
import { useStudentStore } from "@/data/studentStore";
import { useStaffStore } from "@/data/staffStore";
import { useTaskStore } from "@/data/taskStore";
import { useInventoryStore } from "@/data/inventoryStore";
import { useTrainingStore } from "@/data/trainingStore";
import { useWebinarStore } from "@/data/webinarStore";
import { useCommunicationsStore } from "@/data/communicationsStore";
import { useAiToolsStore } from "@/data/aiToolsStore";

type LogCategory = "Student" | "Staff" | "Task" | "Inventory" | "Training" | "Free Webinar" | "Communications" | "AI Business Tools";

interface LogEntry {
  id: string;
  message: string;
  user: string;
  category: LogCategory;
  sortKey: number;
  timestampLabel: string;
}

const CATEGORY_TONE: Record<LogCategory, "gold" | "info" | "success" | "warning" | "neutral"> = {
  Student: "gold",
  Staff: "info",
  Task: "success",
  Inventory: "warning",
  Training: "neutral",
  "Free Webinar": "gold",
  Communications: "info",
  "AI Business Tools": "gold",
};

function tryParseDateTime(date: string, time: string): number {
  const parsed = Date.parse(`${date} ${time}`);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function ActivityLog() {
  const { students } = useStudentStore();
  const { staff } = useStaffStore();
  const { tasks } = useTaskStore();
  const { items, transactions: inventoryTransactions } = useInventoryStore();
  const { sessions, enrollments, certificates } = useTrainingStore();
  const { sessions: webinarSessions, leads: webinarLeads } = useWebinarStore();
  const { communicationLogs, syncLogs, automationRules } = useCommunicationsStore();
  const { activityLog: aiActivityLog } = useAiToolsStore();

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

    for (const t of inventoryTransactions) {
      const item = items.find((i) => i.id === t.itemId);
      const created = new Date(t.createdAt);
      list.push({
        id: t.id,
        message: `Inventory ${t.type}: ${item?.name ?? "Unknown item"} (${t.type === "Stock In" ? "+" : "-"}${t.quantity})`,
        user: t.recordedBy,
        category: "Inventory",
        sortKey: created.getTime(),
        timestampLabel: created.toLocaleString("en-PH"),
      });
    }

    for (const s of sessions) {
      const created = new Date(s.createdAt);
      list.push({
        id: `${s.id}-created`,
        message: `Training session created: ${s.title} (${s.sessionId})`,
        user: s.createdBy,
        category: "Training",
        sortKey: created.getTime(),
        timestampLabel: created.toLocaleString("en-PH"),
      });
      if (s.updatedAt !== s.createdAt) {
        const updated = new Date(s.updatedAt);
        list.push({
          id: `${s.id}-updated`,
          message: `Training session updated: ${s.title} (${s.sessionId})`,
          user: s.createdBy,
          category: "Training",
          sortKey: updated.getTime(),
          timestampLabel: updated.toLocaleString("en-PH"),
        });
      }
    }

    for (const e of enrollments) {
      if (!e.recordedAt || !e.recordedBy) continue;
      const session = sessions.find((s) => s.id === e.sessionId);
      const student = students.find((s) => s.id === e.studentId);
      const recorded = new Date(e.recordedAt);
      list.push({
        id: `${e.id}-attendance`,
        message: `Attendance recorded: ${e.attendanceStatus} — ${student?.fullName ?? "Unknown student"} (${session?.title ?? "Unknown session"})`,
        user: e.recordedBy,
        category: "Training",
        sortKey: recorded.getTime(),
        timestampLabel: recorded.toLocaleString("en-PH"),
      });
    }

    for (const c of certificates) {
      const student = students.find((s) => s.id === c.studentId);
      if (c.preparedAt && c.preparedBy) {
        const prepared = new Date(c.preparedAt);
        list.push({
          id: `${c.id}-prepared`,
          message: `Certificate prepared: ${c.certificateId} — ${student?.fullName ?? "Unknown student"}`,
          user: c.preparedBy,
          category: "Training",
          sortKey: prepared.getTime(),
          timestampLabel: prepared.toLocaleString("en-PH"),
        });
      }
      if (c.issuedAt && c.issuedBy) {
        const issued = new Date(c.issuedAt);
        list.push({
          id: `${c.id}-issued`,
          message: `Certificate ${c.status === "Reissued" ? "reissued" : "issued"}: ${c.certificateId} — ${student?.fullName ?? "Unknown student"}`,
          user: c.issuedBy,
          category: "Training",
          sortKey: issued.getTime(),
          timestampLabel: issued.toLocaleString("en-PH"),
        });
      }
    }

    for (const s of webinarSessions) {
      const created = new Date(s.createdAt);
      list.push({
        id: `${s.id}-webinar-created`,
        message: `Webinar session created: ${s.title} (${s.sessionId})`,
        user: s.createdBy,
        category: "Free Webinar",
        sortKey: created.getTime(),
        timestampLabel: created.toLocaleString("en-PH"),
      });
    }

    for (const l of webinarLeads) {
      for (const a of l.activity) {
        const sortKey = tryParseDateTime(a.date, a.time);
        list.push({
          id: a.id,
          message: `${a.action} — ${l.fullName} (${l.leadId})`,
          user: a.user,
          category: "Free Webinar",
          sortKey,
          timestampLabel: `${a.date} · ${a.time}`,
        });
      }
    }

    for (const c of communicationLogs) {
      const occurred = new Date(c.occurredAt);
      list.push({
        id: c.id,
        message: `${c.status}: ${c.channel} to ${c.personName}${c.subject ? ` — ${c.subject}` : ""}`,
        user: c.sentBy,
        category: "Communications",
        sortKey: occurred.getTime(),
        timestampLabel: occurred.toLocaleString("en-PH"),
      });
    }

    for (const s of syncLogs) {
      const occurred = new Date(s.occurredAt);
      list.push({
        id: s.id,
        message: `Sync ${s.status}: ${s.personName} (${s.event})`,
        user: "System (Automatic)",
        category: "Communications",
        sortKey: occurred.getTime(),
        timestampLabel: occurred.toLocaleString("en-PH"),
      });
    }

    for (const r of automationRules) {
      const created = new Date(r.createdAt);
      list.push({
        id: `${r.id}-created`,
        message: `Automation rule created: ${r.name} (${r.ruleId})`,
        user: r.createdBy,
        category: "Communications",
        sortKey: created.getTime(),
        timestampLabel: created.toLocaleString("en-PH"),
      });
    }

    for (const a of aiActivityLog) {
      const student = students.find((s) => s.id === a.studentId);
      const occurred = new Date(a.occurredAt);
      list.push({
        id: a.id,
        message: `${a.action} — ${student?.fullName ?? a.studentId}: ${a.summary}`,
        user: student?.fullName ?? a.studentId,
        category: "AI Business Tools",
        sortKey: occurred.getTime(),
        timestampLabel: occurred.toLocaleString("en-PH"),
      });
    }

    return list.sort((a, b) => b.sortKey - a.sortKey);
  }, [students, staff, tasks, items, inventoryTransactions, sessions, enrollments, certificates, webinarSessions, webinarLeads, communicationLogs, syncLogs, automationRules, aiActivityLog]);

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
          A combined feed of student, staff, task, inventory, training, free webinar, and AI Business Tools activity — most recent 200 entries.
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
            { value: "Inventory", label: "Inventory" },
            { value: "Training", label: "Training" },
            { value: "Free Webinar", label: "Free Webinar" },
            { value: "Communications", label: "Communications" },
            { value: "AI Business Tools", label: "AI Business Tools" },
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
