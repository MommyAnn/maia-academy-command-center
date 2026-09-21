import { useNavigate } from "react-router-dom";
import { Card, CardHeader } from "@/components/common/Card";
import { useMasterBrainStore } from "@/data/masterBrainStore";
import type { MasterBrainStatus } from "@/types/student";

const STATUS_TILES: MasterBrainStatus[] = [
  "Not Started",
  "In Progress",
  "Submitted",
  "Under Review",
  "Needs Revision",
  "Approved for Generation",
  "Generating",
  "Draft Ready",
  "Final Review",
  "Completed",
  "Published",
];

export function Overview() {
  const { submissions } = useMasterBrainStore();
  const navigate = useNavigate();

  const counts = STATUS_TILES.reduce<Record<string, number>>((acc, status) => {
    acc[status] = submissions.filter((s) => s.status === status).length;
    return acc;
  }, {});

  const toReview = counts["Submitted"] + counts["Under Review"];
  const needingFinalApproval = counts["Final Review"];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-lg font-bold text-maia-ink">Master Brain Overview</h2>
        <p className="text-sm text-maia-ink-soft">Live counts across every student's Brand Master Brain submission.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {STATUS_TILES.map((status) => (
          <button
            key={status}
            onClick={() => navigate(`/master-brain/submissions?status=${encodeURIComponent(status)}`)}
            className="rounded-2xl border border-maia-border bg-maia-surface px-4 py-4 text-left transition-colors hover:border-maia-gold"
          >
            <p className="font-display text-2xl font-extrabold leading-none text-maia-ink">{counts[status]}</p>
            <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-wide text-maia-ink-soft">{status}</p>
          </button>
        ))}
      </div>

      <Card>
        <CardHeader title="Action Center" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            onClick={() => navigate(`/master-brain/submissions?status=${encodeURIComponent("Under Review")}`)}
            className="flex items-center justify-between rounded-xl bg-maia-bg px-4 py-3.5 text-left transition-colors hover:bg-maia-gold-bg"
          >
            <span className="text-sm font-medium text-maia-ink">Master Brains to Review</span>
            <span className="font-display text-xl font-extrabold text-maia-warning">{toReview}</span>
          </button>
          <button
            onClick={() => navigate(`/master-brain/submissions?status=${encodeURIComponent("Final Review")}`)}
            className="flex items-center justify-between rounded-xl bg-maia-bg px-4 py-3.5 text-left transition-colors hover:bg-maia-gold-bg"
          >
            <span className="text-sm font-medium text-maia-ink">Master Brains Needing Final Approval</span>
            <span className="font-display text-xl font-extrabold text-maia-gold-deep">{needingFinalApproval}</span>
          </button>
        </div>
      </Card>
    </div>
  );
}
