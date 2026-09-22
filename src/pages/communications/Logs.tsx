import { useState } from "react";
import { Card } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { FilterSelect } from "@/components/common/FilterSelect";
import { SearchInput } from "@/components/common/SearchInput";
import { useCommunicationsStore } from "@/data/communicationsStore";
import { communicationStatusTone } from "@/utils/communications";
import { COMMUNICATION_CHANNELS, COMMUNICATION_LOG_STATUSES } from "@/types/communications";
import type { PersonType } from "@/types/communications";

/**
 * Communication Log (spec section 46) — every row here is either a real
 * simulated send (this demo never claims a Delivered/Read status a real
 * provider hasn't reported) or an honest Skipped/Failed outcome.
 */
export function Logs() {
  const { communicationLogs, templates, automationRules } = useCommunicationsStore();

  const [personTypeFilter, setPersonTypeFilter] = useState<"all" | PersonType>("all");
  const [channelFilter, setChannelFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  const rows = communicationLogs
    .filter((c) => personTypeFilter === "all" || c.personType === personTypeFilter)
    .filter((c) => channelFilter === "all" || c.channel === channelFilter)
    .filter((c) => statusFilter === "all" || c.status === statusFilter)
    .filter((c) => !search.trim() || `${c.personName} ${c.communicationId} ${c.message}`.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-lg font-bold text-maia-ink">Communication Log</h2>
        <p className="text-sm text-maia-ink-soft">{rows.length} communication(s) — automatic and manual, all channels.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <SearchInput value={search} onChange={setSearch} placeholder="Person, ID, or message..." />
        <FilterSelect
          value={personTypeFilter}
          onChange={(v) => setPersonTypeFilter(v as "all" | PersonType)}
          options={[{ value: "all", label: "Leads + Students" }, { value: "Lead", label: "Leads Only" }, { value: "Student", label: "Students Only" }]}
        />
        <FilterSelect value={channelFilter} onChange={setChannelFilter} options={[{ value: "all", label: "Any Channel" }, ...COMMUNICATION_CHANNELS.map((c) => ({ value: c, label: c }))]} />
        <FilterSelect value={statusFilter} onChange={setStatusFilter} options={[{ value: "all", label: "Any Status" }, ...COMMUNICATION_LOG_STATUSES.map((s) => ({ value: s, label: s }))]} />
      </div>

      <Card padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1300px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-maia-border bg-maia-bg/60 text-left text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">
                <th className="px-4 py-3">Communication ID</th>
                <th className="px-4 py-3">Person</th>
                <th className="px-4 py-3">Channel</th>
                <th className="px-4 py-3">Template</th>
                <th className="px-4 py-3">Automation</th>
                <th className="px-4 py-3">Date/Time</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Provider</th>
                <th className="px-4 py-3">Failure Reason</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const template = c.templateId ? templates.find((t) => t.id === c.templateId) : undefined;
                const automation = c.automationId ? automationRules.find((r) => r.id === c.automationId) : undefined;
                return (
                  <tr key={c.id} className="border-b border-maia-border/60 last:border-0 hover:bg-maia-bg/40">
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-maia-ink-soft">{c.communicationId}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-maia-ink">
                      {c.personName} <Badge tone={c.personType === "Lead" ? "gold" : "success"}>{c.personType}</Badge>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{c.channel}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{template?.name ?? "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{automation?.name ?? "Manual"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{new Date(c.occurredAt).toLocaleString("en-PH")}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Badge tone={communicationStatusTone(c.status)}>{c.status}</Badge>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{c.provider}</td>
                    <td className="max-w-[240px] truncate px-4 py-3 text-xs text-maia-danger">{c.failureReason ?? "—"}</td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-sm text-maia-ink-soft">
                    No communications match this filter.
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
