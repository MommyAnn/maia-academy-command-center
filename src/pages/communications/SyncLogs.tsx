import { useState } from "react";
import { Card } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { FilterSelect } from "@/components/common/FilterSelect";
import { SearchInput } from "@/components/common/SearchInput";
import { useCommunicationsStore } from "@/data/communicationsStore";
import { syncLogStatusTone } from "@/utils/communications";
import { SYNC_LOG_STATUSES } from "@/types/communications";
import type { PersonType } from "@/types/communications";

/**
 * Sync Log (spec section 56) — one row per M.A.I.A. ↔ GHL sync attempt.
 * RETRY re-attempts the sync (never loses the event); RESOLVE clears a
 * Conflict/Needs Review record back to Not Synced so it can be retried
 * fresh — it never fabricates a successful sync.
 */
export function SyncLogs() {
  const { syncLogs, retrySync, resolveSyncConflict, integrationSettings } = useCommunicationsStore();

  const [personTypeFilter, setPersonTypeFilter] = useState<"all" | PersonType>("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  const rows = syncLogs
    .filter((s) => personTypeFilter === "all" || s.personType === personTypeFilter)
    .filter((s) => statusFilter === "all" || s.status === statusFilter)
    .filter((s) => !search.trim() || `${s.personName} ${s.syncId} ${s.event}`.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-lg font-bold text-maia-ink">Sync Logs</h2>
        <p className="text-sm text-maia-ink-soft">
          {rows.length} sync attempt(s). Retry limit: {integrationSettings.retryLimit} — after that a failing sync becomes Needs Review, never an endless silent retry loop.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <SearchInput value={search} onChange={setSearch} placeholder="Person, Sync ID, or event..." />
        <FilterSelect
          value={personTypeFilter}
          onChange={(v) => setPersonTypeFilter(v as "all" | PersonType)}
          options={[{ value: "all", label: "Leads + Students" }, { value: "Lead", label: "Leads Only" }, { value: "Student", label: "Students Only" }]}
        />
        <FilterSelect value={statusFilter} onChange={setStatusFilter} options={[{ value: "all", label: "Any Status" }, ...SYNC_LOG_STATUSES.map((s) => ({ value: s, label: s }))]} />
      </div>

      <Card padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-maia-border bg-maia-bg/60 text-left text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">
                <th className="px-4 py-3">Sync ID</th>
                <th className="px-4 py-3">Person</th>
                <th className="px-4 py-3">Direction</th>
                <th className="px-4 py-3">Event</th>
                <th className="px-4 py-3">Date/Time</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Retries</th>
                <th className="px-4 py-3">Error</th>
                <th className="px-4 py-3">External ID</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className="border-b border-maia-border/60 last:border-0 hover:bg-maia-bg/40">
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-maia-ink-soft">{s.syncId}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-maia-ink">
                    {s.personName} <Badge tone={s.personType === "Lead" ? "gold" : "success"}>{s.personType}</Badge>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{s.direction}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-maia-ink-soft">{s.event}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{new Date(s.occurredAt).toLocaleString("en-PH")}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <Badge tone={syncLogStatusTone(s.status)}>{s.status}</Badge>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{s.retryCount}</td>
                  <td className="max-w-[200px] truncate px-4 py-3 text-xs text-maia-danger">{s.error ?? "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-maia-ink-soft">{s.externalId ?? "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {(s.status === "Failed" || s.status === "Retry Pending") && (
                        <Button size="sm" variant="secondary" onClick={() => retrySync(s.id)}>
                          RETRY
                        </Button>
                      )}
                      {(s.status === "Needs Review" || s.status === "Failed") && (
                        <Button size="sm" variant="secondary" onClick={() => resolveSyncConflict(s.id)}>
                          RESOLVE
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-sm text-maia-ink-soft">
                    No sync attempts match this filter.
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
