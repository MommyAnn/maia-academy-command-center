import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Card } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { SearchInput } from "@/components/common/SearchInput";
import { FilterSelect } from "@/components/common/FilterSelect";
import { useWebinarStore } from "@/data/webinarStore";
import { useStudentStore } from "@/data/studentStore";
import { useCommunicationsStore } from "@/data/communicationsStore";
import { pipelineStageTone } from "@/utils/webinar";
import { syncStatusTone } from "@/utils/communications";
import { COMMUNICATION_CHANNELS } from "@/types/communications";
import { BATCH_OPTIONS } from "@/data/enrollmentConfig";
import type { PersonType } from "@/types/communications";
import type { LeadStatus } from "@/types/webinar";

interface CenterRow {
  personType: PersonType;
  personId: string;
  displayId: string;
  fullName: string;
  email: string;
  contactNumber: string;
  currentStatus: string;
  latestChannel: string | null;
  latestAt: string | null;
  nextFollowUp: string | null;
}

/**
 * Cross-Lead/Student communication overview (spec section 2). Reads only —
 * every number here is derived live from webinarStore/studentStore/
 * communicationsStore, never a separately-stored duplicate.
 */
export function Center() {
  const { leads, sessions } = useWebinarStore();
  const { students } = useStudentStore();
  const { communicationLogs, getSyncForPerson } = useCommunicationsStore();
  const navigate = useNavigate();

  const [personTypeFilter, setPersonTypeFilter] = useState<"all" | PersonType>("all");
  const [batchFilter, setBatchFilter] = useState("all");
  const [sessionFilter, setSessionFilter] = useState("all");
  const [channelFilter, setChannelFilter] = useState("all");
  const [syncFilter, setSyncFilter] = useState("all");
  const [search, setSearch] = useState("");

  function latestCommunication(personType: PersonType, personId: string) {
    return communicationLogs
      .filter((c) => c.personType === personType && c.personId === personId)
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))[0];
  }

  const leadRows: CenterRow[] = leads.map((l) => {
    const latest = latestCommunication("Lead", l.id);
    return {
      personType: "Lead",
      personId: l.id,
      displayId: l.leadId,
      fullName: l.fullName,
      email: l.email,
      contactNumber: l.contactNumber,
      currentStatus: l.status,
      latestChannel: latest?.channel ?? null,
      latestAt: latest?.occurredAt ?? null,
      nextFollowUp: l.nextFollowUpDate,
    };
  });

  const studentRows: CenterRow[] = students.map((s) => {
    const latest = latestCommunication("Student", s.id);
    return {
      personType: "Student",
      personId: s.id,
      displayId: s.studentId,
      fullName: s.fullName,
      email: s.email,
      contactNumber: s.contactNumber,
      currentStatus: s.enrollmentStatus,
      latestChannel: latest?.channel ?? null,
      latestAt: latest?.occurredAt ?? null,
      nextFollowUp: null,
    };
  });

  const rows = [...leadRows, ...studentRows]
    .filter((r) => personTypeFilter === "all" || r.personType === personTypeFilter)
    .filter((r) => {
      if (batchFilter === "all") return true;
      if (r.personType !== "Student") return false;
      const student = students.find((s) => s.id === r.personId);
      return student?.batch === batchFilter;
    })
    .filter((r) => {
      if (sessionFilter === "all") return true;
      if (r.personType !== "Lead") return false;
      const lead = leads.find((l) => l.id === r.personId);
      return lead?.latestWebinarSessionId === sessionFilter;
    })
    .filter((r) => channelFilter === "all" || r.latestChannel === channelFilter)
    .filter((r) => syncFilter === "all" || (getSyncForPerson(r.personType, r.personId)?.lastSyncStatus ?? "Not Synced") === syncFilter)
    .filter((r) => {
      if (!search.trim()) return true;
      const q = search.trim().toLowerCase();
      return `${r.fullName} ${r.displayId} ${r.email} ${r.contactNumber}`.toLowerCase().includes(q);
    })
    .sort((a, b) => (b.latestAt ?? "").localeCompare(a.latestAt ?? ""));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-lg font-bold text-maia-ink">Communication Center</h2>
        <p className="text-sm text-maia-ink-soft">{rows.length} contact(s) shown — Leads and Students in one view.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <SearchInput value={search} onChange={setSearch} placeholder="Name, ID, email, or contact number..." />
        <FilterSelect
          value={personTypeFilter}
          onChange={(v) => setPersonTypeFilter(v as "all" | PersonType)}
          options={[
            { value: "all", label: "Leads + Students" },
            { value: "Lead", label: "Leads Only" },
            { value: "Student", label: "Students Only" },
          ]}
        />
        <FilterSelect value={batchFilter} onChange={setBatchFilter} options={[{ value: "all", label: "All Batches" }, ...BATCH_OPTIONS.map((b) => ({ value: b, label: b }))]} />
        <FilterSelect value={sessionFilter} onChange={setSessionFilter} options={[{ value: "all", label: "All Webinars" }, ...sessions.map((s) => ({ value: s.id, label: s.title }))]} />
        <FilterSelect value={channelFilter} onChange={setChannelFilter} options={[{ value: "all", label: "Any Channel" }, ...COMMUNICATION_CHANNELS.map((c) => ({ value: c, label: c }))]} />
        <FilterSelect
          value={syncFilter}
          onChange={setSyncFilter}
          options={[
            { value: "all", label: "Any Sync Status" },
            { value: "Synced", label: "Synced" },
            { value: "Not Synced", label: "Not Synced" },
            { value: "Error", label: "Error" },
            { value: "Needs Update", label: "Needs Update" },
          ]}
        />
      </div>

      <Card padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-maia-border bg-maia-bg/60 text-left text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">
                <th className="px-4 py-3">Person</th>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Current Status</th>
                <th className="px-4 py-3">Latest Communication</th>
                <th className="px-4 py-3">Channel</th>
                <th className="px-4 py-3">Next Follow-up</th>
                <th className="px-4 py-3">GHL Sync</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const sync = getSyncForPerson(r.personType, r.personId);
                return (
                  <tr key={`${r.personType}-${r.personId}`} className="border-b border-maia-border/60 last:border-0 hover:bg-maia-bg/40">
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-maia-ink">
                      <button
                        className="hover:underline"
                        onClick={() => navigate(r.personType === "Lead" ? `/webinar/leads/${r.personId}` : `/students/${r.personId}`)}
                      >
                        {r.fullName}
                      </button>
                      <Badge tone={r.personType === "Lead" ? "gold" : "success"}>{r.personType}</Badge>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-maia-ink-soft">{r.displayId}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{r.email}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{r.contactNumber}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Badge tone={r.personType === "Lead" ? pipelineStageTone(r.currentStatus as LeadStatus) : "neutral"}>{r.currentStatus}</Badge>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{r.latestAt ? new Date(r.latestAt).toLocaleString("en-PH") : "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{r.latestChannel ?? "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{r.nextFollowUp ?? "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Badge tone={syncStatusTone(sync?.lastSyncStatus ?? "Not Synced")}>{sync?.lastSyncStatus ?? "Not Synced"}</Badge>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-sm text-maia-ink-soft">
                    No contacts match this filter.
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
