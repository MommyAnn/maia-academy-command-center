import { useMemo, useState } from "react";
import { Award, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardHeader } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { SearchInput } from "@/components/common/SearchInput";
import { FilterSelect } from "@/components/common/FilterSelect";
import { CERTIFICATE_STATUS_TONE } from "@/components/training/statusMeta";
import { useTrainingStore } from "@/data/trainingStore";
import { useStudentStore } from "@/data/studentStore";
import { useFinanceStore } from "@/data/financeStore";
import { BATCH_OPTIONS } from "@/data/enrollmentConfig";
import { CERTIFICATE_STATUSES, type CertificateStatus } from "@/types/training";
import { CERTIFICATE_TYPE_OPTIONS, DEFAULT_PROGRAM_NAME } from "@/data/trainingConfig";
import { computeCertificateEligibility, getStudentAttendanceRate } from "@/utils/training";
import type { Batch } from "@/types/student";

interface CertRow {
  studentId: string;
  studentName: string;
  studentDisplayId: string;
  batch: Batch;
  attendanceRate: number;
  status: CertificateStatus;
  reasons: string[];
  certificateRecordId: string | null;
  certificateId: string | null;
}

export function Certificates() {
  const { sessions, enrollments, certificates, eligibilitySettings, updateEligibilitySettings, markForPreparation, markReady, markIssued, reissueCertificate } =
    useTrainingStore();
  const { students } = useStudentStore();
  const { transactions, adjustments } = useFinanceStore();

  const [search, setSearch] = useState("");
  const [batch, setBatch] = useState("all");
  const [status, setStatus] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [settingsOpen, setSettingsOpen] = useState(false);

  const rows = useMemo<CertRow[]>(() => {
    return students.map((student) => {
      const existing = certificates
        .filter((c) => c.studentId === student.id && c.status !== "Reissued")
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
      const attendanceRate = getStudentAttendanceRate(student.id, sessions, enrollments);

      if (existing) {
        return {
          studentId: student.id,
          studentName: student.fullName,
          studentDisplayId: student.studentId,
          batch: student.batch,
          attendanceRate,
          status: existing.status,
          reasons: [],
          certificateRecordId: existing.id,
          certificateId: existing.certificateId,
        };
      }

      const { eligible, reasons } = computeCertificateEligibility(student, sessions, enrollments, transactions, adjustments, eligibilitySettings);
      return {
        studentId: student.id,
        studentName: student.fullName,
        studentDisplayId: student.studentId,
        batch: student.batch,
        attendanceRate,
        status: eligible ? "Eligible" : "Not Eligible",
        reasons,
        certificateRecordId: null,
        certificateId: null,
      };
    });
  }, [students, certificates, sessions, enrollments, transactions, adjustments, eligibilitySettings]);

  const filtered = rows.filter((r) => {
    const searchable = `${r.studentName} ${r.studentDisplayId}`.toLowerCase();
    if (search.trim() && !searchable.includes(search.trim().toLowerCase())) return false;
    if (batch !== "all" && r.batch !== batch) return false;
    if (status !== "all" && r.status !== status) return false;
    return true;
  });

  function toggleSelect(studentId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  }

  function bulkMarkForPreparation() {
    for (const row of filtered) {
      if (!selected.has(row.studentId)) continue;
      if (row.status !== "Eligible") continue;
      markForPreparation({ studentId: row.studentId, batch: row.batch, program: DEFAULT_PROGRAM_NAME, certificateType: CERTIFICATE_TYPE_OPTIONS[0] });
    }
    setSelected(new Set());
  }

  function bulkMarkReady() {
    for (const row of filtered) {
      if (!selected.has(row.studentId) || !row.certificateRecordId) continue;
      if (row.status !== "For Preparation") continue;
      markReady(row.certificateRecordId);
    }
    setSelected(new Set());
  }

  function bulkMarkIssued() {
    const today = new Date().toISOString().slice(0, 10);
    for (const row of filtered) {
      if (!selected.has(row.studentId) || !row.certificateRecordId) continue;
      if (row.status !== "Ready") continue;
      markIssued(row.certificateRecordId, today);
    }
    setSelected(new Set());
  }

  return (
    <div className="flex flex-col gap-6 pb-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-maia-gold-deep">Training</p>
        <h1 className="mt-1 font-display text-2xl font-extrabold text-maia-ink sm:text-[28px]">Certificates</h1>
        <p className="mt-1 text-sm text-maia-ink-soft">Eligibility is computed live — nothing is issued just because it was generated.</p>
      </div>

      <Card>
        <button onClick={() => setSettingsOpen((v) => !v)} className="flex w-full items-center justify-between text-left">
          <CardHeader title="Eligibility Rules" subtitle="Owner/Admin configurable — no rule is permanently hard-coded." />
          {settingsOpen ? <ChevronUp size={18} className="text-maia-ink-soft" /> : <ChevronDown size={18} className="text-maia-ink-soft" />}
        </button>
        {settingsOpen && (
          <div className="mt-2 flex flex-col gap-3 border-t border-maia-border pt-4">
            <label className="flex items-center gap-2.5 text-sm text-maia-ink">
              <input
                type="checkbox"
                checked={eligibilitySettings.requireConfirmedEnrollment}
                onChange={(e) => updateEligibilitySettings({ requireConfirmedEnrollment: e.target.checked })}
                className="h-4 w-4 accent-maia-gold-deep"
              />
              Require confirmed enrollment
            </label>
            <label className="flex items-center gap-2.5 text-sm text-maia-ink">
              <input
                type="checkbox"
                checked={eligibilitySettings.requireRequirementsVerified}
                onChange={(e) => updateEligibilitySettings({ requireRequirementsVerified: e.target.checked })}
                className="h-4 w-4 accent-maia-gold-deep"
              />
              Require verified requirements
            </label>
            <label className="flex items-center gap-2.5 text-sm text-maia-ink">
              <input
                type="checkbox"
                checked={eligibilitySettings.requireFullyPaid}
                onChange={(e) => updateEligibilitySettings({ requireFullyPaid: e.target.checked })}
                className="h-4 w-4 accent-maia-gold-deep"
              />
              Require Fully Paid status (off by default — Academy opt-in)
            </label>
            <div className="flex items-center gap-2.5 text-sm text-maia-ink">
              <span>Minimum attendance:</span>
              <input
                type="number"
                min={0}
                max={100}
                value={eligibilitySettings.minAttendancePercent}
                onChange={(e) => updateEligibilitySettings({ minAttendancePercent: Number(e.target.value) || 0 })}
                className="w-20 rounded-lg border border-maia-border bg-maia-surface px-2.5 py-1.5 text-sm text-maia-ink outline-none focus:border-maia-gold"
              />
              <span>% (0 disables this check)</span>
            </div>
          </div>
        )}
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search by name or student ID..." />
        <FilterSelect value={batch} onChange={setBatch} options={[{ value: "all", label: "All Batches" }, ...BATCH_OPTIONS.map((b) => ({ value: b, label: b }))]} />
        <FilterSelect
          value={status}
          onChange={setStatus}
          options={[{ value: "all", label: "All Statuses" }, ...CERTIFICATE_STATUSES.map((s) => ({ value: s, label: s }))]}
        />
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-maia-gold/30 bg-maia-gold-bg px-4 py-3">
          <span className="text-sm font-medium text-maia-gold-deep">{selected.size} selected</span>
          <Button size="sm" onClick={bulkMarkForPreparation}>
            MARK FOR PREPARATION
          </Button>
          <Button size="sm" variant="secondary" onClick={bulkMarkReady}>
            MARK READY
          </Button>
          <Button size="sm" variant="secondary" onClick={bulkMarkIssued}>
            MARK ISSUED
          </Button>
        </div>
      )}

      <Card padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-maia-border bg-maia-bg/60 text-left text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">
                <th className="px-4 py-3">
                  <span className="sr-only">Select</span>
                </th>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Batch</th>
                <th className="px-4 py-3">Attendance</th>
                <th className="px-4 py-3">Certificate ID</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.studentId} className="border-b border-maia-border/60 last:border-0 hover:bg-maia-bg/40">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(row.studentId)}
                      onChange={() => toggleSelect(row.studentId)}
                      className="h-4 w-4 cursor-pointer accent-maia-gold-deep"
                    />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <p className="font-medium text-maia-ink">{row.studentName}</p>
                    <p className="font-mono text-xs text-maia-ink-soft">{row.studentDisplayId}</p>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{row.batch}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{row.attendanceRate}%</td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-maia-ink-soft">{row.certificateId ?? "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <Badge tone={CERTIFICATE_STATUS_TONE[row.status]}>{row.status}</Badge>
                    {row.reasons.length > 0 && <p className="mt-1 max-w-[220px] text-[11px] text-maia-ink-soft">{row.reasons[0]}</p>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {row.status === "Eligible" && (
                        <Button
                          size="sm"
                          onClick={() =>
                            markForPreparation({ studentId: row.studentId, batch: row.batch, program: DEFAULT_PROGRAM_NAME, certificateType: CERTIFICATE_TYPE_OPTIONS[0] })
                          }
                        >
                          MARK FOR PREPARATION
                        </Button>
                      )}
                      {row.status === "For Preparation" && row.certificateRecordId && (
                        <Button size="sm" onClick={() => markReady(row.certificateRecordId!)}>
                          MARK READY
                        </Button>
                      )}
                      {row.status === "Ready" && row.certificateRecordId && (
                        <Button size="sm" onClick={() => markIssued(row.certificateRecordId!, new Date().toISOString().slice(0, 10))}>
                          MARK ISSUED
                        </Button>
                      )}
                      {row.status === "Issued" && row.certificateRecordId && (
                        <Button size="sm" variant="secondary" onClick={() => reissueCertificate(row.certificateRecordId!)}>
                          REISSUE
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-maia-ink-soft">
                    <Award className="mx-auto mb-2 text-maia-ink-soft/50" size={22} />
                    No students match your filters.
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
