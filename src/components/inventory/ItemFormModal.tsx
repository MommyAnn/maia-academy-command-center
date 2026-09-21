import { useState } from "react";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/common/Button";
import { TextField } from "@/components/common/TextField";
import { SelectField } from "@/components/common/SelectField";
import { INVENTORY_CATEGORIES, type InventoryCategory, type InventoryItem } from "@/types/inventory";
import { COMMON_UNITS } from "@/data/inventoryConfig";
import { useInventoryStore, type CreateItemInput } from "@/data/inventoryStore";

export function ItemFormModal({
  open,
  onClose,
  editingItem,
}: {
  open: boolean;
  onClose: () => void;
  editingItem?: InventoryItem | null;
}) {
  const { suppliers, createItem, updateItem } = useInventoryStore();
  const isEdit = Boolean(editingItem);

  const [name, setName] = useState(editingItem?.name ?? "");
  const [sku, setSku] = useState(editingItem?.sku ?? "");
  const [category, setCategory] = useState<InventoryCategory>(editingItem?.category ?? "Other");
  const [supplierId, setSupplierId] = useState(editingItem?.supplierId ?? "");
  const [unit, setUnit] = useState(editingItem?.unit ?? COMMON_UNITS[0]);
  const [reorderLevel, setReorderLevel] = useState(String(editingItem?.reorderLevel ?? 10));
  const [unitCost, setUnitCost] = useState(String(editingItem?.unitCost ?? 0));
  const [location, setLocation] = useState(editingItem?.location ?? "");
  const [notes, setNotes] = useState(editingItem?.notes ?? "");

  function reset() {
    setName("");
    setSku("");
    setCategory("Other");
    setSupplierId("");
    setUnit(COMMON_UNITS[0]);
    setReorderLevel("10");
    setUnitCost("0");
    setLocation("");
    setNotes("");
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleSubmit() {
    if (!name.trim()) return;
    const input: CreateItemInput = {
      name: name.trim(),
      sku: sku.trim(),
      category,
      supplierId: supplierId || null,
      unit,
      reorderLevel: Number(reorderLevel) || 0,
      unitCost: Number(unitCost) || 0,
      location: location.trim(),
      notes: notes.trim(),
    };
    if (isEdit && editingItem) {
      updateItem(editingItem.id, input);
    } else {
      createItem(input);
    }
    handleClose();
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={isEdit ? "Edit Inventory Item" : "Add Inventory Item"}
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={handleClose}>
            CANCEL
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim()}>
            {isEdit ? "SAVE CHANGES" : "ADD ITEM"}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <TextField label="Item Name" required value={name} onChange={(e) => setName(e.target.value)} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField label="SKU" value={sku} onChange={(e) => setSku(e.target.value)} />
          <SelectField
            label="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value as InventoryCategory)}
            options={INVENTORY_CATEGORIES.map((c) => ({ value: c, label: c }))}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField
            label="Supplier"
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            options={[{ value: "", label: "No supplier" }, ...suppliers.map((s) => ({ value: s.id, label: s.name }))]}
          />
          <SelectField
            label="Unit"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            options={COMMON_UNITS.map((u) => ({ value: u, label: u }))}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            label="Reorder Level"
            type="number"
            min={0}
            value={reorderLevel}
            onChange={(e) => setReorderLevel(e.target.value)}
          />
          <TextField label="Unit Cost (₱)" type="number" min={0} value={unitCost} onChange={(e) => setUnitCost(e.target.value)} />
        </div>
        <TextField label="Storage Location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Main Storage Room A" />
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
