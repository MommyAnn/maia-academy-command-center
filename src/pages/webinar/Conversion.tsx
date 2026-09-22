import { useState } from "react";
import { Card, CardHeader } from "@/components/common/Card";
import { FilterSelect } from "@/components/common/FilterSelect";
import { DatePresetSelect, DEFAULT_DATE_FILTER } from "@/components/finance/DatePresetSelect";
import { useWebinarStore } from "@/data/webinarStore";
import { useStaffStore } from "@/data/staffStore";
import { matchesDateFilter, type DateFilterValue } from "@/utils/finance";
import { conversionRate, isAttendedStatus } from "@/utils/webinar";
import { LEAD_SOURCES } from "@/types/webinar";

export function Conversion() {
  const { sessions, leads, registrations } = useWebinarStore();
  const { staff } = useStaffStore();
  const [dateFilter, setDateFilter] = useState<DateFilterValue>(DEFAULT_DATE_FILTER);
  const [sessionFilter, setSessionFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [staffFilter, setStaffFilter] = useState("all");

  const filteredRegistrations = registrations.filter((r) => {
    if (sessionFilter !== "all" && r.webinarSessionId !== sessionFilter) return false;
    if (sourceFilter !== "all" && r.leadSource !== sourceFilter) return false;
    return matchesDateFilter(r.registrationDate, dateFilter);
  });
  const leadIds = new Set(filteredRegistrations.map((r) => r.leadId));
  let relevantLeads = leads.filter((l) => leadIds.has(l.id));
  if (staffFilter !== "all") relevantLeads = relevantLeads.filter((l) => l.assignedStaffId === staffFilter);

  const registrationsCount = filteredRegistrations.length;
  const attendedCount = new Set(filteredRegistrations.filter((r) => isAttendedStatus(r.attendanceStatus)).map((r) => r.leadId)).size;
  const interestedCount = relevantLeads.filter((l) => ["Interested", "Considering", "Reservation Paid", "Enrolled"].includes(l.status) || l.convertedToStudentId).length;
  const consideringCount = relevantLeads.filter((l) => ["Considering", "Reservation Paid", "Enrolled"].includes(l.status) || l.convertedToStudentId).length;
  const reservationCount = relevantLeads.filter((l) => l.status === "Reservation Paid" || l.status === "Enrolled" || l.convertedToStudentId).length;
  const enrolledCount = relevantLeads.filter((l) => l.status === "Enrolled" || l.convertedToStudentId).length;

  const funnel = [
    { label: "Registrations", count: registrationsCount },
    { label: "Attended", count: attendedCount },
    { label: "Interested", count: interestedCount },
    { label: "Considering", count: consideringCount },
    { label: "Reservation Paid", count: reservationCount },
    { label: "Enrolled", count: enrolledCount },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-lg font-bold text-maia-ink">Conversion Funnel</h2>
        <p className="text-sm text-maia-ink-soft">Where leads move through the funnel — for process improvement, never for ranking staff.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <DatePresetSelect value={dateFilter} onChange={setDateFilter} />
        <FilterSelect value={sessionFilter} onChange={setSessionFilter} options={[{ value: "all", label: "All Sessions" }, ...sessions.map((s) => ({ value: s.id, label: s.title }))]} />
        <FilterSelect value={sourceFilter} onChange={setSourceFilter} options={[{ value: "all", label: "All Sources" }, ...LEAD_SOURCES.map((s) => ({ value: s, label: s }))]} />
        <FilterSelect value={staffFilter} onChange={setStaffFilter} options={[{ value: "all", label: "All Staff" }, ...staff.filter((s) => s.role !== "Owner").map((s) => ({ value: s.id, label: s.fullName }))]} />
      </div>

      <Card>
        <CardHeader title="Funnel" />
        <div className="flex flex-col gap-2">
          {funnel.map((stage, i) => {
            const prev = i > 0 ? funnel[i - 1].count : stage.count;
            const rate = i > 0 ? conversionRate(stage.count, prev) : 100;
            const widthPercent = registrationsCount > 0 ? Math.max(8, Math.round((stage.count / registrationsCount) * 100)) : 0;
            return (
              <div key={stage.label} className="flex items-center gap-3">
                <div className="w-36 flex-shrink-0 text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">{stage.label}</div>
                <div className="flex-1">
                  <div className="h-8 rounded-lg bg-maia-bg">
                    <div className="flex h-8 items-center justify-end rounded-lg bg-gradient-to-r from-maia-gold-deep to-maia-gold px-3 text-xs font-bold text-maia-black" style={{ width: `${widthPercent}%` }}>
                      {stage.count}
                    </div>
                  </div>
                </div>
                {i > 0 && <div className="w-16 flex-shrink-0 text-right text-xs font-semibold text-maia-gold-deep">{rate}%</div>}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
