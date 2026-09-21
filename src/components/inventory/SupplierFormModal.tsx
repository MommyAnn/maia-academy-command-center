import { useState } from "react";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/common/Button";
import { TextField } from "@/components/common/TextField";
import { useInventoryStore } from "@/data/inventoryStore";
import type { Supplier } from "@/types/inventory";

export function SupplierFormModal({
  open,
  onClose,
  editingSupplier,
}: {
  open: boolean;
  onClose: () => void;
  editingSupplier?: Supplier | null;
}) {
  const { createSupplier, updateSupplier } = useInventoryStore();
  const isEdit = Boolean(editingSupplier);

  const [name, setName] = useState(editingSupplier?.name ?? "");
  const [contactPerson, setContactPerson] = useState(editingSupplier?.contactPerson ?? "");
  const [contactNumber, setContactNumber] = useState(editingSupplier?.contactNumber ?? "");
  const [email, setEmail] = useState(editingSupplier?.email ?? "");
  const [address, setAddress] = useState(editingSupplier?.address ?? "");
  const [notes, setNotes] = useState(editingSupplier?.notes ?? "");

  function reset() {
    setName("");
    setContactPerson("");
    setContactNumber("");
    setEmail("");
    setAddress("");
    setNotes("");
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleSubmit() {
    if (!name.trim()) return;
    const input = {
      name: name.trim(),
      contactPerson: contactPerson.trim(),
      contactNumber: contactNumber.trim(),
      email: email.trim(),
      address: address.trim(),
      notes: notes.trim(),
    };
    if (isEdit && editingSupplier) {
      updateSupplier(editingSupplier.id, input);
    } else {
      createSupplier(input);
    }
    handleClose();
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={isEdit ? "Edit Supplier" : "Add Supplier"}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={handleClose}>
            CANCEL
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim()}>
            {isEdit ? "SAVE CHANGES" : "ADD SUPPLIER"}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <TextField label="Supplier Name" required value={name} onChange={(e) => setName(e.target.value)} />
        <TextField label="Contact Person" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField label="Contact Number" value={contactNumber} onChange={(e) => setContactNumber(e.target.value)} />
          <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <TextField label="Address" value={address} onChange={(e) => setAddress(e.target.value)} />
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
