import { useState } from "react";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/common/Button";
import { TextField } from "@/components/common/TextField";
import { SelectField } from "@/components/common/SelectField";
import { BATCH_OPTIONS } from "@/data/enrollmentConfig";
import { useInventoryStore } from "@/data/inventoryStore";
import type { Batch } from "@/types/student";

export function StockInModal({
  open,
  onClose,
  defaultItemId,
}: {
  open: boolean;
  onClose: () => void;
  defaultItemId?: string;
}) {
  const { items, suppliers, recordStockIn } = useInventoryStore();

  const [itemId, setItemId] = useState(defaultItemId ?? items[0]?.id ?? "");
  const [quantity, setQuantity] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [referenceNumber, setReferenceNumber] = useState("");
  const [relatedBatch, setRelatedBatch] = useState<Batch | "">("");
  const [notes, setNotes] = useState("");

  function reset() {
    setItemId(defaultItemId ?? items[0]?.id ?? "");
    setQuantity("");
    setUnitCost("");
    setSupplierId("");
    setDate(new Date().toISOString().slice(0, 10));
    setReferenceNumber("");
    setRelatedBatch("");
    setNotes("");
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleSubmit() {
    const qty = Number(quantity);
    if (!itemId || !qty || qty <= 0) return;
    recordStockIn({
      itemId,
      quantity: qty,
      unitCost: Number(unitCost) || 0,
      supplierId: supplierId || null,
      date,
      referenceNumber: referenceNumber.trim(),
      relatedBatch: relatedBatch || null,
      receipt: null,
      notes: notes.trim(),
    });
    handleClose();
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Stock In"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={handleClose}>
            CANCEL
          </Button>
          <Button onClick={handleSubmit} disabled={!itemId || !Number(quantity)}>
            RECORD STOCK IN
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <SelectField
          label="Item"
          required
          value={itemId}
          onChange={(e) => setItemId(e.target.value)}
          options={items.map((i) => ({ value: i.id, label: `${i.name} (${i.itemId})` }))}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField label="Quantity" type="number" min={1} required value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          <TextField label="Unit Cost (₱)" type="number" min={0} value={unitCost} onChange={(e) => setUnitCost(e.target.value)} />
        </div>
        <SelectField
          label="Supplier"
          value={supplierId}
          onChange={(e) => setSupplierId(e.target.value)}
          options={[{ value: "", label: "No supplier" }, ...suppliers.map((s) => ({ value: s.id, label: s.name }))]}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField label="Date Received" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          <TextField label="Reference Number" value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} />
        </div>
        <SelectField
          label="Related Batch (optional)"
          value={relatedBatch}
          onChange={(e) => setRelatedBatch(e.target.value as Batch | "")}
          options={[{ value: "", label: "None" }, ...BATCH_OPTIONS.map((b) => ({ value: b, label: b }))]}
        />
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-maia-ink">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full resize-none rounded-lg border border-maia-border bg-maia-surface px-3.5 py-2.5 text-sm text-maia-ink outline-none focus:border-maia-gold focus:ring-2 focus:ring-maia-gold/20"
          />
        </div>
        <p className="text-xs text-maia-ink-soft/80">
          Receipt upload isn&rsquo;t wired up yet — no real, secure file storage backend exists.
        </p>
      </div>
    </Modal>
  );
}
