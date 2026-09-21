import { useMemo, useState } from "react";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/common/Button";
import { TextField } from "@/components/common/TextField";
import { SelectField } from "@/components/common/SelectField";
import { BATCH_OPTIONS } from "@/data/enrollmentConfig";
import { useInventoryStore } from "@/data/inventoryStore";
import { STOCK_OUT_REASONS, type StockOutReason } from "@/types/inventory";
import { getCurrentStock } from "@/utils/inventory";
import type { Batch } from "@/types/student";

export function StockOutModal({
  open,
  onClose,
  defaultItemId,
}: {
  open: boolean;
  onClose: () => void;
  defaultItemId?: string;
}) {
  const { items, transactions, recordStockOut } = useInventoryStore();

  const [itemId, setItemId] = useState(defaultItemId ?? items[0]?.id ?? "");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState<StockOutReason>("Student Distribution");
  const [relatedBatch, setRelatedBatch] = useState<Batch | "">("");
  const [releasedTo, setReleasedTo] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  const availableStock = useMemo(() => (itemId ? getCurrentStock(itemId, transactions) : 0), [itemId, transactions]);

  function reset() {
    setItemId(defaultItemId ?? items[0]?.id ?? "");
    setQuantity("");
    setReason("Student Distribution");
    setRelatedBatch("");
    setReleasedTo("");
    setDate(new Date().toISOString().slice(0, 10));
    setNotes("");
    setError("");
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleSubmit() {
    const qty = Number(quantity);
    if (!itemId || !qty || qty <= 0) return;
    const result = recordStockOut({
      itemId,
      quantity: qty,
      reason,
      relatedBatch: relatedBatch || null,
      relatedSessionId: null,
      releasedTo: releasedTo.trim(),
      date,
      notes: notes.trim(),
    });
    if (!result) {
      setError(`Only ${availableStock} in stock — this would take stock negative. Use reason "Adjustment" to authorize a correction.`);
      return;
    }
    handleClose();
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Stock Out"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={handleClose}>
            CANCEL
          </Button>
          <Button onClick={handleSubmit} disabled={!itemId || !Number(quantity)}>
            RECORD STOCK OUT
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <SelectField
          label="Item"
          required
          value={itemId}
          onChange={(e) => {
            setItemId(e.target.value);
            setError("");
          }}
          options={items.map((i) => ({ value: i.id, label: `${i.name} (${i.itemId})` }))}
        />
        <p className="text-xs text-maia-ink-soft">
          Currently available: <span className="font-semibold text-maia-ink">{availableStock}</span>
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            label="Quantity"
            type="number"
            min={1}
            required
            value={quantity}
            onChange={(e) => {
              setQuantity(e.target.value);
              setError("");
            }}
          />
          <SelectField
            label="Reason"
            value={reason}
            onChange={(e) => {
              setReason(e.target.value as StockOutReason);
              setError("");
            }}
            options={STOCK_OUT_REASONS.map((r) => ({ value: r, label: r }))}
          />
        </div>
        {error && <p className="rounded-lg bg-maia-danger-bg px-3.5 py-2.5 text-xs font-medium text-maia-danger">{error}</p>}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField
            label="Related Batch (optional)"
            value={relatedBatch}
            onChange={(e) => setRelatedBatch(e.target.value as Batch | "")}
            options={[{ value: "", label: "None" }, ...BATCH_OPTIONS.map((b) => ({ value: b, label: b }))]}
          />
          <TextField label="Date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <TextField label="Released To (optional)" value={releasedTo} onChange={(e) => setReleasedTo(e.target.value)} />
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-maia-ink">Notes</label>
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
