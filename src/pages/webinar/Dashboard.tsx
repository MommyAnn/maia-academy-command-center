import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Card, CardHeader } from "@/components/common/Card";
import { FilterSelect } from "@/components/common/FilterSelect";
import { DatePresetSelect, DEFAULT_DATE_FILTER } from "@/components/finance/DatePresetSelect";
import { useWebinarStore } from "@/data/webinarStore";
import { matchesDateFilter, type DateFilterValue } from "@/utils/finance";
import { conversionRate, isAttendedStatus, isFollowUpOverdue } from "@/utils/webinar";

export function Dashboard() {
  const { sessions, leads, registrations, followUps } = useWebinarStore();
  const navigate = useNavigate();
  const [dateFilter, setDateFilter] = useState<DateFilterValue>(DEFAULT_DATE_FILTER);
  const [sessionFilter, setSessionFilter] = useState("all");
  const [campaignFilter, setCampaignFilter] = useState("all");

  const campaigns = Array.from(new Set(leads.map((l) => l.campaign).filter(Boolean)));

  const filteredRegistrations = registrations.filter((r) => {
    if (sessionFilter !== "all" && r.webinarSessionId !== sessionFilter) return false;
    if (campaignFilter !== "all" && r.campaign !== campaignFilter) return false;
    return matchesDateFilter(r.registrationDate, dateFilter);
  });
  const relevantLeadIds = new Set(filteredRegistrations.map((r) => r.leadId));
  const relevantLeads = leads.filter((l) => relevantLeadIds.has(l.id));

  const totalRegistrations = filteredRegistrations.length;
  const upcomingSessions = sessions.filter((s) => s.status === "Open for Registration" || s.status === "Registration Closed");
  const attended = filteredRegistrations.filter((r) => isAttendedStatus(r.attendanceStatus)).length;
  const noShow = filteredRegistrations.filter((r) => r.attendanceStatus === "No Show").length;
  const followUpNeeded = relevantLeads.filter((l) => l.status === "Follow-up Needed").length;
  const interested = relevantLeads.filter((l) => l.status === "Interested").length;
  const reservationPaid = relevantLeads.filter((l) => l.status === "Reservation Paid").length;
  const enrolled = relevantLeads.filter((l) => l.status === "Enrolled" || l.convertedToStudentId).length;

  const tiles = [
    { label: "Total Registrations", value: totalRegistrations, path: "/webinar/registrations" },
    { label: "Upcoming Webinar", value: upcomingSessions.length, path: "/webinar/sessions" },
    { label: "Attended", value: attended, path: "/webinar/attendance" },
    { label: "No Show", value: noShow, path: "/webinar/attendance" },
    { label: "Follow-up Needed", value: followUpNeeded, path: "/webinar/follow-ups" },
    { label: "Interested", value: interested, path: "/webinar/pipeline" },
    { label: "Reservation Paid", value: reservationPaid, path: "/webinar/pipeline" },
    { label: "Enrolled", value: enrolled, path: "/webinar/conversion" },
  ];

  const overdueFollowUps = followUps.filter((f) => isFollowUpOverdue(f)).length;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-lg font-bold text-maia-ink">Free Webinar Dashboard</h2>
        <p className="text-sm text-maia-ink-soft">Lead and conversion performance across every free webinar.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <DatePresetSelect value={dateFilter} onChange={setDateFilter} />
        <FilterSelect
          value={sessionFilter}
          onChange={setSessionFilter}
          options={[{ value: "all", label: "All Sessions" }, ...sessions.map((s) => ({ value: s.id, label: s.title }))]}
        />
        <FilterSelect
          value={campaignFilter}
          onChange={setCampaignFilter}
          options={[{ value: "all", label: "All Campaigns" }, ...campaigns.map((c) => ({ value: c, label: c }))]}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map((tile) => (
          <button
            key={tile.label}
            onClick={() => navigate(tile.path)}
            className="rounded-2xl border border-maia-border bg-maia-surface px-4 py-4 text-left transition-colors hover:border-maia-gold"
          >
            <p className="font-display text-2xl font-extrabold leading-none text-maia-ink">{tile.value}</p>
            <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-wide text-maia-ink-soft">{tile.label}</p>
          </button>
        ))}
      </div>

      <Card>
        <CardHeader title="Operational Conversion Rates" subtitle="Computed live from registrations and pipeline stage — never a stored, separately-tracked number." />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl bg-maia-bg px-4 py-3.5">
            <p className="font-display text-xl font-extrabold text-maia-gold-deep">{conversionRate(attended, totalRegistrations)}%</p>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-maia-ink-soft">Registration → Attendance</p>
          </div>
          <div className="rounded-xl bg-maia-bg px-4 py-3.5">
            <p className="font-display text-xl font-extrabold text-maia-gold-deep">{conversionRate(interested, attended)}%</p>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-maia-ink-soft">Attendance → Interested</p>
          </div>
          <div className="rounded-xl bg-maia-bg px-4 py-3.5">
            <p className="font-display text-xl font-extrabold text-maia-gold-deep">{conversionRate(enrolled, attended)}%</p>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-maia-ink-soft">Attendance → Enrollment</p>
          </div>
          <div className="rounded-xl bg-maia-bg px-4 py-3.5">
            <p className="font-display text-xl font-extrabold text-maia-gold-deep">{conversionRate(enrolled, totalRegistrations)}%</p>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-maia-ink-soft">Registration → Enrollment</p>
          </div>
        </div>
      </Card>

      {overdueFollowUps > 0 && (
        <button
          onClick={() => navigate("/webinar/follow-ups?queue=overdue")}
          className="flex items-center justify-between rounded-2xl border border-maia-danger/30 bg-maia-danger-bg px-4 py-3.5 text-left transition-colors hover:border-maia-danger"
        >
          <span className="text-sm font-semibold text-maia-danger">{overdueFollowUps} overdue follow-up(s) need attention</span>
          <span className="text-xs font-semibold text-maia-danger">VIEW QUEUE</span>
        </button>
      )}
    </div>
  );
}
