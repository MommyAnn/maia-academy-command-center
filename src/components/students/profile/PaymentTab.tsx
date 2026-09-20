import { useState } from "react";
import { Eye, Plus, Tag } from "lucide-react";
import { Card, CardHeader } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { ProgressBar } from "@/components/common/ProgressBar";
import { PAYMENT_STATUS_TONE } from "@/components/students/statusMeta";
import { PAYMENT_TXN_STATUS_TONE } from "@/components/finance/financeStatusMeta";
import { RecordPaymentModal } from "@/components/finance/RecordPaymentModal";
import { AdjustmentModal } from "@/components/finance/AdjustmentModal";
import { DocumentPreviewModal } from "@/components/students/profile/DocumentPreviewModal";
import { useFinanceStore } from "@/data/financeStore";
import { getStudentFinanceSummary } from "@/utils/finance";
import { formatPeso } from "@/utils/format";
import { formatDate } from "@/utils/students";
import type { StudentRecord } from "@/types/student";
import type { PaymentTransaction } from "@/types/finance";

export function PaymentTab({ student }: { student: StudentRecord }) {
  const { transactions, adjustments } = useFinanceStore();
  const [recordOpen, setRecordOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [proofTxn, setProofTxn] = useState<PaymentTransaction | null>(null);

  const summary = getStudentFinanceSummary(student, transactions, adjustments);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader title="Package Information" />
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label="Package" value={student.package} />
          <Field label="Package Price" value={formatPeso(summary.originalPrice)} />
          <Field label="Discount / Adjustment" value={summary.totalAdjustments > 0 ? `-${formatPeso(summary.totalAdjustments)}` : "—"} />
          <Field label="Final Package Amount" value={formatPeso(summary.finalPackageAmount)} />
        </dl>

        {summary.adjustments.length > 0 && (
          <div className="mt-4 space-y-2 border-t border-maia-border pt-4">
            {summary.adjustments.map((a) => (
              <div key={a.id} className="flex items-start gap-2.5 rounded-lg bg-maia-bg px-3.5 py-2.5 text-sm">
                <Tag size={14} className="mt-0.5 flex-shrink-0 text-maia-gold-deep" />
                <div>
                  <p className="text-maia-ink">
                    <span className="font-semibold">{a.type}</span> &middot; -{formatPeso(a.amount)} &mdash; {a.reason}
                  </p>
                  <p className="mt-0.5 text-xs text-maia-ink-soft">
                    {a.createdBy} &middot; {a.date} {a.time}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        <Button variant="secondary" size="sm" className="mt-4" onClick={() => setAdjustOpen(true)}>
          <Tag size={14} />
          APPLY DISCOUNT / ADJUSTMENT
        </Button>
      </Card>

      <Card>
        <CardHeader title="Payment Summary" action={<Badge tone={PAYMENT_STATUS_TONE[summary.status]}>{summary.status}</Badge>} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Stat label="Total Package Amount" value={formatPeso(summary.finalPackageAmount)} />
          <Stat label="Total Verified Paid" value={formatPeso(summary.verifiedTotal)} tone="success" />
          <Stat label="Remaining Balance" value={formatPeso(summary.balance)} tone={summary.balance > 0 ? "warning" : "success"} />
        </div>

        <div className="mt-5">
          <div className="mb-2 flex items-end justify-between text-sm">
            <p className="font-medium text-maia-ink">
              {formatPeso(summary.verifiedTotal)} / {formatPeso(summary.finalPackageAmount)} PAID
            </p>
            <p className="font-display font-bold text-maia-gold-deep">{summary.percentPaid}%</p>
          </div>
          <ProgressBar percent={summary.percentPaid} />
          {summary.balance > 0 && <p className="mt-2 text-sm text-maia-ink-soft">Remaining: {formatPeso(summary.balance)}</p>}
        </div>
      </Card>

      <Card padded={false}>
        <div className="p-5 pb-0 sm:p-6 sm:pb-0">
          <CardHeader
            title="Payment History"
            subtitle={`${summary.transactions.length} transaction(s) on record`}
            action={
              <Button size="sm" onClick={() => setRecordOpen(true)}>
                <Plus size={14} />
                RECORD PAYMENT
              </Button>
            }
          />
        </div>

        <div className="overflow-x-auto px-5 pb-5 sm:px-6 sm:pb-6">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-maia-border text-left text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">
                <th className="py-2.5 pr-3">Date</th>
                <th className="py-2.5 pr-3">Transaction ID</th>
                <th className="py-2.5 pr-3">Type</th>
                <th className="py-2.5 pr-3">Amount</th>
                <th className="py-2.5 pr-3">Method</th>
                <th className="py-2.5 pr-3">Reference #</th>
                <th className="py-2.5 pr-3">Status</th>
                <th className="py-2.5 pr-3">Proof</th>
                <th className="py-2.5 pr-3">Recorded By</th>
                <th className="py-2.5 pr-3">Verified By</th>
              </tr>
            </thead>
            <tbody>
              {summary.transactions.map((t) => (
                <tr key={t.id} className="border-b border-maia-border/60 last:border-0">
                  <td className="py-3 pr-3 text-maia-ink-soft">{formatDate(t.date)}</td>
                  <td className="py-3 pr-3 font-mono text-xs font-semibold text-maia-ink">{t.id}</td>
                  <td className="py-3 pr-3 text-maia-ink-soft">{t.type}</td>
                  <td className="py-3 pr-3 font-semibold text-maia-ink">{formatPeso(t.amount)}</td>
                  <td className="py-3 pr-3 text-maia-ink-soft">{t.method}</td>
                  <td className="py-3 pr-3 text-maia-ink-soft">{t.referenceNumber || "—"}</td>
                  <td className="py-3 pr-3">
                    <Badge tone={PAYMENT_TXN_STATUS_TONE[t.status]}>{t.status}</Badge>
                  </td>
                  <td className="py-3 pr-3">
                    <button
                      onClick={() => setProofTxn(t)}
                      disabled={!t.proof}
                      className="flex items-center gap-1 text-maia-gold-deep hover:text-maia-ink disabled:cursor-not-allowed disabled:text-maia-ink-soft/40"
                    >
                      <Eye size={13} />
                      {t.proof ? "View" : "None"}
                    </button>
                  </td>
                  <td className="py-3 pr-3 text-maia-ink-soft">{t.recordedBy}</td>
                  <td className="py-3 pr-3 text-maia-ink-soft">{t.verifiedBy ?? "—"}</td>
                </tr>
              ))}
              {summary.transactions.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-sm text-maia-ink-soft">
                    No payments recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <RecordPaymentModal open={recordOpen} onClose={() => setRecordOpen(false)} student={student} />
      <AdjustmentModal open={adjustOpen} onClose={() => setAdjustOpen(false)} student={student} />
      <DocumentPreviewModal
        open={proofTxn !== null}
        onClose={() => setProofTxn(null)}
        title="Proof of Payment"
        file={proofTxn?.proof ?? null}
      />
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-maia-ink">{value}</dd>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "success" | "warning" }) {
  const toneClass = tone === "success" ? "text-maia-success" : tone === "warning" ? "text-maia-warning" : "text-maia-ink";
  return (
    <div className="rounded-xl bg-maia-bg px-4 py-3.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">{label}</p>
      <p className={`mt-1.5 font-display text-xl font-extrabold leading-none ${toneClass}`}>{value}</p>
    </div>
  );
}
