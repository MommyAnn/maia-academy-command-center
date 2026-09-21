import { useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Plus, Users } from "lucide-react";
import { Card, CardHeader } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { SelectField } from "@/components/common/SelectField";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { SESSION_STATUS_TONE, ATTENDANCE_STATUS_TONE } from "@/components/training/statusMeta";
import { useTrainingStore } from "@/data/trainingStore";
import { useStudentStore } from "@/data/studentStore";
import { useStaffStore } from "@/data/staffStore";
import { useInventoryStore } from "@/data/inventoryStore";
import { ATTENDANCE_STATUSES, TRAINING_SESSION_STATUSES, isOnlineTrainingType, type AttendanceStatus, type TrainingSessionStatus } from "@/types/training";

export function SessionDetail() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { getSessionById, getEnrollmentsForSession, setSessionStatus, addStudentToSession, addAllEligibleFromBatch, removeStudentFromSession, recordAttendance } =
    useTrainingStore();
  const { students } = useStudentStore();
  const { staff } = useStaffStore();
  const { items } = useInventoryStore();
  const navigate = useNavigate();

  const [addStudentId, setAddStudentId] = useState("");
  const [removeCandidate, setRemoveCandidate] = useState<string | null>(null);

  const session = sessionId ? getSessionById(sessionId) : undefined;

  if (!session) {
    return <Navigate to="/training/sessions" replace />;
  }

  const roster = getEnrollmentsForSession(session.id);
  const online = isOnlineTrainingType(session.type);
  const batchStudents = students.filter((s) => s.batch === session.batch);
  const notInRoster = students.filter((s) => !roster.some((r) => r.studentId === s.id));

  return (
    <div className="flex flex-col gap-6 pb-4">
      <button onClick={() => navigate("/training/sessions")} className="flex w-fit items-center gap-1.5 text-sm font-medium text-maia-ink-soft hover:text-maia-ink">
        <ArrowLeft size={15} />
        Back to Training Sessions
      </button>

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-mono text-xs font-semibold text-maia-ink-soft">{session.sessionId}</p>
            <h1 className="mt-1 font-display text-xl font-extrabold text-maia-ink sm:text-2xl">{session.title}</h1>
            <p className="mt-2 max-w-2xl text-sm text-maia-ink-soft">{session.description || "No description provided."}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="gold">{session.batch}</Badge>
            <Badge tone="info">{session.type}</Badge>
            <Badge tone={SESSION_STATUS_TONE[session.status]}>{session.status}</Badge>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4 border-t border-maia-border pt-5 sm:grid-cols-4">
          <Field label="Date" value={session.date} />
          <Field label="Time" value={`${session.startTime} – ${session.endTime}`} />
          <Field label="Trainer" value={session.trainer || "—"} />
          <Field label="Capacity" value={session.capacity ? String(session.capacity) : "—"} />
          {online ? (
            <>
              <Field label="Platform" value={session.platform || "—"} />
              <Field label="Meeting ID" value={session.meetingId || "—"} />
              <Field label="Zoom Link" value={session.zoomLink || "—"} />
              <Field label="Passcode" value={session.passcode || "—"} />
            </>
          ) : (
            <>
              <Field label="Venue Name" value={session.venueName || "—"} />
              <Field label="Venue Address" value={session.venueAddress || "—"} />
            </>
          )}
        </div>

        {online && (
          <p className="mt-4 rounded-lg bg-maia-warning-bg px-3.5 py-2.5 text-xs text-maia-warning">
            Meeting details are sensitive — visible here to staff only. A future Student Portal will control exactly
            which eligible students can see them.
          </p>
        )}

        <div className="mt-5 border-t border-maia-border pt-5">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-maia-ink-soft">Assigned Staff</p>
          <div className="flex flex-wrap gap-2">
            {session.assignedStaffIds.length === 0 && <span className="text-sm text-maia-ink-soft">None assigned.</span>}
            {session.assignedStaffIds.map((id) => {
              const s = staff.find((st) => st.id === id);
              return s ? <Badge key={id}>{s.fullName}</Badge> : null;
            })}
          </div>
        </div>

        {session.materials.length > 0 && (
          <div className="mt-5 border-t border-maia-border pt-5">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-maia-ink-soft">Materials Needed</p>
            <ul className="flex flex-wrap gap-2">
              {session.materials.map((m, i) => {
                const item = items.find((it) => it.id === m.itemId);
                return (
                  <li key={i} className="rounded-lg bg-maia-bg px-3 py-1.5 text-xs text-maia-ink">
                    {m.quantity} {item?.name ?? "Unknown item"}
                  </li>
                );
              })}
            </ul>
            <p className="mt-1.5 text-xs text-maia-ink-soft/80">Planning only — stock is only reduced by a confirmed Stock Out.</p>
          </div>
        )}

        <div className="mt-5 max-w-xs border-t border-maia-border pt-5">
          <SelectField
            label="Session Status"
            value={session.status}
            onChange={(e) => setSessionStatus(session.id, e.target.value as TrainingSessionStatus)}
            options={TRAINING_SESSION_STATUSES.map((s) => ({ value: s, label: s }))}
          />
        </div>
      </Card>

      <Card padded={false}>
        <div className="flex flex-wrap items-center justify-between gap-3 p-5 sm:p-6">
          <CardHeader title="Student Roster" subtitle={`${roster.length} student(s) on this session's list.`} />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => addAllEligibleFromBatch(session.id, batchStudents)}>
              <Users size={14} />
              ADD ALL FROM {session.batch.toUpperCase()}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 px-5 pb-4 sm:px-6">
          <select
            value={addStudentId}
            onChange={(e) => setAddStudentId(e.target.value)}
            className="min-w-[220px] flex-1 rounded-lg border border-maia-border bg-maia-surface px-3 py-2 text-sm text-maia-ink outline-none focus:border-maia-gold"
          >
            <option value="">Select a student to add...</option>
            {notInRoster.map((s) => (
              <option key={s.id} value={s.id}>
                {s.fullName} ({s.studentId})
              </option>
            ))}
          </select>
          <Button
            size="sm"
            onClick={() => {
              if (!addStudentId) return;
              addStudentToSession(session.id, addStudentId);
              setAddStudentId("");
            }}
            disabled={!addStudentId}
          >
            <Plus size={14} />
            ADD STUDENT
          </Button>
        </div>

        <div className="overflow-x-auto border-t border-maia-border">
          <table className="w-full min-w-[1000px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-maia-border bg-maia-bg/60 text-left text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">
                <th className="px-4 py-3">Student ID</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Package</th>
                <th className="px-4 py-3">Attendance Pref.</th>
                <th className="px-4 py-3">Attendance Status</th>
                <th className="px-4 py-3">Check-In</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {roster.map((entry) => {
                const student = students.find((s) => s.id === entry.studentId);
                if (!student) return null;
                return (
                  <tr key={entry.id} className="border-b border-maia-border/60 last:border-0 hover:bg-maia-bg/40">
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-semibold text-maia-ink">{student.studentId}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-maia-ink">{student.fullName}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{student.package}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{student.attendance}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <select
                        value={entry.attendanceStatus}
                        onChange={(e) => recordAttendance(session.id, entry.studentId, e.target.value as AttendanceStatus)}
                        className="rounded-lg border border-maia-border bg-maia-surface px-2.5 py-1.5 text-xs text-maia-ink outline-none focus:border-maia-gold"
                      >
                        {ATTENDANCE_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                      <span className="ml-2">
                        <Badge tone={ATTENDANCE_STATUS_TONE[entry.attendanceStatus]}>{entry.attendanceStatus}</Badge>
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">
                      {entry.checkInTime ? new Date(entry.checkInTime).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" }) : "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Button size="sm" variant="ghost" onClick={() => setRemoveCandidate(entry.studentId)}>
                        REMOVE
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {roster.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-maia-ink-soft">
                    No students added to this session yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <ConfirmDialog
        open={Boolean(removeCandidate)}
        onClose={() => setRemoveCandidate(null)}
        onConfirm={() => {
          if (removeCandidate) removeStudentFromSession(session.id, removeCandidate);
          setRemoveCandidate(null);
        }}
        title="Remove Student from Session"
        description="This only removes them from this session's roster — their Academy record is never affected."
        confirmLabel="REMOVE"
        tone="danger"
      />
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-maia-ink-soft">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-maia-ink">{value}</p>
    </div>
  );
}
