import { useNavigate } from "react-router-dom";
import { Card } from "@/components/common/Card";
import { Button } from "@/components/common/Button";
import { ProgressBar } from "@/components/common/ProgressBar";
import type { BatchEnrollmentSummary } from "@/types";

export function BatchEnrollmentCard({ data }: { data: BatchEnrollmentSummary }) {
  const navigate = useNavigate();

  return (
    <Card>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[13px] font-semibold uppercase tracking-wide text-maia-ink-soft">
            Current Batch Enrollment
          </p>
          <p className="mt-1 font-display text-2xl font-extrabold text-maia-ink">{data.batchName}</p>
        </div>
        <Button variant="secondary" onClick={() => navigate("/students/batches")}>
          VIEW BATCH
        </Button>
      </div>

      <div className="mt-6">
        <div className="mb-2 flex items-end justify-between">
          <p className="text-sm font-medium text-maia-ink-soft">
            <span className="font-display text-xl font-bold text-maia-ink">{data.currentCount}</span>
            {" / "}
            {data.targetCount} Students
          </p>
          <p className="font-display text-lg font-bold text-maia-gold-deep">{data.progressPercent}%</p>
        </div>
        <ProgressBar percent={data.progressPercent} />
        <p className="mt-2.5 text-sm text-maia-ink-soft">
          {data.remaining} students remaining to target
        </p>
      </div>
    </Card>
  );
}
