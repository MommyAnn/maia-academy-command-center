import { useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { Award, CheckCircle2, UserCheck } from "lucide-react";
import { Card, CardHeader } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { Tabs } from "@/components/common/Tabs";
import { Modal } from "@/components/common/Modal";
import { SelectField } from "@/components/common/SelectField";
import { TextField } from "@/components/common/TextField";
import { TextAreaField } from "@/components/common/TextAreaField";
import { useWebinarStore } from "@/data/webinarStore";
import { useStudentStore } from "@/data/studentStore";
import { useStaffStore } from "@/data/staffStore";
import { useFeedbackStore } from "@/data/feedbackStore";
import { BATCH_OPTIONS, PACKAGE_OPTIONS, ATTENDANCE_OPTIONS } from "@/data/enrollmentConfig";
import { FOLLOW_UP_CHANNELS } from "@/types/webinar";
import { pipelineStageTone } from "@/utils/webinar";
import type { Batch, PackageType, AttendancePreference } from "@/types/student";
import type { PaymentMethod } from "@/types/finance";

const TABS = [
  { value: "overview", label: "Overview" },
  { value: "history", label: "Webinar History" },
  { value: "followups", label: "Follow-ups" },
  { value: "notes", label: "Notes" },
  { value: "feedback", label: "Feedback" },
  { value: "conversion", label: "Conversion" },
  { value: "activity", label: "Activity" },
];

export function LeadProfile() {
  const { leadId } = useParams<{ leadId: string }>();
  const navigate = useNavigate();
  const { leads, sessions, registrations, followUps, assignLead, addLeadNote, createFollowUp, updateFollowUpResult, recordReservation, verifyReservation, rejectReservation, convertLeadToStudent } =
    useWebinarStore();
  const { getStudentById } = useStudentStore();
  const { staff } = useStaffStore();
  const { submissions: feedbackSubmissions } = useFeedbackStore();
  const [tab, setTab] = useState("overview");
  const [noteText, setNoteText] = useState("");
  const [followUpModalOpen, setFollowUpModalOpen] = useState(false);
  const [convertModalOpen, setConvertModalOpen] = useState(false);
  const [reservationModalOpen, setReservationModalOpen] = useState(false);

  const lead = leads.find((l) => l.id === leadId);

  const [followUpForm, setFollowUpForm] = useState({ assignedStaffId: "", channel: FOLLOW_UP_CHANNELS[0], date: new Date().toISOString().slice(0, 10), time: "10:00", notes: "" });
  const [convertForm, setConvertForm] = useState<{ batch: Batch; package: PackageType; attendance: AttendancePreference; enrollmentDate: string; companionName: string }>({
    batch: BATCH_OPTIONS[0],
    package: PACKAGE_OPTIONS[0],
    attendance: "Face-to-Face",
    enrollmentDate: new Date().toISOString().slice(0, 10),
    companionName: "",
  });
  const [reservationForm, setReservationForm] = useState<{ amount: number; method: PaymentMethod; referenceNumber: string; date: string }>({
    amount: 0,
    method: "GCash",
    referenceNumber: "",
    date: new Date().toISOString().slice(0, 10),
  });
  const [convertedStudentId, setConvertedStudentId] = useState<string | null>(null);

  if (!lead) {
    return <Navigate to="/webinar/pipeline" replace />;
  }

  const leadRegistrations = registrations
    .filter((r) => r.leadId === lead.id)
    .map((r) => ({ registration: r, session: sessions.find((s) => s.id === r.webinarSessionId) }))
    .sort((a, b) => b.registration.registrationDate.localeCompare(a.registration.registrationDate));

  const leadFollowUps = followUps.filter((f) => f.leadId === lead.id).sort((a, b) => b.date.localeCompare(a.date));
  const leadFeedback = feedbackSubmissions.filter((s) => s.leadId === lead.id && !s.isDraft).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  const linkedStudent = lead.convertedToStudentId ? getStudentById(lead.convertedToStudentId) : lead.linkedStudentId ? getStudentById(lead.linkedStudentId) : undefined;
  const isAlreadyPerson = Boolean(lead.linkedStudentId || lead.convertedToStudentId);

  function handleConvert() {
    const created = convertLeadToStudent(lead!.id, convertForm);
    setConvertedStudentId(created.id);
    setConvertModalOpen(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-xs text-maia-ink-soft">{lead.leadId}</p>
            <h2 className="font-display text-lg font-bold text-maia-ink">{lead.fullName}</h2>
            <p className="text-sm text-maia-ink-soft">{lead.facebookName} · {lead.city}</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={pipelineStageTone(lead.status)}>{lead.status}</Badge>
            {isAlreadyPerson && linkedStudent && (
              <Badge tone="success">
                <UserCheck size={12} />
                {lead.convertedToStudentId ? "Converted" : "Existing Student"}: {linkedStudent.studentId}
              </Badge>
            )}
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
          <div>
            <p className="font-semibold uppercase tracking-wide text-maia-ink-soft">Assigned Staff</p>
            <p className="mt-0.5 text-maia-ink">{lead.assignedStaffName ?? "Unassigned"}</p>
          </div>
          <div>
            <p className="font-semibold uppercase tracking-wide text-maia-ink-soft">Latest Webinar</p>
            <p className="mt-0.5 text-maia-ink">{sessions.find((s) => s.id === lead.latestWebinarSessionId)?.title ?? "—"}</p>
          </div>
          <div>
            <p className="font-semibold uppercase tracking-wide text-maia-ink-soft">Next Follow-up</p>
            <p className="mt-0.5 text-maia-ink">{lead.nextFollowUpDate ?? "None scheduled"}</p>
          </div>
          <div>
            <p className="font-semibold uppercase tracking-wide text-maia-ink-soft">Lead Source</p>
            <p className="mt-0.5 text-maia-ink">{lead.leadSource}</p>
          </div>
        </div>
        <div className="mt-3">
          <SelectField
            label="Assign To"
            value={lead.assignedStaffId ?? ""}
            onChange={(e) => {
              const s = staff.find((st) => st.id === e.target.value);
              if (s) assignLead(lead.id, s.id, s.fullName);
            }}
            placeholder="Unassigned"
            options={staff.filter((s) => s.role !== "Owner").map((s) => ({ value: s.id, label: `${s.fullName} (${s.role})` }))}
          />
        </div>
      </Card>

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === "overview" && (
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title="Contact Information" />
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div><dt className="text-xs font-semibold uppercase text-maia-ink-soft">Email</dt><dd className="text-sm text-maia-ink">{lead.email}</dd></div>
              <div><dt className="text-xs font-semibold uppercase text-maia-ink-soft">Contact Number</dt><dd className="text-sm text-maia-ink">{lead.contactNumber}</dd></div>
              <div><dt className="text-xs font-semibold uppercase text-maia-ink-soft">City</dt><dd className="text-sm text-maia-ink">{lead.city}</dd></div>
              <div><dt className="text-xs font-semibold uppercase text-maia-ink-soft">Campaign</dt><dd className="text-sm text-maia-ink">{lead.campaign || "—"}</dd></div>
            </dl>
          </Card>
          <Card>
            <CardHeader title="Business Information" />
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div><dt className="text-xs font-semibold uppercase text-maia-ink-soft">Business Status</dt><dd className="text-sm text-maia-ink">{lead.businessStatus}</dd></div>
              <div><dt className="text-xs font-semibold uppercase text-maia-ink-soft">Business Name</dt><dd className="text-sm text-maia-ink">{lead.businessName || "—"}</dd></div>
              <div><dt className="text-xs font-semibold uppercase text-maia-ink-soft">Selling Currently</dt><dd className="text-sm text-maia-ink">{lead.sellingCurrently === null ? "—" : lead.sellingCurrently ? "Yes" : "No"}</dd></div>
              <div><dt className="text-xs font-semibold uppercase text-maia-ink-soft">Importation Experience</dt><dd className="text-sm text-maia-ink">{lead.importationExperience === null ? "—" : lead.importationExperience ? "Yes" : "No"}</dd></div>
              <div><dt className="text-xs font-semibold uppercase text-maia-ink-soft">Timeline</dt><dd className="text-sm text-maia-ink">{lead.timeline || "—"}</dd></div>
              <div className="sm:col-span-2"><dt className="text-xs font-semibold uppercase text-maia-ink-soft">Biggest Challenge</dt><dd className="text-sm text-maia-ink">{lead.businessChallenge || "—"}</dd></div>
            </dl>
          </Card>
        </div>
      )}

      {tab === "history" && (
        <Card padded={false}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-maia-border bg-maia-bg/60 text-left text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">
                  <th className="px-4 py-3">Webinar</th>
                  <th className="px-4 py-3">Registration Date</th>
                  <th className="px-4 py-3">Attendance</th>
                  <th className="px-4 py-3">Notes</th>
                </tr>
              </thead>
              <tbody>
                {leadRegistrations.map(({ registration, session }) => (
                  <tr key={registration.id} className="border-b border-maia-border/60 last:border-0">
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-maia-ink">{session?.title ?? "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{new Date(registration.registrationDate).toLocaleDateString("en-PH")}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Badge tone={registration.attendanceStatus === "No Show" ? "danger" : registration.attendanceStatus === "Registered" ? "neutral" : "success"}>{registration.attendanceStatus}</Badge>
                    </td>
                    <td className="px-4 py-3 text-maia-ink-soft">{registration.attendanceNotes || "—"}</td>
                  </tr>
                ))}
                {leadRegistrations.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-maia-ink-soft">No webinar history yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === "followups" && (
        <div className="flex flex-col gap-4">
          <Button onClick={() => setFollowUpModalOpen(true)} className="self-start">
            SCHEDULE FOLLOW-UP
          </Button>
          {leadFollowUps.map((f) => (
            <Card key={f.id} className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-maia-ink">{f.channel} — {f.date} {f.time}</p>
                <Badge tone={f.status === "Completed" ? "success" : f.status === "To Do" ? "gold" : "neutral"}>{f.status}</Badge>
              </div>
              <p className="text-sm text-maia-ink-soft">{f.notes}</p>
              {f.outcome && <p className="text-xs text-maia-ink-soft">Outcome: {f.outcome}</p>}
              {f.status === "To Do" && (
                <div className="flex flex-wrap gap-1.5">
                  {(["Completed", "No Response", "Rescheduled", "Cancelled"] as const).map((status) => (
                    <Button key={status} size="sm" variant="secondary" onClick={() => updateFollowUpResult(f.id, { status, outcome: status === "No Response" ? "No Response" : null })}>
                      {status.toUpperCase()}
                    </Button>
                  ))}
                </div>
              )}
            </Card>
          ))}
          {leadFollowUps.length === 0 && <p className="rounded-xl bg-maia-bg px-4 py-6 text-center text-sm text-maia-ink-soft">No follow-ups yet.</p>}
        </div>
      )}

      {tab === "notes" && (
        <Card>
          <div className="flex flex-col gap-2">
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              rows={2}
              placeholder="Add a note..."
              className="w-full resize-none rounded-lg border border-maia-border bg-maia-surface px-3.5 py-2.5 text-sm text-maia-ink outline-none focus:border-maia-gold focus:ring-2 focus:ring-maia-gold/20"
            />
            <Button size="sm" className="self-end" onClick={() => { addLeadNote(lead.id, noteText); setNoteText(""); }} disabled={!noteText.trim()}>
              ADD NOTE
            </Button>
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {lead.notes.map((n) => (
              <div key={n.id} className="rounded-lg bg-maia-bg px-3 py-2 text-sm">
                <p className="text-maia-ink">{n.text}</p>
                <p className="mt-1 text-[11px] text-maia-ink-soft">{n.author} · {new Date(n.timestamp).toLocaleString("en-PH")}</p>
              </div>
            ))}
            {lead.notes.length === 0 && <p className="text-xs text-maia-ink-soft">No notes yet.</p>}
          </div>
        </Card>
      )}

      {tab === "feedback" && (
        <Card>
          <CardHeader title="Feedback" subtitle="Submitted via the same Global Feedback System used across the Academy — never a separate database." />
          <div className="flex flex-col gap-2">
            {leadFeedback.map((s) => (
              <button
                key={s.id}
                onClick={() => navigate(`/feedback/all/${s.id}`)}
                className="flex items-center justify-between rounded-lg bg-maia-bg px-3 py-2.5 text-left text-sm hover:bg-maia-gold-bg"
              >
                <div>
                  <p className="font-medium text-maia-ink">{s.sourceLabel}</p>
                  <p className="text-[11px] text-maia-ink-soft">
                    {s.rating ? `${s.rating}/5 · ` : ""}
                    Submitted {new Date(s.submittedAt).toLocaleDateString("en-PH")}
                  </p>
                </div>
                <Badge tone={s.status === "Approved for Marketing" || s.status === "Featured" ? "success" : "neutral"}>{s.status}</Badge>
              </button>
            ))}
            {leadFeedback.length === 0 && <p className="text-xs text-maia-ink-soft">No feedback submitted yet.</p>}
          </div>
        </Card>
      )}

      {tab === "conversion" && (
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title="Reservation" action={!lead.reservation && <Button size="sm" onClick={() => setReservationModalOpen(true)}>RECORD RESERVATION</Button>} />
            {lead.reservation ? (
              <div className="flex flex-col gap-2 text-sm">
                <p className="text-maia-ink">{lead.reservation.amount} via {lead.reservation.method} — Ref: {lead.reservation.referenceNumber}</p>
                <Badge tone={lead.reservation.verificationStatus === "Verified" ? "success" : lead.reservation.verificationStatus === "Rejected" ? "danger" : "warning"}>
                  {lead.reservation.verificationStatus}
                </Badge>
                {lead.reservation.verificationStatus === "Pending Verification" && (
                  <div className="flex gap-1.5">
                    <Button size="sm" onClick={() => verifyReservation(lead.id)}>VERIFY</Button>
                    <Button size="sm" variant="secondary" onClick={() => rejectReservation(lead.id)}>REJECT</Button>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-maia-ink-soft">No reservation recorded yet.</p>
            )}
          </Card>

          <Card>
            <CardHeader title="Convert to Student" />
            {convertedStudentId || lead.convertedToStudentId ? (
              <div className="flex flex-col items-start gap-2">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-maia-success"><CheckCircle2 size={14} /> Converted to Student</p>
                <Button size="sm" onClick={() => navigate(`/students/${convertedStudentId ?? lead.convertedToStudentId}`)}>VIEW STUDENT PROFILE</Button>
              </div>
            ) : lead.linkedStudentId ? (
              <div className="flex flex-col items-start gap-2">
                <p className="text-sm text-maia-ink-soft">This person is already an existing Student — no conversion needed.</p>
                <Button size="sm" onClick={() => navigate(`/students/${lead.linkedStudentId}`)}>VIEW STUDENT PROFILE</Button>
              </div>
            ) : (
              <Button onClick={() => setConvertModalOpen(true)}>
                <Award size={14} />
                CONVERT TO STUDENT
              </Button>
            )}
          </Card>
        </div>
      )}

      {tab === "activity" && (
        <Card>
          <div className="flex flex-col gap-2">
            {[...lead.activity].reverse().map((a) => (
              <div key={a.id} className="rounded-lg bg-maia-bg px-3 py-2 text-sm">
                <p className="text-maia-ink">{a.action}</p>
                <p className="mt-0.5 text-[11px] text-maia-ink-soft">{a.date} · {a.time} · {a.user}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Modal
        open={followUpModalOpen}
        onClose={() => setFollowUpModalOpen(false)}
        title="Schedule Follow-up"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setFollowUpModalOpen(false)}>CANCEL</Button>
            <Button
              onClick={() => {
                const s = staff.find((st) => st.id === followUpForm.assignedStaffId) ?? staff.find((st) => st.role !== "Owner");
                if (!s) return;
                createFollowUp({ leadId: lead.id, assignedStaffId: s.id, assignedStaffName: s.fullName, channel: followUpForm.channel, date: followUpForm.date, time: followUpForm.time, notes: followUpForm.notes });
                setFollowUpModalOpen(false);
              }}
            >
              SCHEDULE
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <SelectField label="Assigned Staff" value={followUpForm.assignedStaffId} onChange={(e) => setFollowUpForm((f) => ({ ...f, assignedStaffId: e.target.value }))} placeholder="Select staff" options={staff.filter((s) => s.role !== "Owner").map((s) => ({ value: s.id, label: s.fullName }))} />
          <SelectField label="Channel" value={followUpForm.channel} onChange={(e) => setFollowUpForm((f) => ({ ...f, channel: e.target.value as (typeof FOLLOW_UP_CHANNELS)[number] }))} options={FOLLOW_UP_CHANNELS.map((c) => ({ value: c, label: c }))} />
          <div className="grid grid-cols-2 gap-4">
            <TextField label="Date" type="date" value={followUpForm.date} onChange={(e) => setFollowUpForm((f) => ({ ...f, date: e.target.value }))} />
            <TextField label="Time" type="time" value={followUpForm.time} onChange={(e) => setFollowUpForm((f) => ({ ...f, time: e.target.value }))} />
          </div>
          <TextAreaField label="Notes" rows={2} value={followUpForm.notes} onChange={(e) => setFollowUpForm((f) => ({ ...f, notes: e.target.value }))} />
        </div>
      </Modal>

      <Modal
        open={reservationModalOpen}
        onClose={() => setReservationModalOpen(false)}
        title="Record Reservation"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setReservationModalOpen(false)}>CANCEL</Button>
            <Button onClick={() => { recordReservation(lead.id, { ...reservationForm, proof: null }); setReservationModalOpen(false); }}>SAVE</Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <TextField label="Amount" type="number" value={reservationForm.amount} onChange={(e) => setReservationForm((f) => ({ ...f, amount: Number(e.target.value) }))} />
          <SelectField label="Method" value={reservationForm.method} onChange={(e) => setReservationForm((f) => ({ ...f, method: e.target.value as PaymentMethod }))} options={["Bank Transfer", "GCash", "Maya", "Credit Card", "Cash", "Other"].map((m) => ({ value: m, label: m }))} />
          <TextField label="Reference Number" value={reservationForm.referenceNumber} onChange={(e) => setReservationForm((f) => ({ ...f, referenceNumber: e.target.value }))} />
          <TextField label="Date" type="date" value={reservationForm.date} onChange={(e) => setReservationForm((f) => ({ ...f, date: e.target.value }))} />
        </div>
      </Modal>

      <Modal
        open={convertModalOpen}
        onClose={() => setConvertModalOpen(false)}
        title="Convert to Student"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConvertModalOpen(false)}>CANCEL</Button>
            <Button onClick={handleConvert}>CONVERT</Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <SelectField label="Batch" value={convertForm.batch} onChange={(e) => setConvertForm((f) => ({ ...f, batch: e.target.value as Batch }))} options={BATCH_OPTIONS.map((b) => ({ value: b, label: b }))} />
          <SelectField label="Package" value={convertForm.package} onChange={(e) => setConvertForm((f) => ({ ...f, package: e.target.value as PackageType }))} options={PACKAGE_OPTIONS.map((p) => ({ value: p, label: p }))} />
          <SelectField label="Attendance Preference" value={convertForm.attendance} onChange={(e) => setConvertForm((f) => ({ ...f, attendance: e.target.value as AttendancePreference }))} options={ATTENDANCE_OPTIONS.map((a) => ({ value: a.value, label: a.label }))} />
          <TextField label="Enrollment Date" type="date" value={convertForm.enrollmentDate} onChange={(e) => setConvertForm((f) => ({ ...f, enrollmentDate: e.target.value }))} />
          <TextField label="Companion Name (optional)" value={convertForm.companionName} onChange={(e) => setConvertForm((f) => ({ ...f, companionName: e.target.value }))} />
        </div>
      </Modal>
    </div>
  );
}
