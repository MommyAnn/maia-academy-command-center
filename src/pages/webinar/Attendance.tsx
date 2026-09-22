import { useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
import { Card, CardHeader } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { Modal } from "@/components/common/Modal";
import { SelectField } from "@/components/common/SelectField";
import { SearchInput } from "@/components/common/SearchInput";
import { Tabs } from "@/components/common/Tabs";
import { useWebinarStore } from "@/data/webinarStore";
import { parseCsv } from "@/utils/webinar";
import type { RegistrationAttendanceStatus } from "@/types/webinar";

const QUICK_STATUSES: RegistrationAttendanceStatus[] = ["Attended", "Completed Webinar", "Left Early", "No Show"];

interface ImportPreviewRow {
  name: string;
  email: string;
  matched: boolean;
  leadName: string | null;
}

export function Attendance() {
  const { sessions, leads, registrations, recordAttendance } = useWebinarStore();
  const [view, setView] = useState<"quick" | "table">("quick");
  const [sessionId, setSessionId] = useState(sessions[0]?.id ?? "");
  const [search, setSearch] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [importRows, setImportRows] = useState<ImportPreviewRow[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sessionRegistrations = registrations
    .filter((r) => r.webinarSessionId === sessionId)
    .map((r) => ({ registration: r, lead: leads.find((l) => l.id === r.leadId) }))
    .filter((row) => row.lead)
    .filter((row) => {
      if (!search.trim()) return true;
      const q = search.trim().toLowerCase();
      return row.lead!.fullName.toLowerCase().includes(q) || row.lead!.facebookName.toLowerCase().includes(q) || row.lead!.contactNumber.toLowerCase().includes(q);
    });

  const allRows = registrations
    .map((r) => ({ registration: r, lead: leads.find((l) => l.id === r.leadId), session: sessions.find((s) => s.id === r.webinarSessionId) }))
    .filter((row) => row.lead && row.session);

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const rows = parseCsv(text);
      if (rows.length < 2) return;
      const header = rows[0].map((h) => h.trim().toLowerCase());
      const nameIdx = header.indexOf("name");
      const emailIdx = header.indexOf("email");
      const preview: ImportPreviewRow[] = rows.slice(1).map((r) => {
        const email = (r[emailIdx] ?? "").trim().toLowerCase();
        const matchedLead = leads.find((l) => l.email.toLowerCase() === email);
        return { name: r[nameIdx] ?? "", email, matched: Boolean(matchedLead), leadName: matchedLead?.fullName ?? null };
      });
      setImportRows(preview);
    };
    reader.readAsText(file);
  }

  function confirmImport() {
    for (const row of importRows) {
      if (!row.matched) continue;
      const lead = leads.find((l) => l.email.toLowerCase() === row.email);
      if (!lead) continue;
      const registration = registrations.find((r) => r.leadId === lead.id && r.webinarSessionId === sessionId);
      if (!registration) continue;
      recordAttendance(registration.id, "Completed Webinar", "CSV Import", "Imported from attendance list.");
    }
    setImportOpen(false);
    setImportRows([]);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-maia-ink">Free Group Webinar Attendance</h2>
          <p className="text-sm text-maia-ink-soft">Record attendance quickly, or import a list from your webinar platform.</p>
        </div>
        <Button variant="secondary" onClick={() => setImportOpen(true)}>
          <UploadCloud size={14} />
          IMPORT ATTENDANCE
        </Button>
      </div>

      <Tabs tabs={[{ value: "quick", label: "Quick Attendance" }, { value: "table", label: "Table View" }]} active={view} onChange={(v) => setView(v as "quick" | "table")} />

      {view === "quick" ? (
        <Card>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <SelectField
                label="Webinar Session"
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
                options={sessions.map((s) => ({ value: s.id, label: `${s.title} — ${new Date(s.date).toLocaleDateString("en-PH")}` }))}
              />
            </div>
            <div className="flex-1">
              <SearchInput value={search} onChange={setSearch} placeholder="Search name, FB name, or contact number..." />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {sessionRegistrations.map(({ registration, lead }) => (
              <div key={registration.id} className="flex flex-col gap-2 rounded-xl border border-maia-border p-3.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-maia-ink">{lead!.fullName}</p>
                  <p className="text-xs text-maia-ink-soft">{lead!.facebookName} · {lead!.contactNumber}</p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone={registration.attendanceStatus === "Registered" ? "neutral" : registration.attendanceStatus === "No Show" ? "danger" : "success"}>
                    {registration.attendanceStatus}
                  </Badge>
                  {QUICK_STATUSES.map((status) => (
                    <button
                      key={status}
                      onClick={() => recordAttendance(registration.id, status, "Front Desk")}
                      className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                        registration.attendanceStatus === status ? "border-maia-gold bg-maia-gold-bg text-maia-gold-deep" : "border-maia-border text-maia-ink-soft hover:border-maia-gold"
                      }`}
                    >
                      {status.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {sessionRegistrations.length === 0 && <p className="rounded-xl bg-maia-bg px-4 py-6 text-center text-sm text-maia-ink-soft">No registrations for this session yet.</p>}
          </div>
        </Card>
      ) : (
        <Card padded={false}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-maia-border bg-maia-bg/60 text-left text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Session</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Check-In</th>
                  <th className="px-4 py-3">Check-Out</th>
                  <th className="px-4 py-3">Recorded By</th>
                  <th className="px-4 py-3">Notes</th>
                </tr>
              </thead>
              <tbody>
                {allRows.map(({ registration, lead, session }) => (
                  <tr key={registration.id} className="border-b border-maia-border/60 last:border-0 hover:bg-maia-bg/40">
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-maia-ink">{lead!.fullName}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{session!.title}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Badge tone={registration.attendanceStatus === "No Show" ? "danger" : registration.attendanceStatus === "Registered" ? "neutral" : "success"}>
                        {registration.attendanceStatus}
                      </Badge>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{registration.checkInTime ? new Date(registration.checkInTime).toLocaleTimeString("en-PH") : "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{registration.checkOutTime ? new Date(registration.checkOutTime).toLocaleTimeString("en-PH") : "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{registration.attendanceRecordedBy ?? "—"}</td>
                    <td className="px-4 py-3 text-maia-ink-soft">{registration.attendanceNotes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card>
        <CardHeader title="Self Check-In (Prepared, Not Built)" />
        <p className="text-sm text-maia-ink-soft">
          Architecture is prepared for a future QR check-in / unique webinar check-in link per session (the same <code>WebinarRegistration</code> record this
          page updates would be the target of that check-in). No public, unauthenticated check-in endpoint exists yet — building one without real verification
          would let anyone mark attendance for anyone else, so it's intentionally not implemented in this demo.
        </p>
      </Card>

      <Modal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Import Attendance List"
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setImportOpen(false)}>
              CANCEL
            </Button>
            <Button onClick={confirmImport} disabled={importRows.filter((r) => r.matched).length === 0}>
              CONFIRM IMPORT ({importRows.filter((r) => r.matched).length})
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-maia-ink-soft">
            Upload a CSV exported from your webinar platform. Expected columns: <code>Name</code>, <code>Email</code>, <code>Join Time</code>, <code>Leave
            Time</code>, <code>Duration</code>. This is an import/preparation feature only — no real Zoom integration is connected.
          </p>
          <SelectField
            label="Apply to Session"
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
            options={sessions.map((s) => ({ value: s.id, label: s.title }))}
          />
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
            <div className="max-h-64 overflow-y-auto rounded-lg border border-maia-border">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b border-maia-border bg-maia-bg/60 text-left uppercase text-maia-ink-soft">
                    <th className="px-3 py-2">CSV Name</th>
                    <th className="px-3 py-2">Email</th>
                    <th className="px-3 py-2">Match</th>
                  </tr>
                </thead>
                <tbody>
                  {importRows.map((row, i) => (
                    <tr key={i} className="border-b border-maia-border/60 last:border-0">
                      <td className="px-3 py-2">{row.name}</td>
                      <td className="px-3 py-2">{row.email}</td>
                      <td className="px-3 py-2">
                        {row.matched ? <Badge tone="success">{row.leadName}</Badge> : <Badge tone="warning">No match — skipped</Badge>}
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
