import { useNavigate } from "react-router-dom";
import { Card, CardHeader } from "@/components/common/Card";
import { Button } from "@/components/common/Button";
import { ProgressBar } from "@/components/common/ProgressBar";
import { getRequirementsBucket } from "@/utils/dashboard";
import { getStudentFinanceSummary, getTotalPackageValue, getTotalReceivables, getTotalVerifiedCollections } from "@/utils/finance";
import { formatPeso } from "@/utils/format";
import type { Batch, StudentRecord } from "@/types/student";
import type { PackageAdjustment, PaymentTransaction } from "@/types/finance";

const BATCH_TARGETS: Record<Batch, number> = {
  "Batch 15": 100,
  "Batch 14": 100,
  "Batch 13": 100,
  "Batch 12": 100,
};

export function CurrentBatchPerformanceCard({
  batch,
  students,
  transactions,
  adjustments,
}: {
  batch: Batch;
  students: StudentRecord[];
  transactions: PaymentTransaction[];
  adjustments: PackageAdjustment[];
}) {
  const navigate = useNavigate();
  const batchStudents = students.filter((s) => s.batch === batch);
  const target = BATCH_TARGETS[batch];
  const progressPercent = target > 0 ? Math.min(100, Math.round((batchStudents.length / target) * 100)) : 0;

  const summaries = batchStudents.map((s) => getStudentFinanceSummary(s, transactions, adjustments));
  const fullyPaid = summaries.filter((s) => s.status === "Fully Paid").length;
  const partial = summaries.filter((s) => s.status === "Partial Payment").length;
  const unpaid = summaries.filter((s) => s.status === "Unpaid").length;
  const pendingVerification = summaries.filter((s) => s.status === "Pending Verification").length;

  const faceToFace = batchStudents.filter((s) => s.attendance === "Face-to-Face").length;
  const zoom = batchStudents.filter((s) => s.attendance === "Early Access via Zoom").length;
  const both = batchStudents.filter((s) => s.attendance === "Both").length;

  const requirementsVerified = batchStudents.filter((s) => getRequirementsBucket(s) === "Verified").length;
  const requirementsIncomplete = batchStudents.length - requirementsVerified;

  const packageValue = getTotalPackageValue(batchStudents, adjustments);
  const batchTransactions = transactions.filter((t) => t.batch === batch);
  const verifiedCollections = getTotalVerifiedCollections(batchTransactions);
  const receivables = getTotalReceivables(batchStudents, transactions, adjustments);

  function goToBatchStudents(extra?: string) {
    navigate(`/students/all?batch=${encodeURIComponent(batch)}${extra ?? ""}`);
  }

  return (
    <Card>
      <CardHeader
        title="Current Batch Performance"
        subtitle={`${batchStudents.length} / ${target} students enrolled`}
        action={
          <Button variant="secondary" size="sm" onClick={() => navigate("/students/batches")}>
            VIEW ALL BATCHES
          </Button>
        }
      />

      <p className="font-display text-xl font-extrabold text-maia-ink">{batch}</p>

      <div className="mt-3">
        <div className="mb-2 flex items-end justify-between text-sm">
          <p className="font-medium text-maia-ink">
            {batchStudents.length} / {target} Students
          </p>
          <p className="font-display font-bold text-maia-gold-deep">{progressPercent}%</p>
        </div>
        <ProgressBar percent={progressPercent} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <MetricGroup label="Payment Status">
          <MetricRow label="Fully Paid" value={fullyPaid} tone="success" onClick={() => goToBatchStudents()} />
          <MetricRow
            label="Partial Payment"
            value={partial}
            tone="warning"
            onClick={() => navigate(`/finance/receivables?batch=${encodeURIComponent(batch)}&status=${encodeURIComponent("Partial Payment")}`)}
          />
          <MetricRow
            label="Unpaid"
            value={unpaid}
            tone="danger"
            onClick={() => navigate(`/finance/receivables?batch=${encodeURIComponent(batch)}&status=${encodeURIComponent("Unpaid")}`)}
          />
          <MetricRow
            label="Pending Verification"
            value={pendingVerification}
            tone="info"
            onClick={() => navigate(`/finance/payments?batch=${encodeURIComponent(batch)}&status=${encodeURIComponent("Pending Verification")}`)}
          />
        </MetricGroup>

        <MetricGroup label="Attendance Preference">
          <MetricRow label="Face-to-Face" value={faceToFace} tone="neutral" onClick={() => goToBatchStudents()} />
          <MetricRow label="Early Access via Zoom" value={zoom} tone="neutral" onClick={() => goToBatchStudents()} />
          <MetricRow label="Both" value={both} tone="neutral" onClick={() => goToBatchStudents()} />
        </MetricGroup>

        <MetricGroup label="Requirements">
          <MetricRow
            label="Verified"
            value={requirementsVerified}
            tone="success"
            onClick={() => navigate(`/students/all?batch=${encodeURIComponent(batch)}&requirements=${encodeURIComponent("Verified")}`)}
          />
          <MetricRow
            label="Incomplete"
            value={requirementsIncomplete}
            tone="warning"
            onClick={() => navigate(`/students/all?batch=${encodeURIComponent(batch)}&requirements=${encodeURIComponent("For Verification")}`)}
          />
        </MetricGroup>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 border-t border-maia-border pt-5 sm:grid-cols-3">
        <FinanceStat label="Total Package Value" value={formatPeso(packageValue)} />
        <FinanceStat label="Verified Collections" value={formatPeso(verifiedCollections)} />
        <FinanceStat
          label="Receivables"
          value={formatPeso(receivables)}
          onClick={() => navigate(`/finance/receivables?batch=${encodeURIComponent(batch)}`)}
        />
      </div>
    </Card>
  );
}

function MetricGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-maia-ink-soft">{label}</p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function MetricRow({
  label,
  value,
  tone,
  onClick,
}: {
  label: string;
  value: number;
  tone: "success" | "warning" | "danger" | "info" | "neutral";
  onClick?: () => void;
}) {
  const dotClass = {
    success: "bg-maia-success",
    warning: "bg-maia-warning",
    danger: "bg-maia-danger",
    info: "bg-maia-info",
    neutral: "bg-maia-gold-deep",
  }[tone];

  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-maia-bg"
    >
      <span className="flex items-center gap-2 text-maia-ink-soft">
        <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${dotClass}`} />
        {label}
      </span>
      <span className="font-display font-bold text-maia-ink">{value}</span>
    </button>
  );
}

function FinanceStat({ label, value, onClick }: { label: string; value: string; onClick?: () => void }) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      className={`rounded-xl bg-maia-bg px-4 py-3.5 text-left ${onClick ? "cursor-pointer transition-colors hover:bg-maia-gold-bg" : ""}`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">{label}</p>
      <p className="mt-1.5 font-display text-lg font-extrabold leading-none text-maia-ink">{value}</p>
    </Comp>
  );
}
