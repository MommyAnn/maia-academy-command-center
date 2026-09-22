import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { RefreshCw, ShieldAlert } from "lucide-react";
import { Card } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { FilterSelect } from "@/components/common/FilterSelect";
import { SearchInput } from "@/components/common/SearchInput";
import { useWebinarStore } from "@/data/webinarStore";
import { useStudentStore } from "@/data/studentStore";
import { useCommunicationsStore } from "@/data/communicationsStore";
import { syncStatusTone } from "@/utils/communications";
import { GHL_SYNC_STATUSES } from "@/types/communications";
import type { PersonType } from "@/types/communications";

export function ContactSync() {
  const { leads } = useWebinarStore();
  const { students } = useStudentStore();
  const { contactSyncs, syncContact, resyncContact, markPossibleDuplicate } = useCommunicationsStore();
  const navigate = useNavigate();

  const [personTypeFilter, setPersonTypeFilter] = useState<"all" | PersonType>("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  const people = [
    ...leads.map((l) => ({ personType: "Lead" as const, personId: l.id, displayId: l.leadId, fullName: l.fullName, email: l.email, contactNumber: l.contactNumber })),
    ...students.map((s) => ({ personType: "Student" as const, personId: s.id, displayId: s.studentId, fullName: s.fullName, email: s.email, contactNumber: s.contactNumber })),
  ];

  const rows = people
    .map((p) => ({ person: p, sync: contactSyncs.find((c) => c.personType === p.personType && c.personId === p.personId) }))
    .filter((r) => personTypeFilter === "all" || r.person.personType === personTypeFilter)
    .filter((r) => statusFilter === "all" || (r.sync?.lastSyncStatus ?? "Not Synced") === statusFilter)
    .filter((r) => {
      if (!search.trim()) return true;
      const q = search.trim().toLowerCase();
      return `${r.person.fullName} ${r.person.displayId} ${r.person.email}`.toLowerCase().includes(q);
    })
    .sort((a, b) => (b.sync?.lastAttemptDate ?? "").localeCompare(a.sync?.lastAttemptDate ?? ""));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-lg font-bold text-maia-ink">Contact Sync</h2>
        <p className="text-sm text-maia-ink-soft">
          Every synchronized Lead/Student keeps a GHL Contact ID + Location ID, matched by ID — never by name alone (spec section 7).
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <SearchInput value={search} onChange={setSearch} placeholder="Name, ID, or email..." />
        <FilterSelect
          value={personTypeFilter}
          onChange={(v) => setPersonTypeFilter(v as "all" | PersonType)}
          options={[{ value: "all", label: "Leads + Students" }, { value: "Lead", label: "Leads Only" }, { value: "Student", label: "Students Only" }]}
        />
        <FilterSelect value={statusFilter} onChange={setStatusFilter} options={[{ value: "all", label: "Any Sync Status" }, ...GHL_SYNC_STATUSES.map((s) => ({ value: s, label: s }))]} />
      </div>

      <Card padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-maia-border bg-maia-bg/60 text-left text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">
                <th className="px-4 py-3">Person</th>
                <th className="px-4 py-3">GHL Contact ID</th>
                <th className="px-4 py-3">Last Sync</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Error</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ person, sync }) => (
                <tr key={`${person.personType}-${person.personId}`} className="border-b border-maia-border/60 last:border-0 hover:bg-maia-bg/40">
                  <td className="whitespace-nowrap px-4 py-3">
                    <button className="font-medium text-maia-ink hover:underline" onClick={() => navigate(person.personType === "Lead" ? `/webinar/leads/${person.personId}` : `/students/${person.personId}`)}>
                      {person.fullName}
                    </button>
                    <p className="font-mono text-xs text-maia-ink-soft">{person.displayId} · {person.personType}</p>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-maia-ink-soft">
                    {sync?.ghlContactId ?? "—"}
                    {sync?.possibleDuplicate && (
                      <Badge tone="warning">
                        <ShieldAlert size={11} />
                        Possible Duplicate
                      </Badge>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{sync?.lastSyncDate ? new Date(sync.lastSyncDate).toLocaleString("en-PH") : "Never"}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <Badge tone={syncStatusTone(sync?.lastSyncStatus ?? "Not Synced")}>{sync?.lastSyncStatus ?? "Not Synced"}</Badge>
                  </td>
                  <td className="max-w-[220px] truncate px-4 py-3 text-xs text-maia-danger">{sync?.syncError ?? "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      <Button size="sm" variant="secondary" onClick={() => (sync ? resyncContact(person.personType, person.personId) : syncContact(person.personType, person.personId))}>
                        <RefreshCw size={12} />
                        {sync ? "RESYNC" : "SYNC"}
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => markPossibleDuplicate(person.personType, person.personId, !sync?.possibleDuplicate)}>
                        {sync?.possibleDuplicate ? "UNFLAG" : "FLAG DUPLICATE"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-maia-ink-soft">
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
