import { useState } from "react";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/common/Button";
import { TextField } from "@/components/common/TextField";
import { SelectField } from "@/components/common/SelectField";
import { ADJUSTMENT_TYPES } from "@/data/financeConfig";
import { useFinanceStore } from "@/data/financeStore";
import { getFinalPackageAmount } from "@/utils/finance";
import { formatPeso } from "@/utils/format";
import type { StudentRecord } from "@/types/student";
import type { AdjustmentType } from "@/types/finance";

export function AdjustmentModal({
  open,
  onClose,
  student,
}: {
  open: boolean;
  onClose: () => void;
  student: StudentRecord;
}) {
  const { adjustments, applyAdjustment } = useFinanceStore();
  const [type, setType] = useState<AdjustmentType | "">("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const currentFinal = getFinalPackageAmount(student, adjustments);
  const amountNumber = Number(amount) || 0;
  const previewFinal = Math.max(0, currentFinal - amountNumber);

  function reset() {
    setType("");
    setAmount("");
    setReason("");
    setErrors({});
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleSave() {
    const next: Record<string, string> = {};
    if (!type) next.type = "Please select an adjustment type.";
    if (!amountNumber || amountNumber <= 0) next.amount = "Enter an amount greater than ₱0.";
    if (amountNumber > currentFinal) next.amount = "Adjustment cannot exceed the current package amount.";
    if (!reason.trim()) next.reason = "A reason is required for every adjustment.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    applyAdjustment(student, { type: type as AdjustmentType, amount: amountNumber, reason: reason.trim() });
    reset();
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} title="Apply Discount / Adjustment">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-maia-ink-soft">
          This never overwrites {student.fullName}&rsquo;s original package price of{" "}
          <b className="text-maia-ink">{formatPeso(student.payment.packagePrice)}</b> — it records a
          transparent, auditable reduction instead.
        </p>

        <SelectField
          label="Adjustment Type"
          required
          value={type}
          onChange={(e) => setType(e.target.value as AdjustmentType)}
          placeholder="Select type"
          error={errors.type}
          options={ADJUSTMENT_TYPES.map((t) => ({ value: t, label: t }))}
        />

        <TextField
          label="Amount"
          required
          type="number"
          min={0}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          error={errors.amount}
          placeholder="0.00"
        />

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-maia-ink">
            Reason<span className="ml-0.5 text-maia-danger">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="e.g. Early-bird referral discount"
            className="w-full resize-none rounded-lg border border-maia-border bg-maia-surface px-3.5 py-2.5 text-sm text-maia-ink outline-none focus:border-maia-gold focus:ring-2 focus:ring-maia-gold/20"
          />
          {errors.reason && <p className="mt-1 text-xs font-medium text-maia-danger">{errors.reason}</p>}
        </div>

        {amountNumber > 0 && (
          <div className="flex items-center justify-center gap-3 rounded-xl border border-maia-gold/30 bg-maia-gold-bg px-4 py-3.5 text-sm">
            <span className="text-maia-ink-soft">
              Current <b className="text-maia-ink">{formatPeso(currentFinal)}</b>
            </span>
            <span className="text-maia-gold-deep">&rarr;</span>
            <span className="text-maia-ink-soft">
              Final Package Amount <b className="text-maia-ink">{formatPeso(previewFinal)}</b>
            </span>
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-maia-border pt-4">
          <Button variant="secondary" onClick={handleClose}>
            CANCEL
          </Button>
          <Button onClick={handleSave}>APPLY ADJUSTMENT</Button>
        </div>
      </div>
    </Modal>
  );
}
