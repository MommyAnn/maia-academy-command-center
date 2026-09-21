import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LifeBuoy } from "lucide-react";
import { Card } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { FilterSelect } from "@/components/common/FilterSelect";
import { usePortalStore } from "@/data/portalStore";
import { useStudentStore } from "@/data/studentStore";
import { SUPPORT_STATUS_TONE } from "@/components/portal/statusMeta";
import { SUPPORT_STATUSES, type SupportStatus } from "@/types/portal";
import { formatDateTime } from "@/utils/students";

export function SupportRequests() {
  const { supportRequests, updateSupportRequestStatus } = usePortalStore();
  const { getStudentById } = useStudentStore();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>("All");

  const rows = supportRequests
    .filter((r) => statusFilter === "All" || r.status === statusFilter)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-maia-ink">Support Requests</h2>
          <p className="text-sm text-maia-ink-soft">Requests students submit from Need Help in the Student Portal.</p>
        </div>
        <FilterSelect
          value={statusFilter}
          onChange={setStatusFilter}
          options={[{ value: "All", label: "All Statuses" }, ...SUPPORT_STATUSES.map((s) => ({ value: s, label: s }))]}
        />
      </div>

      {rows.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <LifeBuoy size={28} className="text-maia-ink-soft/40" />
            <p className="text-sm text-maia-ink-soft">No support requests yet.</p>
          </div>
        </Card>
      ) : (
        rows.map((r) => {
          const student = getStudentById(r.studentId);
          return (
            <Card key={r.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-maia-ink">{r.subject}</p>
                    <Badge tone="neutral">{r.category}</Badge>
                  </div>
                  <button
                    onClick={() => student && navigate(`/students/${student.id}`)}
                    className="mt-1 text-xs font-medium text-maia-gold-deep hover:text-maia-ink"
                  >
                    {student ? `${student.fullName} (${student.studentId})` : "Unknown student"}
                  </button>
                  <p className="mt-2 text-sm text-maia-ink-soft">{r.message}</p>
                  <p className="mt-2 text-xs text-maia-ink-soft/70">
                    {r.supportId} &middot; Submitted {formatDateTime(r.createdAt)}
                  </p>
                </div>
                <div className="w-full flex-shrink-0 sm:w-48">
                  <FilterSelect
                    value={r.status}
                    onChange={(v) => updateSupportRequestStatus(r.id, v as SupportStatus)}
                    options={SUPPORT_STATUSES.map((s) => ({ value: s, label: s }))}
                  />
                  <div className="mt-2">
                    <Badge tone={SUPPORT_STATUS_TONE[r.status]}>{r.status}</Badge>
                  </div>
                </div>
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
}
