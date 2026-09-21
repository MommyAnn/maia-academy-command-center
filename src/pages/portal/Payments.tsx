import { useState } from "react";
import { Eye, UploadCloud } from "lucide-react";
import { Card, CardHeader } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { Modal } from "@/components/common/Modal";
import { ProgressBar } from "@/components/common/ProgressBar";
import { SelectField } from "@/components/common/SelectField";
import { TextField } from "@/components/common/TextField";
import { FileUploadField, validateUploadFile } from "@/components/enrollment/FileUploadField";
import { useStudentPortal } from "@/context/StudentPortalContext";
import { useFinanceStore } from "@/data/financeStore";
import { PAYMENT_METHODS, PAYMENT_TYPES } from "@/data/financeConfig";
import { PAYMENT_STATUS_TONE } from "@/components/students/statusMeta";
import { PAYMENT_TXN_STATUS_TONE } from "@/components/finance/financeStatusMeta";
import { getStudentFinanceSummary } from "@/utils/finance";
import { fileToMeta, formatDate } from "@/utils/students";
import { formatPeso } from "@/utils/format";
import type { PaymentMethod, PaymentType } from "@/types/finance";

export function Payments() {
  const { student } = useStudentPortal();
  const { transactions, adjustments, recordPayment } = useFinanceStore();
  const [submitOpen, setSubmitOpen] = useState(false);

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
        </div>
        {summary.balance > 0 && (
          <Button className="mt-5 w-full sm:w-auto" onClick={() => setSubmitOpen(true)}>
            <UploadCloud size={15} />
            SUBMIT PAYMENT / UPLOAD PROOF
          </Button>
        )}
      </Card>

      <Card padded={false}>
        <div className="p-5 pb-0 sm:p-6 sm:pb-0">
          <CardHeader
            title="Payment History"
            subtitle={`${summary.transactions.length} transaction(s) on record`}
            action={
              summary.balance === 0 ? undefined : (
                <Button size="sm" onClick={() => setSubmitOpen(true)}>
                  <UploadCloud size={14} />
                  SUBMIT PAYMENT
                </Button>
              )
            }
          />
        </div>

        {/* Mobile: cards */}
        <div className="flex flex-col gap-2 p-5 pt-0 sm:hidden">
          {summary.transactions.length === 0 && (
            <p className="py-6 text-center text-sm text-maia-ink-soft">No payments recorded yet.</p>
          )}
          {summary.transactions.map((t) => (
            <div key={t.id} className="rounded-xl border border-maia-border p-3.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-maia-ink">{formatPeso(t.amount)}</p>
                <Badge tone={PAYMENT_TXN_STATUS_TONE[t.status]}>{t.status}</Badge>
              </div>
              <p className="mt-1 text-xs text-maia-ink-soft">
                {formatDate(t.date)} &middot; {t.type} &middot; {t.method}
              </p>
              <p className="mt-0.5 text-xs text-maia-ink-soft">Ref: {t.referenceNumber || "—"}</p>
              {t.status === "Rejected" && t.rejectedReason && (
                <p className="mt-1 text-xs font-medium text-maia-danger">Reason: {t.rejectedReason}</p>
              )}
            </div>
          ))}
        </div>

        {/* Desktop: table — no internal Finance notes, no other students' data */}
        <div className="hidden overflow-x-auto px-5 pb-5 sm:block sm:px-6 sm:pb-6">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-maia-border text-left text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">
                <th className="py-2.5 pr-3">Date</th>
                <th className="py-2.5 pr-3">Type</th>
                <th className="py-2.5 pr-3">Amount</th>
                <th className="py-2.5 pr-3">Method</th>
                <th className="py-2.5 pr-3">Reference #</th>
                <th className="py-2.5 pr-3">Status</th>
                <th className="py-2.5 pr-3">Proof</th>
              </tr>
            </thead>
            <tbody>
              {summary.transactions.map((t) => (
                <tr key={t.id} className="border-b border-maia-border/60 last:border-0">
                  <td className="py-3 pr-3 text-maia-ink-soft">{formatDate(t.date)}</td>
                  <td className="py-3 pr-3 text-maia-ink-soft">{t.type}</td>
                  <td className="py-3 pr-3 font-semibold text-maia-ink">{formatPeso(t.amount)}</td>
                  <td className="py-3 pr-3 text-maia-ink-soft">{t.method}</td>
                  <td className="py-3 pr-3 text-maia-ink-soft">{t.referenceNumber || "—"}</td>
                  <td className="py-3 pr-3">
                    <div className="flex flex-col gap-1">
                      <Badge tone={PAYMENT_TXN_STATUS_TONE[t.status]}>{t.status}</Badge>
                      {t.status === "Rejected" && t.rejectedReason && (
                        <span className="text-xs font-medium text-maia-danger">{t.rejectedReason}</span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 pr-3">
                    {t.proof ? (
                      <span className="flex items-center gap-1 text-maia-gold-deep">
                        <Eye size={13} />
                        {t.proof.fileName}
                      </span>
                    ) : (
                      "None"
                    )}
                  </td>
                </tr>
              ))}
              {summary.transactions.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-sm text-maia-ink-soft">
                    No payments recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <SubmitPaymentModal
        open={submitOpen}
        onClose={() => setSubmitOpen(false)}
        onSubmit={(input) => {
          recordPayment({
            student,
            amount: input.amount,
            type: input.type,
            method: input.method,
            referenceNumber: input.referenceNumber,
            date: input.date,
            proof: input.proof,
            notes: input.notes,
            recordedBy: student.fullName,
          });
          setSubmitOpen(false);
        }}
        maxAmount={summary.balance}
      />
    </div>
  );
}

function SubmitPaymentModal({
  open,
  onClose,
  onSubmit,
  maxAmount,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: {
    amount: number;
    type: PaymentType;
    method: PaymentMethod;
    referenceNumber: string;
    date: string;
    proof: ReturnType<typeof fileToMeta> | null;
    notes: string;
  }) => void;
  maxAmount: number;
}) {
  const [amount, setAmount] = useState(String(maxAmount || ""));
  const [type, setType] = useState<PaymentType>("Partial Payment");
  const [method, setMethod] = useState<PaymentMethod>("GCash");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  const numericAmount = Number(amount);
  const canSubmit = numericAmount > 0 && referenceNumber.trim().length > 0 && date;

  function reset() {
    setAmount(String(maxAmount || ""));
    setType("Partial Payment");
    setMethod("GCash");
    setReferenceNumber("");
    setDate(new Date().toISOString().slice(0, 10));
    setFile(null);
    setFileError(null);
    setNotes("");
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleSubmit() {
    if (!canSubmit) return;
    onSubmit({
      amount: numericAmount,
      type,
      method,
      referenceNumber: referenceNumber.trim(),
      date,
      proof: file ? fileToMeta(file) : null,
      notes: notes.trim(),
    });
    reset();
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Submit Payment / Upload Proof"
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={handleClose}>
            CANCEL
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            SUBMIT FOR VERIFICATION
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="rounded-lg bg-maia-gold-bg px-3.5 py-2.5 text-xs text-maia-ink">
          This submission will be sent to the Academy as <strong>Pending Verification</strong>. It will not be
          marked as paid until Finance verifies it.
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            label="Amount (₱)"
            type="number"
            min={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
          <TextField label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          <SelectField
            label="Payment Type"
            value={type}
            onChange={(e) => setType(e.target.value as PaymentType)}
            options={PAYMENT_TYPES.map((t) => ({ value: t, label: t }))}
          />
          <SelectField
            label="Payment Method"
            value={method}
            onChange={(e) => setMethod(e.target.value as PaymentMethod)}
            options={PAYMENT_METHODS.map((m) => ({ value: m, label: m }))}
          />
          <div className="sm:col-span-2">
            <TextField
              label="Reference Number"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              required
            />
          </div>
        </div>

        <FileUploadField
          label="Proof of Payment"
          file={file}
          error={fileError}
          onSelect={(f) => {
            const err = validateUploadFile(f);
            if (err) {
              setFileError(err);
              return;
            }
            setFileError(null);
            setFile(f);
          }}
          onClear={() => {
            setFile(null);
            setFileError(null);
          }}
        />

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-maia-ink">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full resize-none rounded-lg border border-maia-border bg-maia-surface px-3.5 py-2.5 text-sm text-maia-ink outline-none focus:border-maia-gold focus:ring-2 focus:ring-maia-gold/20"
          />
        </div>
      </div>
    </Modal>
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
