import { CalendarClock, Lock, MapPin, Video } from "lucide-react";
import { Card, CardHeader } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { useStudentPortal } from "@/context/StudentPortalContext";
import { useTrainingStore } from "@/data/trainingStore";
import { isOnlineTrainingType, type SessionEligibility, type TrainingSession } from "@/types/training";
import { ATTENDANCE_STATUS_TONE, SESSION_STATUS_TONE } from "@/components/training/statusMeta";

export function Training() {
  const { student } = useStudentPortal();
  const { sessions, getEnrollmentsForStudent } = useTrainingStore();

  const rows = getEnrollmentsForStudent(student.id)
    .map((enrollment) => ({ enrollment, session: sessions.find((s) => s.id === enrollment.sessionId) ?? null }))
    .filter((r): r is { enrollment: typeof r.enrollment; session: TrainingSession } => r.session !== null)
    .sort((a, b) => (a.session.date < b.session.date ? 1 : -1));

  const upcoming = rows.filter((r) => r.session.status === "Scheduled" || r.session.status === "Ongoing");
  const past = rows.filter((r) => r.session.status === "Completed" || r.session.status === "Cancelled");

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader title="Upcoming Training" subtitle="Sessions you're registered for that haven't happened yet." />
        {upcoming.length === 0 ? (
          <p className="rounded-xl bg-maia-bg px-4 py-6 text-center text-sm text-maia-ink-soft">
            No upcoming training scheduled yet.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {upcoming.map(({ enrollment, session }) => (
              <SessionCard key={session.id} session={session} eligibility={enrollment.eligibility} />
            ))}
          </div>
        )}
      </Card>

      <Card padded={false}>
        <div className="p-5 pb-0 sm:p-6 sm:pb-0">
          <CardHeader title="Past Training & Attendance" subtitle="Your attendance history — read-only." />
        </div>
        <div className="flex flex-col gap-2 p-5 pt-4 sm:p-6 sm:pt-4">
          {past.length === 0 && <p className="py-4 text-center text-sm text-maia-ink-soft">No past sessions yet.</p>}
          {past.map(({ enrollment, session }) => (
            <div key={session.id} className="flex flex-col gap-1.5 rounded-xl border border-maia-border p-3.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-maia-ink">{session.title}</p>
                <p className="text-xs text-maia-ink-soft">
                  {session.date} &middot; {session.type} &middot; {session.batch}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge tone={SESSION_STATUS_TONE[session.status]}>{session.status}</Badge>
                <Badge tone={ATTENDANCE_STATUS_TONE[enrollment.attendanceStatus]}>{enrollment.attendanceStatus}</Badge>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function SessionCard({ session, eligibility }: { session: TrainingSession; eligibility: SessionEligibility }) {
  const online = isOnlineTrainingType(session.type);
  const canSeeSensitive = online && eligibility === "Eligible";

  return (
    <div className="rounded-xl border border-maia-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-maia-ink">{session.title}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-maia-ink-soft">
            <CalendarClock size={13} />
            {session.date} &middot; {session.startTime}–{session.endTime}
          </p>
        </div>
        <Badge tone={SESSION_STATUS_TONE[session.status]}>{session.status}</Badge>
      </div>

      <div className="mt-3 rounded-lg bg-maia-bg px-3.5 py-3 text-sm">
        {online ? (
          canSeeSensitive ? (
            <div className="flex flex-col gap-1">
              <p className="flex items-center gap-1.5 font-medium text-maia-ink">
                <Video size={14} className="text-maia-gold-deep" />
                {session.platform || "Zoom"} Session
              </p>
              {session.zoomLink && (
                <a href={session.zoomLink} target="_blank" rel="noreferrer" className="text-maia-gold-deep underline">
                  {session.zoomLink}
                </a>
              )}
              {session.meetingId && <p className="text-maia-ink-soft">Meeting ID: {session.meetingId}</p>}
              {session.passcode && <p className="text-maia-ink-soft">Passcode: {session.passcode}</p>}
            </div>
          ) : (
            <p className="flex items-center gap-1.5 text-maia-ink-soft">
              <Lock size={13} />
              Zoom details will be shared here once your eligibility for this session is confirmed.
            </p>
          )
        ) : (
          <div className="flex flex-col gap-1">
            <p className="flex items-center gap-1.5 font-medium text-maia-ink">
              <MapPin size={14} className="text-maia-gold-deep" />
              {session.venueName || "Venue to be announced"}
            </p>
            {session.venueAddress && <p className="text-maia-ink-soft">{session.venueAddress}</p>}
          </div>
        )}
        {session.description && <p className="mt-2 text-maia-ink-soft">{session.description}</p>}
      </div>
    </div>
  );
}
