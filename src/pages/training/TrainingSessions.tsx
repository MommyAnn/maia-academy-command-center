import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarClock, Plus } from "lucide-react";
import { Card } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { SearchInput } from "@/components/common/SearchInput";
import { FilterSelect } from "@/components/common/FilterSelect";
import { SESSION_STATUS_TONE } from "@/components/training/statusMeta";
import { SessionFormModal } from "@/components/training/SessionFormModal";
import { useTrainingStore } from "@/data/trainingStore";
import { BATCH_OPTIONS } from "@/data/enrollmentConfig";
import { TRAINING_SESSION_STATUSES, TRAINING_TYPES } from "@/types/training";

export function TrainingSessions() {
  const { sessions, enrollments } = useTrainingStore();
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [batch, setBatch] = useState("all");
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);

  const sorted = useMemo(() => [...sessions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()), [sessions]);

  const filtered = sorted.filter((s) => {
    const searchable = `${s.title} ${s.sessionId}`.toLowerCase();
    if (search.trim() && !searchable.includes(search.trim().toLowerCase())) return false;
    if (batch !== "all" && s.batch !== batch) return false;
    if (type !== "all" && s.type !== type) return false;
    if (status !== "all" && s.status !== status) return false;
    return true;
  });

  return (
    <div className="flex flex-col gap-6 pb-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-maia-gold-deep">Training</p>
          <h1 className="mt-1 font-display text-2xl font-extrabold text-maia-ink sm:text-[28px]">Training Sessions</h1>
          <p className="mt-1 text-sm text-maia-ink-soft">{sessions.length} sessions scheduled across all batches.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus size={15} />
          NEW SESSION
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search by title or session ID..." />
        <FilterSelect value={batch} onChange={setBatch} options={[{ value: "all", label: "All Batches" }, ...BATCH_OPTIONS.map((b) => ({ value: b, label: b }))]} />
        <FilterSelect value={type} onChange={setType} options={[{ value: "all", label: "All Types" }, ...TRAINING_TYPES.map((t) => ({ value: t, label: t }))]} />
        <FilterSelect value={status} onChange={setStatus} options={[{ value: "all", label: "All Statuses" }, ...TRAINING_SESSION_STATUSES.map((s) => ({ value: s, label: s }))]} />
      </div>

      <Card padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-maia-border bg-maia-bg/60 text-left text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">
                <th className="px-4 py-3">Session ID</th>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Batch</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Roster</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => {
                const rosterCount = enrollments.filter((e) => e.sessionId === s.id).length;
                return (
                  <tr key={s.id} className="border-b border-maia-border/60 last:border-0 hover:bg-maia-bg/40">
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-semibold text-maia-ink">{s.sessionId}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-maia-ink">{s.title}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{s.type}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{s.batch}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">
                      {s.date} · {s.startTime}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{rosterCount}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Badge tone={SESSION_STATUS_TONE[s.status]}>{s.status}</Badge>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Button size="sm" variant="secondary" onClick={() => navigate(`/training/sessions/${s.id}`)}>
                        VIEW SESSION
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-maia-ink-soft">
                    <CalendarClock className="mx-auto mb-2 text-maia-ink-soft/50" size={22} />
                    No sessions match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <SessionFormModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
