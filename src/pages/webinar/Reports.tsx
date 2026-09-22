import { useState } from "react";
import { Download } from "lucide-react";
import { Card, CardHeader } from "@/components/common/Card";
import { Button } from "@/components/common/Button";
import { Tabs } from "@/components/common/Tabs";
import { useWebinarStore } from "@/data/webinarStore";
import { downloadCsv } from "@/utils/finance";
import { conversionRate, isAttendedStatus } from "@/utils/webinar";
import { LEAD_SOURCES } from "@/types/webinar";

export function Reports() {
  const { sessions, leads, registrations, followUps } = useWebinarStore();
  const [view, setView] = useState<"session" | "source">("session");

  const sessionRows = sessions.map((session) => {
    const regs = registrations.filter((r) => r.webinarSessionId === session.id);
    const leadIdsForSession = new Set(regs.map((r) => r.leadId));
    const sessionLeads = leads.filter((l) => leadIdsForSession.has(l.id));
    const attended = regs.filter((r) => isAttendedStatus(r.attendanceStatus)).length;
    const completed = regs.filter((r) => r.attendanceStatus === "Completed Webinar").length;
    const noShow = regs.filter((r) => r.attendanceStatus === "No Show").length;
    const interested = sessionLeads.filter((l) => l.status === "Interested").length;
    const reservations = sessionLeads.filter((l) => l.status === "Reservation Paid" || l.status === "Enrolled" || l.convertedToStudentId).length;
    const enrolled = sessionLeads.filter((l) => l.status === "Enrolled" || l.convertedToStudentId).length;
    return { session, registrations: regs.length, attended, completed, noShow, interested, reservations, enrolled };
  });

  const sourceRows = LEAD_SOURCES.map((source) => {
    const sourceLeads = leads.filter((l) => l.leadSource === source);
    const sourceLeadIds = new Set(sourceLeads.map((l) => l.id));
    const regs = registrations.filter((r) => sourceLeadIds.has(r.leadId));
    const attended = new Set(regs.filter((r) => isAttendedStatus(r.attendanceStatus)).map((r) => r.leadId)).size;
    const interested = sourceLeads.filter((l) => l.status === "Interested").length;
    const reservations = sourceLeads.filter((l) => l.status === "Reservation Paid" || l.status === "Enrolled" || l.convertedToStudentId).length;
    const enrolled = sourceLeads.filter((l) => l.status === "Enrolled" || l.convertedToStudentId).length;
    return { source, registrations: sourceLeads.length, attended, interested, reservations, enrolled };
  }).filter((r) => r.registrations > 0);

  function exportRegistrations() {
    downloadCsv("webinar-registrations.csv", [
      ["Registration ID", "Lead ID", "Name", "Session", "Registration Date", "Attendance"],
      ...registrations.map((r) => {
        const lead = leads.find((l) => l.id === r.leadId);
        const session = sessions.find((s) => s.id === r.webinarSessionId);
        return [r.registrationId, lead?.leadId ?? "", lead?.fullName ?? "", session?.title ?? "", r.registrationDate, r.attendanceStatus];
      }),
    ]);
  }

  function exportAttendance() {
    downloadCsv("webinar-attendance.csv", [
      ["Name", "Session", "Status", "Check-In", "Check-Out", "Recorded By"],
      ...registrations.map((r) => {
        const lead = leads.find((l) => l.id === r.leadId);
        const session = sessions.find((s) => s.id === r.webinarSessionId);
        return [lead?.fullName ?? "", session?.title ?? "", r.attendanceStatus, r.checkInTime ?? "", r.checkOutTime ?? "", r.attendanceRecordedBy ?? ""];
      }),
    ]);
  }

  function exportFollowUps() {
    downloadCsv("webinar-follow-ups.csv", [
      ["Follow-up ID", "Lead", "Channel", "Date", "Status", "Outcome"],
      ...followUps.map((f) => {
        const lead = leads.find((l) => l.id === f.leadId);
        return [f.followUpId, lead?.fullName ?? "", f.channel, f.date, f.status, f.outcome ?? ""];
      }),
    ]);
  }

  function exportConversion() {
    downloadCsv("webinar-conversion.csv", [
      ["Session", "Registrations", "Attended", "Interested", "Reservations", "Enrolled"],
      ...sessionRows.map((r) => [r.session.title, r.registrations, r.attended, r.interested, r.reservations, r.enrolled]),
    ]);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-maia-ink">Free Webinar Reports</h2>
          <p className="text-sm text-maia-ink-soft">Session performance and lead source analysis.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={exportRegistrations}><Download size={12} />REGISTRATIONS</Button>
          <Button size="sm" variant="secondary" onClick={exportAttendance}><Download size={12} />ATTENDANCE</Button>
          <Button size="sm" variant="secondary" onClick={exportFollowUps}><Download size={12} />FOLLOW-UPS</Button>
          <Button size="sm" variant="secondary" onClick={exportConversion}><Download size={12} />CONVERSION</Button>
        </div>
      </div>

      <Tabs tabs={[{ value: "session", label: "Webinar Session Performance" }, { value: "source", label: "Leads by Source" }]} active={view} onChange={(v) => setView(v as "session" | "source")} />

      {view === "session" ? (
        <Card padded={false}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-maia-border bg-maia-bg/60 text-left text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">
                  <th className="px-4 py-3">Session</th>
                  <th className="px-4 py-3">Registrations</th>
                  <th className="px-4 py-3">Attended</th>
                  <th className="px-4 py-3">No Show</th>
                  <th className="px-4 py-3">Interested</th>
                  <th className="px-4 py-3">Reservations</th>
                  <th className="px-4 py-3">Enrolled</th>
                  <th className="px-4 py-3">Reg → Attend</th>
                  <th className="px-4 py-3">Attend → Enroll</th>
                  <th className="px-4 py-3">Reg → Enroll</th>
                </tr>
              </thead>
              <tbody>
                {sessionRows.map((r) => (
                  <tr key={r.session.id} className="border-b border-maia-border/60 last:border-0">
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-maia-ink">{r.session.title}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{r.registrations}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{r.attended}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{r.noShow}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{r.interested}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{r.reservations}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{r.enrolled}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-maia-gold-deep">{conversionRate(r.attended, r.registrations)}%</td>
                    <td className="whitespace-nowrap px-4 py-3 text-maia-gold-deep">{conversionRate(r.enrolled, r.attended)}%</td>
                    <td className="whitespace-nowrap px-4 py-3 text-maia-gold-deep">{conversionRate(r.enrolled, r.registrations)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <Card padded={false}>
          <div className="p-5 sm:p-6">
            <CardHeader title="Leads by Source" subtitle="Cost per registration/enrollment shown only once real ad-spend data is connected — never invented." />
          </div>
          <div className="overflow-x-auto border-t border-maia-border">
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-maia-border bg-maia-bg/60 text-left text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Registrations</th>
                  <th className="px-4 py-3">Attended</th>
                  <th className="px-4 py-3">Interested</th>
                  <th className="px-4 py-3">Reservations</th>
                  <th className="px-4 py-3">Enrolled</th>
                </tr>
              </thead>
              <tbody>
                {sourceRows.map((r) => (
                  <tr key={r.source} className="border-b border-maia-border/60 last:border-0">
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-maia-ink">{r.source}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{r.registrations}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{r.attended}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{r.interested}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{r.reservations}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{r.enrolled}</td>
                  </tr>
                ))}
                {sourceRows.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-maia-ink-soft">No leads yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
