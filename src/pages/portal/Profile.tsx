import { useState } from "react";
import { Edit3 } from "lucide-react";
import { Card, CardHeader } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { Modal } from "@/components/common/Modal";
import { TextField } from "@/components/common/TextField";
import { useStudentPortal } from "@/context/StudentPortalContext";
import { usePortalStore } from "@/data/portalStore";
import { UPDATE_REQUEST_STATUS_TONE } from "@/components/portal/statusMeta";

const EDITABLE_FIELDS = ["Facebook Name", "Email", "Contact Number", "City"] as const;
const VERIFIED_FIELDS = ["Real Full Name"] as const;
type ProfileField = (typeof EDITABLE_FIELDS)[number] | (typeof VERIFIED_FIELDS)[number];

function currentValue(field: ProfileField, student: ReturnType<typeof useStudentPortal>["student"]): string {
  switch (field) {
    case "Facebook Name":
      return student.facebookName;
    case "Email":
      return student.email;
    case "Contact Number":
      return student.contactNumber;
    case "City":
      return student.city;
    case "Real Full Name":
      return student.fullName;
    default:
      return "";
  }
}

export function Profile() {
  const { student } = useStudentPortal();
  const { updateRequests, createUpdateRequest } = usePortalStore();
  const [modalField, setModalField] = useState<ProfileField | null>(null);
  const [newValue, setNewValue] = useState("");
  const [reason, setReason] = useState("");

  const allFields = [...EDITABLE_FIELDS, ...VERIFIED_FIELDS];
  const myRequests = updateRequests
    .filter((r) => r.studentId === student.id && (allFields as string[]).includes(r.field))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  function openModal(field: ProfileField) {
    setModalField(field);
    setNewValue(currentValue(field, student));
    setReason("");
  }

  function handleSubmit() {
    if (!modalField || !newValue.trim() || !reason.trim()) return;
    createUpdateRequest({
      studentId: student.id,
      field: modalField,
      oldValue: currentValue(modalField, student),
      newValue: newValue.trim(),
      reason: reason.trim(),
    });
    setModalField(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader
          title="Profile Information"
          subtitle="Changes here are reviewed by the Academy before they're applied."
        />
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {EDITABLE_FIELDS.map((field) => (
            <Field key={field} label={field} value={currentValue(field, student)} onRequestUpdate={() => openModal(field)} />
          ))}
        </dl>
      </Card>

      <Card>
        <CardHeader title="Verified Information" subtitle="These fields are verified by the Academy and require review to change." />
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {VERIFIED_FIELDS.map((field) => (
            <Field key={field} label={field} value={currentValue(field, student)} onRequestUpdate={() => openModal(field)} />
          ))}
          <Field label="Student ID" value={student.studentId} />
          <Field label="Batch" value={student.batch} />
        </dl>
      </Card>

      {myRequests.length > 0 && (
        <Card>
          <CardHeader title="My Update Requests" subtitle="Submitted requests and their review status." />
          <div className="flex flex-col gap-2">
            {myRequests.map((r) => (
              <div key={r.id} className="rounded-lg bg-maia-bg px-3.5 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-maia-ink">{r.field}</p>
                  <Badge tone={UPDATE_REQUEST_STATUS_TONE[r.status]}>{r.status}</Badge>
                </div>
                <p className="mt-1 text-xs text-maia-ink-soft">
                  {r.oldValue || "—"} &rarr; {r.newValue}
                </p>
                {r.reviewNotes && <p className="mt-1 text-xs text-maia-ink-soft">Admin note: {r.reviewNotes}</p>}
              </div>
            ))}
          </div>
        </Card>
      )}

      <Modal
        open={modalField !== null}
        onClose={() => setModalField(null)}
        title={`Request Update — ${modalField ?? ""}`}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setModalField(null)}>
              CANCEL
            </Button>
            <Button onClick={handleSubmit} disabled={!newValue.trim() || !reason.trim()}>
              SUBMIT REQUEST
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <TextField label="New Value" value={newValue} onChange={(e) => setNewValue(e.target.value)} required />
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-maia-ink">
              Reason<span className="ml-0.5 text-maia-danger">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Why are you requesting this change?"
              className="w-full resize-none rounded-lg border border-maia-border bg-maia-surface px-3.5 py-2.5 text-sm text-maia-ink outline-none focus:border-maia-gold focus:ring-2 focus:ring-maia-gold/20"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}

function Field({
  label,
  value,
  onRequestUpdate,
}: {
  label: string;
  value: string;
  onRequestUpdate?: () => void;
}) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">{label}</dt>
      <dd className="mt-1 flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-maia-ink">{value || "—"}</span>
        {onRequestUpdate && (
          <button
            onClick={onRequestUpdate}
            className="flex flex-shrink-0 items-center gap-1 text-xs font-semibold text-maia-gold-deep hover:text-maia-ink"
          >
            <Edit3 size={12} />
            REQUEST UPDATE
          </button>
        )}
      </dd>
    </div>
  );
}
