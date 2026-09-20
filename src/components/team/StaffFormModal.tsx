import { useState } from "react";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/common/Button";
import { TextField } from "@/components/common/TextField";
import { SelectField } from "@/components/common/SelectField";
import { STAFF_ROLES, type StaffRoleName } from "@/types/staff";
import { BATCH_OPTIONS } from "@/data/enrollmentConfig";
import { useStaffStore } from "@/data/staffStore";
import type { Batch } from "@/types/student";

export function StaffFormModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { createStaff } = useStaffStore();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [role, setRole] = useState<StaffRoleName>("Support Staff");
  const [customRoleLabel, setCustomRoleLabel] = useState("");
  const [assignedBatches, setAssignedBatches] = useState<Batch[]>([]);
  const [notes, setNotes] = useState("");

  function reset() {
    setFullName("");
    setEmail("");
    setContactNumber("");
    setRole("Support Staff");
    setCustomRoleLabel("");
    setAssignedBatches([]);
    setNotes("");
  }

  function handleClose() {
    reset();
    onClose();
  }

  function toggleBatch(batch: Batch) {
    setAssignedBatches((prev) => (prev.includes(batch) ? prev.filter((b) => b !== batch) : [...prev, batch]));
  }

  function handleSubmit() {
    if (!fullName.trim() || !email.trim()) return;
    createStaff({ fullName: fullName.trim(), email: email.trim(), contactNumber: contactNumber.trim(), role, customRoleLabel: customRoleLabel.trim(), assignedBatches, notes: notes.trim() });
    handleClose();
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Add Staff Account"
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={handleClose}>
            CANCEL
          </Button>
          <Button onClick={handleSubmit} disabled={!fullName.trim() || !email.trim()}>
            CREATE ACCOUNT
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="rounded-lg bg-maia-gold-bg px-3.5 py-2.5 text-xs text-maia-gold-deep">
          Demo only: no real password/credential is created or sent. This does not create a real, separately-loggable-in
          account — see the Staff Dashboard preview for how that will look once real authentication exists.
        </p>

        <TextField label="Full Name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
        <TextField label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <TextField label="Contact Number" value={contactNumber} onChange={(e) => setContactNumber(e.target.value)} />

        <SelectField
          label="Role"
          value={role}
          onChange={(e) => setRole(e.target.value as StaffRoleName)}
          options={STAFF_ROLES.map((r) => ({ value: r, label: r }))}
        />

        {role === "Custom Role" && (
          <TextField
            label="Custom Role Label"
            required
            value={customRoleLabel}
            onChange={(e) => setCustomRoleLabel(e.target.value)}
            placeholder="e.g. Front Desk Coordinator"
          />
        )}

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-maia-ink">Assigned Batches</label>
          <div className="flex flex-wrap gap-2">
            {BATCH_OPTIONS.map((batch) => (
              <button
                key={batch}
                type="button"
                onClick={() => toggleBatch(batch)}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                  assignedBatches.includes(batch)
                    ? "border-maia-gold bg-maia-gold-bg text-maia-gold-deep"
                    : "border-maia-border text-maia-ink-soft hover:border-maia-gold"
                }`}
              >
                {batch}
              </button>
            ))}
          </div>
        </div>

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
