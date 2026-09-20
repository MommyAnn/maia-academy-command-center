import { useState } from "react";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/common/Button";
import { TextField } from "@/components/common/TextField";
import { SelectField } from "@/components/common/SelectField";
import { FileUploadField, validateUploadFile } from "@/components/enrollment/FileUploadField";
import { EXPENSE_CATEGORIES, PAYMENT_METHODS } from "@/data/financeConfig";
import { BATCH_OPTIONS } from "@/data/enrollmentConfig";
import { useFinanceStore, type RecordExpenseInput } from "@/data/financeStore";
import { fileToMeta } from "@/utils/students";
import type { Expense, ExpenseCategory, PaymentMethod } from "@/types/finance";
import type { Batch } from "@/types/student";

function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ExpenseModal({
  open,
  onClose,
  editingExpense,
}: {
  open: boolean;
  onClose: () => void;
  /** When set, the modal edits this expense instead of creating a new one. */
  editingExpense?: Expense | null;
}) {
  const { recordExpense, editExpense } = useFinanceStore();
  const isEdit = Boolean(editingExpense);

  const [date, setDate] = useState(editingExpense?.date ?? todayInputValue());
  const [category, setCategory] = useState<ExpenseCategory | "">(editingExpense?.category ?? "");
  const [description, setDescription] = useState(editingExpense?.description ?? "");
  const [amount, setAmount] = useState(editingExpense ? String(editingExpense.amount) : "");
  const [method, setMethod] = useState<PaymentMethod | "">(editingExpense?.method ?? "");
  const [paidTo, setPaidTo] = useState(editingExpense?.paidTo ?? "");
  const [referenceNumber, setReferenceNumber] = useState(editingExpense?.referenceNumber ?? "");
  const [relatedBatch, setRelatedBatch] = useState<Batch | "">(editingExpense?.relatedBatch ?? "");
  const [relatedEvent, setRelatedEvent] = useState(editingExpense?.relatedEvent ?? "");
  const [notes, setNotes] = useState(editingExpense?.notes ?? "");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function reset() {
    setDate(todayInputValue());
    setCategory("");
    setDescription("");
    setAmount("");
    setMethod("");
    setPaidTo("");
    setReferenceNumber("");
    setRelatedBatch("");
    setRelatedEvent("");
    setNotes("");
    setReceiptFile(null);
    setFileError(null);
    setErrors({});
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleFileSelect(file: File) {
    const err = validateUploadFile(file);
    if (err) {
      setFileError(err);
      return;
    }
    setFileError(null);
    setReceiptFile(file);
  }

  function handleSave() {
    const amountNumber = Number(amount) || 0;
    const next: Record<string, string> = {};
    if (!date) next.date = "Please select a date.";
    if (!category) next.category = "Please select a category.";
    if (!description.trim()) next.description = "Please describe this expense.";
    if (!amountNumber || amountNumber <= 0) next.amount = "Enter an amount greater than ₱0.";
    if (!method) next.method = "Please select a payment method.";
    if (!paidTo.trim()) next.paidTo = "Please enter who this was paid to.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const payload: RecordExpenseInput = {
      date,
      category: category as ExpenseCategory,
      description: description.trim(),
      amount: amountNumber,
      method: method as PaymentMethod,
      paidTo: paidTo.trim(),
      referenceNumber: referenceNumber.trim(),
      receipt: receiptFile ? fileToMeta(receiptFile) : (editingExpense?.receipt ?? null),
      relatedBatch,
      relatedEvent: relatedEvent.trim(),
      notes: notes.trim(),
    };

    if (isEdit && editingExpense) {
      editExpense(editingExpense.id, payload);
    } else {
      recordExpense(payload);
    }

    reset();
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} title={isEdit ? "Edit Expense" : "Add Expense"} size="lg">
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField label="Date" required type="date" value={date} onChange={(e) => setDate(e.target.value)} error={errors.date} />
          <SelectField
            label="Category"
            required
            value={category}
            onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
            placeholder="Select category"
            error={errors.category}
            options={EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c }))}
          />
          <TextField
            label="Description"
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            error={errors.description}
            placeholder="What was this expense for?"
            className="sm:col-span-2"
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
            label="Paid To"
            required
            value={paidTo}
            onChange={(e) => setPaidTo(e.target.value)}
            error={errors.paidTo}
            placeholder="Vendor / supplier / staff name"
          />
          <TextField
            label="Reference Number"
            value={referenceNumber}
            onChange={(e) => setReferenceNumber(e.target.value)}
            placeholder="Invoice / OR number"
          />
          <SelectField
            label="Related Batch (optional)"
            value={relatedBatch}
            onChange={(e) => setRelatedBatch(e.target.value as Batch)}
            options={[{ value: "", label: "None" }, ...BATCH_OPTIONS.map((b) => ({ value: b, label: b }))]}
          />
          <TextField
            label="Related Event (optional)"
            value={relatedEvent}
            onChange={(e) => setRelatedEvent(e.target.value)}
            placeholder="e.g. Batch 13 Kickoff"
          />
        </div>

        <FileUploadField
          label="Receipt / Attachment (optional)"
          file={receiptFile}
          error={fileError}
          onSelect={handleFileSelect}
          onClear={() => setReceiptFile(null)}
        />
        {isEdit && editingExpense?.receipt && !receiptFile && (
          <p className="-mt-2 text-xs text-maia-ink-soft">
            Existing receipt on file: <span className="font-medium text-maia-ink">{editingExpense.receipt.fileName}</span>
          </p>
        )}

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-maia-ink">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Optional internal notes..."
            className="w-full resize-none rounded-lg border border-maia-border bg-maia-surface px-3.5 py-2.5 text-sm text-maia-ink outline-none focus:border-maia-gold focus:ring-2 focus:ring-maia-gold/20"
          />
        </div>

        <div className="flex justify-end gap-2 border-t border-maia-border pt-4">
          <Button variant="secondary" onClick={handleClose}>
            CANCEL
          </Button>
          <Button onClick={handleSave}>{isEdit ? "SAVE CHANGES" : "SAVE EXPENSE"}</Button>
        </div>
      </div>
    </Modal>
  );
}
