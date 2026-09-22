import { useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { UploadCloud } from "lucide-react";
import { Card } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { Modal } from "@/components/common/Modal";
import { SearchInput } from "@/components/common/SearchInput";
import { FilterSelect } from "@/components/common/FilterSelect";
import { useWebinarStore } from "@/data/webinarStore";
import { useStudentStore } from "@/data/studentStore";
import { LEAD_SOURCES, LEAD_STATUSES, REGISTRATION_ATTENDANCE_STATUSES, blankUtmAttribution } from "@/types/webinar";
import type { LeadSource, LeadStatus, RegistrationAttendanceStatus } from "@/types/webinar";
import { findDuplicateMatch, parseCsv, pipelineStageTone } from "@/utils/webinar";

interface ImportPreviewRow {
  fullName: string;
  facebookName: string;
  email: string;
  contactNumber: string;
  city: string;
  sessionTitle: string;
  sessionId: string | null;
  attendance: RegistrationAttendanceStatus | null;
  leadStatus: LeadStatus | null;
  source: LeadSource;
  notes: string;
  duplicate: "existing lead" | "existing student" | "new";
  matchedName: string | null;
}

export function Registrations() {
  const { sessions, leads, registrations, registerForWebinar, recordAttendance, setLeadStatus, addLeadNote } = useWebinarStore();
  const { students } = useStudentStore();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [importRows, setImportRows] = useState<ImportPreviewRow[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sessionFilter = searchParams.get("session") ?? "all";
  const attendanceFilter = searchParams.get("attendance") ?? "all";
  const statusFilter = searchParams.get("status") ?? "all";
  const sourceFilter = searchParams.get("source") ?? "all";

  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value === "all") next.delete(key);
    else next.set(key, value);
    setSearchParams(next);
  }

  const rows = registrations
    .map((r) => ({ registration: r, lead: leads.find((l) => l.id === r.leadId), session: sessions.find((s) => s.id === r.webinarSessionId) }))
    .filter((row) => row.lead && row.session)
    .filter((row) => sessionFilter === "all" || row.session!.id === sessionFilter)
    .filter((row) => attendanceFilter === "all" || row.registration.attendanceStatus === attendanceFilter)
    .filter((row) => statusFilter === "all" || row.lead!.status === statusFilter)
    .filter((row) => sourceFilter === "all" || row.registration.leadSource === sourceFilter)
    .filter((row) => {
      if (!search.trim()) return true;
      const q = search.trim().toLowerCase();
      return (
        row.lead!.fullName.toLowerCase().includes(q) ||
        row.lead!.facebookName.toLowerCase().includes(q) ||
        row.lead!.email.toLowerCase().includes(q) ||
        row.lead!.contactNumber.toLowerCase().includes(q) ||
        row.lead!.leadId.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => b.registration.registrationDate.localeCompare(a.registration.registrationDate));

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const parsed = parseCsv(text);
      if (parsed.length < 2) return;
      const header = parsed[0].map((h) => h.trim().toLowerCase());
      const idx = (name: string) => header.indexOf(name);
      const nameIdx = idx("name");
      const fbIdx = idx("fb name");
      const emailIdx = idx("email");
      const contactIdx = idx("contact");
      const cityIdx = idx("city");
      const sessionIdx = idx("session");
      const attendanceIdx = idx("attendance");
      const leadStatusIdx = idx("lead status");
      const sourceIdx = idx("source");
      const notesIdx = idx("notes");

      const preview: ImportPreviewRow[] = parsed.slice(1).map((r) => {
        const fullName = (r[nameIdx] ?? "").trim();
        const facebookName = (r[fbIdx] ?? "").trim();
        const email = (r[emailIdx] ?? "").trim();
        const contactNumber = (r[contactIdx] ?? "").trim();
        const city = (r[cityIdx] ?? "").trim();
        const sessionTitle = (r[sessionIdx] ?? "").trim();
        const session = sessions.find((s) => s.title.toLowerCase() === sessionTitle.toLowerCase());
        const attendanceRaw = (r[attendanceIdx] ?? "").trim();
        const attendance = REGISTRATION_ATTENDANCE_STATUSES.find((a) => a.toLowerCase() === attendanceRaw.toLowerCase()) ?? null;
        const leadStatusRaw = (r[leadStatusIdx] ?? "").trim();
        const leadStatus = LEAD_STATUSES.find((s) => s.toLowerCase() === leadStatusRaw.toLowerCase()) ?? null;
        const sourceRaw = (r[sourceIdx] ?? "").trim();
        const source = LEAD_SOURCES.find((s) => s.toLowerCase() === sourceRaw.toLowerCase()) ?? "Other";
        const notes = (r[notesIdx] ?? "").trim();
        const match = findDuplicateMatch({ email, contactNumber }, leads, students);
        const duplicate: ImportPreviewRow["duplicate"] = match.matchedStudent ? "existing student" : match.matchedLead ? "existing lead" : "new";
        const matchedName = match.matchedStudent?.fullName ?? match.matchedLead?.fullName ?? null;

        return { fullName, facebookName, email, contactNumber, city, sessionTitle, sessionId: session?.id ?? null, attendance, leadStatus, source, notes, duplicate, matchedName };
      });
      setImportRows(preview);
    };
    reader.readAsText(file);
  }

  function confirmImport() {
    for (const row of importRows) {
      if (!row.fullName || !row.sessionId) continue;
      const result = registerForWebinar({
        fullName: row.fullName,
        facebookName: row.facebookName,
        email: row.email,
        contactNumber: row.contactNumber,
        city: row.city,
        businessStatus: "Other",
        businessName: "",
        businessChallenge: "",
        sellingCurrently: null,
        importationExperience: null,
        timeline: "",
        webinarSessionId: row.sessionId,
        leadSource: row.source,
        campaign: "",
        utm: blankUtmAttribution(),
        registrationCommsConsent: false,
        marketingConsent: false,
      });
      if (row.attendance) recordAttendance(result.registration.id, row.attendance, "CSV Import", "Imported from registration list.");
      if (row.leadStatus) setLeadStatus(result.lead.id, row.leadStatus);
      if (row.notes) addLeadNote(result.lead.id, row.notes);
    }
    setImportOpen(false);
    setImportRows([]);
  }

  const importableCount = importRows.filter((r) => r.fullName && r.sessionId).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-maia-ink">Webinar Registrations</h2>
          <p className="text-sm text-maia-ink-soft">{rows.length} registration(s) shown.</p>
        </div>
        <Button variant="secondary" onClick={() => setImportOpen(true)}>
          <UploadCloud size={14} />
          IMPORT REGISTRATIONS
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <SearchInput value={search} onChange={setSearch} placeholder="Name, FB name, email, contact, or Lead ID..." />
        <FilterSelect value={sessionFilter} onChange={(v) => setFilter("session", v)} options={[{ value: "all", label: "All Sessions" }, ...sessions.map((s) => ({ value: s.id, label: s.title }))]} />
        <FilterSelect value={attendanceFilter} onChange={(v) => setFilter("attendance", v)} options={[{ value: "all", label: "All Attendance" }, ...REGISTRATION_ATTENDANCE_STATUSES.map((a) => ({ value: a, label: a }))]} />
        <FilterSelect value={statusFilter} onChange={(v) => setFilter("status", v)} options={[{ value: "all", label: "All Lead Status" }, ...LEAD_STATUSES.map((s) => ({ value: s, label: s }))]} />
        <FilterSelect value={sourceFilter} onChange={(v) => setFilter("source", v)} options={[{ value: "all", label: "All Sources" }, ...LEAD_SOURCES.map((s) => ({ value: s, label: s }))]} />
      </div>

      <Card padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-maia-border bg-maia-bg/60 text-left text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">
                <th className="px-4 py-3">Registration ID</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Facebook Name</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">City</th>
                <th className="px-4 py-3">Webinar Session</th>
                <th className="px-4 py-3">Registered</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Attendance</th>
                <th className="px-4 py-3">Lead Status</th>
                <th className="px-4 py-3">Assigned To</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ registration, lead, session }) => (
                <tr key={registration.id} className="border-b border-maia-border/60 last:border-0 hover:bg-maia-bg/40">
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-maia-ink-soft">{registration.registrationId}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-maia-ink">{lead!.fullName}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{lead!.facebookName}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{lead!.contactNumber}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{lead!.city}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{session!.title}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{new Date(registration.registrationDate).toLocaleDateString("en-PH")}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{registration.leadSource}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <Badge tone={registration.attendanceStatus === "No Show" ? "danger" : registration.attendanceStatus === "Registered" ? "neutral" : "success"}>
                      {registration.attendanceStatus}
                    </Badge>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <Badge tone={pipelineStageTone(lead!.status)}>{lead!.status}</Badge>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{lead!.assignedStaffName ?? "Unassigned"}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <Button size="sm" onClick={() => navigate(`/webinar/leads/${lead!.id}`)}>
                      VIEW
                    </Button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={12} className="px-4 py-10 text-center text-sm text-maia-ink-soft">
                    No registrations match this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Import Registrations"
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setImportOpen(false)}>
              CANCEL
            </Button>
            <Button onClick={confirmImport} disabled={importableCount === 0}>
              CONFIRM IMPORT ({importableCount})
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-maia-ink-soft">
            Upload a CSV with columns <code>Name</code>, <code>FB Name</code>, <code>Email</code>, <code>Contact</code>, <code>City</code>,{" "}
            <code>Session</code>, <code>Attendance</code>, <code>Lead Status</code>, <code>Source</code>, <code>Notes</code>. Rows already matching an
            existing Lead or Student are still imported as a new registration for that same person — never a duplicate. Rows with no matching Session are
            skipped.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
            className="text-sm"
          />
          {importRows.length > 0 && (
            <div className="max-h-72 overflow-y-auto rounded-lg border border-maia-border">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b border-maia-border bg-maia-bg/60 text-left uppercase text-maia-ink-soft">
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Session</th>
                    <th className="px-3 py-2">Match</th>
                  </tr>
                </thead>
                <tbody>
                  {importRows.map((row, i) => (
                    <tr key={i} className="border-b border-maia-border/60 last:border-0">
                      <td className="px-3 py-2">{row.fullName || "—"}</td>
                      <td className="px-3 py-2">
                        {row.sessionId ? row.sessionTitle : <Badge tone="warning">Session not found — skipped</Badge>}
                      </td>
                      <td className="px-3 py-2">
                        {row.duplicate === "new" ? (
                          <Badge tone="gold">New Lead</Badge>
                        ) : (
                          <Badge tone="success">
                            {row.duplicate === "existing student" ? "Existing Student" : "Existing Lead"}: {row.matchedName}
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
