import { useNavigate } from "react-router-dom";
import { Card, CardHeader } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { ATTENDANCE_STATUS_TONE, CERTIFICATE_STATUS_TONE } from "@/components/training/statusMeta";
import { useTrainingStore } from "@/data/trainingStore";
import type { StudentRecord } from "@/types/student";

export function TrainingTab({ student }: { student: StudentRecord }) {
  const { sessions, getEnrollmentsForStudent, certificates } = useTrainingStore();
  const navigate = useNavigate();

  const enrollments = getEnrollmentsForStudent(student.id);
  const rows = enrollments
    .map((e) => ({ enrollment: e, session: sessions.find((s) => s.id === e.sessionId) }))
    .filter((r) => r.session)
    .sort((a, b) => new Date(b.session!.date).getTime() - new Date(a.session!.date).getTime());

  const latestCertificate = certificates
    .filter((c) => c.studentId === student.id && c.status !== "Reissued")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

  return (
    <Card padded={false}>
      <div className="p-5 sm:p-6">
        <CardHeader title="Training &amp; Attendance" subtitle="Every session this student is registered for." />
      </div>
      <div className="overflow-x-auto border-t border-maia-border">
        <table className="w-full min-w-[860px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-maia-border bg-maia-bg/60 text-left text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">
              <th className="px-4 py-3">Session</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Batch</th>
              <th className="px-4 py-3">Attendance Status</th>
              <th className="px-4 py-3">Check-In</th>
              <th className="px-4 py-3">Certificate Status</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ enrollment, session }) => (
              <tr key={enrollment.id} className="border-b border-maia-border/60 last:border-0 hover:bg-maia-bg/40">
                <td className="whitespace-nowrap px-4 py-3 font-medium text-maia-ink">{session!.title}</td>
                <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{session!.date}</td>
                <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{session!.type}</td>
                <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{session!.batch}</td>
                <td className="whitespace-nowrap px-4 py-3">
                  <Badge tone={ATTENDANCE_STATUS_TONE[enrollment.attendanceStatus]}>{enrollment.attendanceStatus}</Badge>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">
                  {enrollment.checkInTime ? new Date(enrollment.checkInTime).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" }) : "—"}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  {latestCertificate ? (
                    <Badge tone={CERTIFICATE_STATUS_TONE[latestCertificate.status]}>{latestCertificate.status}</Badge>
                  ) : (
                    <span className="text-xs text-maia-ink-soft">—</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <Button size="sm" variant="secondary" onClick={() => navigate(`/training/sessions/${session!.id}`)}>
                    VIEW SESSION
                  </Button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-sm text-maia-ink-soft">
                  Not registered for any training session yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
