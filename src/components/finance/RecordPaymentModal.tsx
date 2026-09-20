import { useMemo, useState } from "react";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/common/Button";
import { TextField } from "@/components/common/TextField";
import { SelectField } from "@/components/common/SelectField";
import { FileUploadField, validateUploadFile } from "@/components/enrollment/FileUploadField";
import { PAYMENT_METHODS, PAYMENT_TYPES, CURRENT_DEMO_USER } from "@/data/financeConfig";
import { useStudentStore } from "@/data/studentStore";
import { useFinanceStore } from "@/data/financeStore";
import { getStudentFinanceSummary } from "@/utils/finance";
import { formatPeso } from "@/utils/format";
import { fileToMeta } from "@/utils/students";
import type { StudentRecord } from "@/types/student";
import type { PaymentMethod, PaymentTransaction, PaymentType } from "@/types/finance";

function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

export function RecordPaymentModal({
  open,
  onClose,
  student: forcedStudent,
  onRecorded,
}: {
  open: boolean;
  onClose: () => void;
  /** When provided (e.g. opened from a Student Profile), the student cannot be changed. */
  student?: StudentRecord;
  onRecorded?: (txn: PaymentTransaction) => void;
}) {
  const { students } = useStudentStore();
  const { transactions, adjustments, recordPayment } = useFinanceStore();

  const [selectedStudentId, setSelectedStudentId] = useState(forcedStudent?.id ?? "");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<PaymentType | "">("");
  const [method, setMethod] = useState<PaymentMethod | "">("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [date, setDate] = useState(todayInputValue());
  const [notes, setNotes] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [overpayAcknowledged, setOverpayAcknowledged] = useState(false);

  const student = forcedStudent ?? students.find((s) => s.id === selectedStudentId);
  const summary = student ? getStudentFinanceSummary(student, transactions, adjustments) : null;
  const amountNumber = Number(amount) || 0;
  const newBalance = summary ? Math.max(0, summary.balance - amountNumber) : 0;
  const wouldOverpay = summary ? amountNumber > summary.balance && summary.balance >= 0 : false;

  const sortedStudents = useMemo(() => [...students].sort((a, b) => a.studentId.localeCompare(b.studentId)), [students]);

  function resetAndClose() {
    setSelectedStudentId(forcedStudent?.id ?? "");
    setAmount("");
    setType("");
    setMethod("");
    setReferenceNumber("");
    setDate(todayInputValue());
    setNotes("");
    setProofFile(null);
    setFileError(null);
    setErrors({});
    setOverpayAcknowledged(false);
    onClose();
  }

  function handleFileSelect(file: File) {
    const err = validateUploadFile(file);
    if (err) {
      setFileError(err);
      return;
    }
    setFileError(null);
    setProofFile(file);
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!student) next.student = "Please select a student.";
    if (!amountNumber || amountNumber <= 0) next.amount = "Enter a payment amount greater than ₱0.";
    if (!type) next.type = "Please select a payment type.";
    if (!method) next.method = "Please select a payment method.";
    if (method !== "Cash" && !referenceNumber.trim()) next.referenceNumber = "Reference number is required for this payment method.";
    if (!date) next.date = "Please select a payment date.";
    if (wouldOverpay && !overpayAcknowledged) next.overpay = "Confirm this intentional overpayment before saving.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSave() {
    if (!student || !validate()) return;

    const created = recordPayment({
      student,
      amount: amountNumber,
      type: type as PaymentType,
      method: method as PaymentMethod,
      referenceNumber: referenceNumber.trim(),
      date,
      proof: proofFile ? fileToMeta(proofFile) : null,
      notes: notes.trim(),
    });

    onRecorded?.(created);
    resetAndClose();
  }

  return (
    <Modal open={open} onClose={resetAndClose} title="Record Payment" size="lg">
      <div className="flex flex-col gap-5">
        {!forcedStudent && (
          <SelectField
            label="Student"
            required
            value={selectedStudentId}
            onChange={(e) => setSelectedStudentId(e.target.value)}
            placeholder="Search / select a student"
            error={errors.student}
            options={sortedStudents.map((s) => ({
              value: s.id,
              label: `${s.studentId} — ${s.fullName} (${s.batch})`,
            }))}
          />
        )}

        {student && summary && (
          <>
            <div className="grid grid-cols-2 gap-3 rounded-xl bg-maia-bg px-4 py-3.5 sm:grid-cols-4">
              <ReadOnlyStat label="Student ID" value={student.studentId} />
              <ReadOnlyStat label="Batch" value={student.batch} />
              <ReadOnlyStat label="Package" value={student.package} />
              <ReadOnlyStat label="Package Price" value={formatPeso(summary.finalPackageAmount)} />
              <ReadOnlyStat label="Current Total Paid" value={formatPeso(summary.verifiedTotal)} />
              <ReadOnlyStat label="Current Balance" value={formatPeso(summary.balance)} />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField
                label="Payment Amount"
                required
                type="number"
                min={0}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                error={errors.amount}
                placeholder="0.00"
              />
              <TextField
                label="Payment Date"
                required
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                error={errors.date}
              />
              <SelectField
                label="Payment Type"
                required
                value={type}
                onChange={(e) => setType(e.target.value as PaymentType)}
                placeholder="Select type"
                error={errors.type}
                options={PAYMENT_TYPES.map((t) => ({ value: t, label: t }))}
              />
              <SelectField
                label="Payment Method"
                required
                value={method}
                onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                placeholder="Select method"
                error={errors.method}
                options={PAYMENT_METHODS.map((m) => ({ value: m, label: m }))}
              />
              <TextField
                label="Reference Number"
                required={method !== "Cash"}
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                error={errors.referenceNumber}
                placeholder="e.g. GC-88291"
                className="sm:col-span-2"
              />
            </div>

            {amountNumber > 0 && (
              <div className="flex flex-col gap-1 rounded-xl border border-maia-gold/30 bg-maia-gold-bg px-4 py-3.5 text-sm sm:flex-row sm:items-center sm:justify-center sm:gap-4">
                <span className="text-maia-ink-soft">
                  Previous Balance <b className="text-maia-ink">{formatPeso(summary.balance)}</b>
                </span>
                <ArrowRight size={14} className="hidden text-maia-gold-deep sm:block" />
                <span className="text-maia-ink-soft">
                  Payment <b className="text-maia-ink">{formatPeso(amountNumber)}</b>
                </span>
                <ArrowRight size={14} className="hidden text-maia-gold-deep sm:block" />
                <span className="text-maia-ink-soft">
                  New Balance{" "}
                  <b className={wouldOverpay ? "text-maia-danger" : "text-maia-ink"}>{formatPeso(newBalance)}</b>
                </span>
              </div>
            )}

            {wouldOverpay && (
              <div className="rounded-xl bg-maia-danger-bg px-4 py-3.5 text-sm text-maia-danger">
                <p className="flex items-start gap-2 font-medium">
                  <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                  This payment is more than the current balance and would overpay the student. As
                  Owner/Administrator you may proceed intentionally (e.g. covering an add-on fee), otherwise
                  reduce the amount.
                </p>
                <label className="mt-2 flex items-center gap-2 pl-6 text-xs font-medium">
                  <input
                    type="checkbox"
                    checked={overpayAcknowledged}
                    onChange={(e) => setOverpayAcknowledged(e.target.checked)}
                    className="h-4 w-4 accent-maia-danger"
                  />
                  Yes, I intend to record this overpayment.
                </label>
                {errors.overpay && <p className="mt-1 pl-6 text-xs">{errors.overpay}</p>}
              </div>
            )}

            <FileUploadField
              label="Proof of Payment (optional)"
              file={proofFile}
              error={fileError}
              onSelect={handleFileSelect}
              onClear={() => setProofFile(null)}
            />

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-maia-ink">Internal Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Optional notes for the Finance team..."
                className="w-full resize-none rounded-lg border border-maia-border bg-maia-surface px-3.5 py-2.5 text-sm text-maia-ink outline-none focus:border-maia-gold focus:ring-2 focus:ring-maia-gold/20"
              />
            </div>

            <p className="text-xs text-maia-ink-soft">
              Recorded By: <span className="font-medium text-maia-ink">{CURRENT_DEMO_USER}</span> &middot; this
              payment will start as <span className="font-medium text-maia-warning">Pending Verification</span>{" "}
              until a Finance/Admin user verifies it.
            </p>
          </>
        )}

        <div className="flex justify-end gap-2 border-t border-maia-border pt-4">
          <Button variant="secondary" onClick={resetAndClose}>
            CANCEL
          </Button>
          <Button onClick={handleSave} disabled={!student}>
            SAVE PAYMENT
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function ReadOnlyStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-maia-ink-soft">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-maia-ink">{value}</p>
    </div>
  );
}
