import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { Card, CardHeader } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { Tabs } from "@/components/common/Tabs";
import { SearchInput } from "@/components/common/SearchInput";
import { FilterSelect } from "@/components/common/FilterSelect";
import { ATTENDANCE_STATUS_TONE } from "@/components/training/statusMeta";
import { useTrainingStore } from "@/data/trainingStore";
import { useStudentStore } from "@/data/studentStore";
import { BATCH_OPTIONS } from "@/data/enrollmentConfig";
import { ATTENDANCE_STATUSES, isOnlineTrainingType, type AttendanceStatus } from "@/types/training";

export function Attendance() {
  const [tab, setTab] = useState("quick");

  return (
    <div className="flex flex-col gap-6 pb-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-maia-gold-deep">Training</p>
        <h1 className="mt-1 font-display text-2xl font-extrabold text-maia-ink sm:text-[28px]">Attendance</h1>
        <p className="mt-1 text-sm text-maia-ink-soft">Quick check-in on event day, plus attendance reports.</p>
      </div>

      <Tabs tabs={[{ value: "quick", label: "Quick Attendance" }, { value: "reports", label: "Reports" }]} active={tab} onChange={setTab} />

      {tab === "quick" ? <QuickAttendance /> : <AttendanceReports />}
    </div>
  );
}

function QuickAttendance() {
  const { sessions, getEnrollmentsForSession, recordAttendance } = useTrainingStore();
  const { students } = useStudentStore();

  const activeSessions = useMemo(
    () => sessions.filter((s) => s.status === "Scheduled" || s.status === "Ongoing"),
    [sessions],
  );

  const [sessionId, setSessionId] = useState(activeSessions[0]?.id ?? "");
  const [search, setSearch] = useState("");

  const session = sessions.find((s) => s.id === sessionId);
  const roster = session ? getEnrollmentsForSession(session.id) : [];
  const online = session ? isOnlineTrainingType(session.type) : false;

  const filteredRoster = roster.filter((entry) => {
    const student = students.find((s) => s.id === entry.studentId);
    if (!student) return false;
    const searchable = `${student.fullName} ${student.studentId} ${student.facebookName}`.toLowerCase();
    return !search.trim() || searchable.includes(search.trim().toLowerCase());
  });

  if (activeSessions.length === 0) {
    return (
      <Card>
        <p className="py-6 text-center text-sm text-maia-ink-soft">No scheduled or ongoing sessions right now.</p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <FilterSelect
          value={sessionId}
          onChange={setSessionId}
          options={activeSessions.map((s) => ({ value: s.id, label: `${s.title} — ${s.date}` }))}
        />
        <SearchInput value={search} onChange={setSearch} placeholder="Search name, Student ID, Facebook name..." />
      </div>

      {session && (
        <Card>
          <CardHeader
            title={`${session.batch.toUpperCase()} — ${session.type.toUpperCase()} ATTENDANCE`}
            subtitle={`${session.sessionId} · ${session.date} · ${filteredRoster.length} of ${roster.length} shown`}
          />
          <div className="flex flex-col gap-2.5">
            {filteredRoster.map((entry) => {
              const student = students.find((s) => s.id === entry.studentId);
              if (!student) return null;
              return (
                <div
                  key={entry.id}
                  className="flex flex-col gap-2.5 rounded-xl bg-maia-bg px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-maia-ink">{student.fullName}</p>
                    <p className="font-mono text-xs text-maia-ink-soft">{student.studentId}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={ATTENDANCE_STATUS_TONE[entry.attendanceStatus]}>{entry.attendanceStatus}</Badge>
                    {online ? (
                      <QuickButton
                        label="ATTENDED ONLINE"
                        active={entry.attendanceStatus === "Online Attended"}
                        onClick={() => recordAttendance(session.id, student.id, "Online Attended")}
                      />
                    ) : (
                      <>
                        <QuickButton label="PRESENT" tone="success" active={entry.attendanceStatus === "Present"} onClick={() => recordAttendance(session.id, student.id, "Present")} />
                        <QuickButton label="LATE" tone="warning" active={entry.attendanceStatus === "Late"} onClick={() => recordAttendance(session.id, student.id, "Late")} />
                        <QuickButton label="ABSENT" tone="danger" active={entry.attendanceStatus === "Absent"} onClick={() => recordAttendance(session.id, student.id, "Absent")} />
                      </>
                    )}
                  </div>
                </div>
              );
            })}
            {filteredRoster.length === 0 && <p className="py-6 text-center text-sm text-maia-ink-soft">No students match your search.</p>}
          </div>
        </Card>
      )}
    </div>
  );
}

function QuickButton({
  label,
  active,
  onClick,
  tone = "gold",
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  tone?: "success" | "warning" | "danger" | "gold";
}) {
  const toneClasses: Record<string, string> = {
    success: active ? "bg-maia-success text-white border-maia-success" : "border-maia-success/40 text-maia-success hover:bg-maia-success/10",
    warning: active ? "bg-maia-warning text-white border-maia-warning" : "border-maia-warning/40 text-maia-warning hover:bg-maia-warning/10",
    danger: active ? "bg-maia-danger text-white border-maia-danger" : "border-maia-danger/40 text-maia-danger hover:bg-maia-danger/10",
    gold: active ? "bg-maia-gold-deep text-white border-maia-gold-deep" : "border-maia-gold/40 text-maia-gold-deep hover:bg-maia-gold-bg",
  };
  return (
    <button
      onClick={onClick}
      className={`rounded-lg border px-3 py-2 text-xs font-bold uppercase tracking-wide transition-colors ${toneClasses[tone]}`}
    >
      {label}
    </button>
  );
}

function AttendanceReports() {
  const { sessions, enrollments } = useTrainingStore();
  const { students } = useStudentStore();

  const [batch, setBatch] = useState("all");
  const [sessionId, setSessionId] = useState("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "f2f" | "online">("all");

  const filteredSessions = sessions.filter((s) => {
    if (batch !== "all" && s.batch !== batch) return false;
    if (sessionId !== "all" && s.id !== sessionId) return false;
    if (typeFilter === "f2f" && isOnlineTrainingType(s.type)) return false;
    if (typeFilter === "online" && !isOnlineTrainingType(s.type)) return false;
    return true;
  });
  const sessionIds = new Set(filteredSessions.map((s) => s.id));
  const rows = enrollments.filter((e) => sessionIds.has(e.sessionId));

  const counts: Record<AttendanceStatus, number> = {
    Registered: 0,
    Present: 0,
    Late: 0,
    Absent: 0,
    Excused: 0,
    "Online Attended": 0,
  };
  for (const r of rows) counts[r.attendanceStatus] += 1;

  function exportCsv() {
    const header = ["Student ID", "Student Name", "Session", "Batch", "Status", "Check-In"];
    const lines = rows.map((r) => {
      const student = students.find((s) => s.id === r.studentId);
      const session = sessions.find((s) => s.id === r.sessionId);
      return [
        student?.studentId ?? "",
        student?.fullName ?? "",
        session?.title ?? "",
        session?.batch ?? "",
        r.attendanceStatus,
        r.checkInTime ?? "",
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",");
    });
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "attendance-report.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <FilterSelect value={batch} onChange={setBatch} options={[{ value: "all", label: "All Batches" }, ...BATCH_OPTIONS.map((b) => ({ value: b, label: b }))]} />
        <FilterSelect
          value={sessionId}
          onChange={setSessionId}
          options={[{ value: "all", label: "All Sessions" }, ...sessions.map((s) => ({ value: s.id, label: s.title }))]}
        />
        <FilterSelect
          value={typeFilter}
          onChange={(v) => setTypeFilter(v as "all" | "f2f" | "online")}
          options={[
            { value: "all", label: "F2F + Zoom" },
            { value: "f2f", label: "Face-to-Face only" },
            { value: "online", label: "Zoom / Online only" },
          ]}
        />
        <Button variant="secondary" onClick={exportCsv}>
          <Download size={15} />
          EXPORT CSV
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {ATTENDANCE_STATUSES.map((s) => (
          <Card key={s} className="!p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">{s}</p>
            <p className="mt-1 font-display text-xl font-extrabold text-maia-ink">{counts[s]}</p>
          </Card>
        ))}
      </div>

      <Card padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-maia-border bg-maia-bg/60 text-left text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Session</th>
                <th className="px-4 py-3">Batch</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Check-In</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const student = students.find((s) => s.id === r.studentId);
                const session = sessions.find((s) => s.id === r.sessionId);
                return (
                  <tr key={r.id} className="border-b border-maia-border/60 last:border-0 hover:bg-maia-bg/40">
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-maia-ink">{student?.fullName ?? "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{session?.title ?? "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{session?.batch ?? "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Badge tone={ATTENDANCE_STATUS_TONE[r.attendanceStatus]}>{r.attendanceStatus}</Badge>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">
                      {r.checkInTime ? new Date(r.checkInTime).toLocaleString("en-PH") : "—"}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-maia-ink-soft">
                    No attendance records match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
