import { useState } from "react";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/common/Button";
import { TextField } from "@/components/common/TextField";
import { SelectField } from "@/components/common/SelectField";
import { BATCH_OPTIONS } from "@/data/enrollmentConfig";
import { useStaffStore } from "@/data/staffStore";
import { useInventoryStore } from "@/data/inventoryStore";
import { useTrainingStore, type CreateSessionInput } from "@/data/trainingStore";
import { TRAINING_TYPES, isOnlineTrainingType, type TrainingType } from "@/types/training";
import type { Batch } from "@/types/student";
import type { SessionMaterialLine } from "@/types/training";
import { useNavigate } from "react-router-dom";

export function SessionFormModal({ open, onClose, defaultBatch }: { open: boolean; onClose: () => void; defaultBatch?: Batch }) {
  const { staff } = useStaffStore();
  const { items } = useInventoryStore();
  const { createSession } = useTrainingStore();
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [type, setType] = useState<TrainingType>("Face-to-Face");
  const [batch, setBatch] = useState<Batch>(defaultBatch ?? BATCH_OPTIONS[0]);
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("12:00");
  const [venueName, setVenueName] = useState("");
  const [venueAddress, setVenueAddress] = useState("");
  const [capacity, setCapacity] = useState("");
  const [platform, setPlatform] = useState("Zoom");
  const [zoomLink, setZoomLink] = useState("");
  const [meetingId, setMeetingId] = useState("");
  const [passcode, setPasscode] = useState("");
  const [trainer, setTrainer] = useState("");
  const [assignedStaffIds, setAssignedStaffIds] = useState<string[]>([]);
  const [materials, setMaterials] = useState<SessionMaterialLine[]>([]);
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");

  const isOnline = isOnlineTrainingType(type);

  function reset() {
    setTitle("");
    setType("Face-to-Face");
    setBatch(defaultBatch ?? BATCH_OPTIONS[0]);
    setDate("");
    setStartTime("09:00");
    setEndTime("12:00");
    setVenueName("");
    setVenueAddress("");
    setCapacity("");
    setPlatform("Zoom");
    setZoomLink("");
    setMeetingId("");
    setPasscode("");
    setTrainer("");
    setAssignedStaffIds([]);
    setMaterials([]);
    setDescription("");
    setNotes("");
  }

  function handleClose() {
    reset();
    onClose();
  }

  function toggleStaff(id: string) {
    setAssignedStaffIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function addMaterialLine() {
    if (items.length === 0) return;
    setMaterials((prev) => [...prev, { itemId: items[0].id, quantity: 1 }]);
  }

  function updateMaterialLine(index: number, patch: Partial<SessionMaterialLine>) {
    setMaterials((prev) => prev.map((m, i) => (i === index ? { ...m, ...patch } : m)));
  }

  function removeMaterialLine(index: number) {
    setMaterials((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSubmit() {
    if (!title.trim() || !date) return;
    const input: CreateSessionInput = {
      title: title.trim(),
      type,
      batch,
      date,
      startTime,
      endTime,
      venueName: venueName.trim(),
      venueAddress: venueAddress.trim(),
      capacity: capacity ? Number(capacity) : null,
      platform: platform.trim(),
      zoomLink: zoomLink.trim(),
      meetingId: meetingId.trim(),
      passcode: passcode.trim(),
      trainer: trainer.trim(),
      assignedStaffIds,
      materials,
      description: description.trim(),
      notes: notes.trim(),
    };
    const created = createSession(input);
    handleClose();
    navigate(`/training/sessions/${created.id}`);
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="New Training Session"
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={handleClose}>
            CANCEL
          </Button>
          <Button onClick={handleSubmit} disabled={!title.trim() || !date}>
            CREATE SESSION
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <TextField label="Session Title" required value={title} onChange={(e) => setTitle(e.target.value)} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField
            label="Training Type"
            value={type}
            onChange={(e) => setType(e.target.value as TrainingType)}
            options={TRAINING_TYPES.map((t) => ({ value: t, label: t }))}
          />
          <SelectField
            label="Batch"
            value={batch}
            onChange={(e) => setBatch(e.target.value as Batch)}
            options={BATCH_OPTIONS.map((b) => ({ value: b, label: b }))}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <TextField label="Date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          <TextField label="Start Time" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          <TextField label="End Time" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </div>

        {isOnline ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField label="Platform" value={platform} onChange={(e) => setPlatform(e.target.value)} />
            <TextField label="Meeting ID" value={meetingId} onChange={(e) => setMeetingId(e.target.value)} />
            <TextField label="Zoom Link" value={zoomLink} onChange={(e) => setZoomLink(e.target.value)} />
            <TextField label="Passcode" value={passcode} onChange={(e) => setPasscode(e.target.value)} />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField label="Venue Name" value={venueName} onChange={(e) => setVenueName(e.target.value)} />
            <TextField label="Capacity (optional)" type="number" min={0} value={capacity} onChange={(e) => setCapacity(e.target.value)} />
            <div className="sm:col-span-2">
              <TextField label="Venue Address" value={venueAddress} onChange={(e) => setVenueAddress(e.target.value)} />
            </div>
          </div>
        )}

        <TextField label="Trainer / Coach" value={trainer} onChange={(e) => setTrainer(e.target.value)} />

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-maia-ink">Assigned Staff</label>
          <div className="flex flex-wrap gap-2">
            {staff.filter((s) => s.accountStatus === "Active").map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => toggleStaff(s.id)}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                  assignedStaffIds.includes(s.id)
                    ? "border-maia-gold bg-maia-gold-bg text-maia-gold-deep"
                    : "border-maia-border text-maia-ink-soft hover:border-maia-gold"
                }`}
              >
                {s.fullName}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="block text-sm font-semibold text-maia-ink">Materials Needed (optional)</label>
            <Button size="sm" variant="secondary" onClick={addMaterialLine} type="button">
              + ADD MATERIAL
            </Button>
          </div>
          {materials.length === 0 ? (
            <p className="text-xs text-maia-ink-soft">No materials linked yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {materials.map((line, index) => (
                <div key={index} className="flex items-center gap-2">
                  <select
                    value={line.itemId}
                    onChange={(e) => updateMaterialLine(index, { itemId: e.target.value })}
                    className="flex-1 rounded-lg border border-maia-border bg-maia-surface px-3 py-2 text-sm text-maia-ink outline-none focus:border-maia-gold"
                  >
                    {items.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    value={line.quantity}
                    onChange={(e) => updateMaterialLine(index, { quantity: Number(e.target.value) || 1 })}
                    className="w-24 rounded-lg border border-maia-border bg-maia-surface px-3 py-2 text-sm text-maia-ink outline-none focus:border-maia-gold"
                  />
                  <button type="button" onClick={() => removeMaterialLine(index)} className="text-xs font-semibold text-maia-danger">
                    REMOVE
                  </button>
                </div>
              ))}
            </div>
          )}
          <p className="mt-1.5 text-xs text-maia-ink-soft/80">Planning only — this never deducts stock automatically.</p>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-maia-ink">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full resize-none rounded-lg border border-maia-border bg-maia-surface px-3.5 py-2.5 text-sm text-maia-ink outline-none focus:border-maia-gold focus:ring-2 focus:ring-maia-gold/20"
          />
        </div>

        {isOnline && (
          <p className="rounded-lg bg-maia-warning-bg px-3.5 py-2.5 text-xs text-maia-warning">
            Meeting link/ID/passcode should only be visible to authorized staff and eligible students once the Student
            Portal exists — this demo does not yet enforce that visibility rule.
          </p>
        )}
      </div>
    </Modal>
  );
}
