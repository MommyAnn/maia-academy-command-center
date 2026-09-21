import { useState } from "react";
import { Edit3 } from "lucide-react";
import { Card, CardHeader } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { Modal } from "@/components/common/Modal";
import { SelectField } from "@/components/common/SelectField";
import { TextField } from "@/components/common/TextField";
import { useStudentPortal } from "@/context/StudentPortalContext";
import { usePortalStore } from "@/data/portalStore";
import { ENROLLMENT_STATUS_TONE } from "@/components/students/statusMeta";
import { UPDATE_REQUEST_STATUS_TONE } from "@/components/portal/statusMeta";
import { formatDate } from "@/utils/students";

const ENROLLMENT_FIELDS = ["Batch", "Package", "Attendance Preference", "Companion Name"] as const;

function currentValue(fieldLabel: string, student: ReturnType<typeof useStudentPortal>["student"]): string {
  switch (fieldLabel) {
    case "Batch":
      return student.batch;
    case "Package":
      return student.package;
    case "Attendance Preference":
      return student.attendance;
    case "Companion Name":
      return student.companionName;
    default:
      return "";
  }
}

export function Enrollment() {
  const { student } = useStudentPortal();
  const { updateRequests, createUpdateRequest } = usePortalStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [field, setField] = useState<(typeof ENROLLMENT_FIELDS)[number]>("Batch");
  const [newValue, setNewValue] = useState("");
  const [reason, setReason] = useState("");

  const isVip = student.package === "VIP" || student.package === "Dual VIP";
  const myRequests = updateRequests
    .filter((r) => r.studentId === student.id && ENROLLMENT_FIELDS.includes(r.field as (typeof ENROLLMENT_FIELDS)[number]))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  function openModal(f: (typeof ENROLLMENT_FIELDS)[number]) {
    setField(f);
    setNewValue("");
    setReason("");
    setModalOpen(true);
  }

  function handleSubmit() {
    if (!newValue.trim() || !reason.trim()) return;
    createUpdateRequest({
      studentId: student.id,
      field,
      oldValue: currentValue(field, student),
      newValue: newValue.trim(),
      reason: reason.trim(),
    });
    setModalOpen(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader
          title="Enrollment Details"
          subtitle="These are your verified Academy records — request a change instead of editing directly."
        />
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Batch" value={student.batch} onRequestUpdate={() => openModal("Batch")} />
          <Field label="Package" value={student.package} onRequestUpdate={() => openModal("Package")} />
          <Field
            label="Attendance Preference"
            value={student.attendance}
            onRequestUpdate={() => openModal("Attendance Preference")}
          />
          <Field label="Enrollment Date" value={formatDate(student.enrollmentDate)} />
        </dl>

        <div className="mt-5 border-t border-maia-border pt-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">Enrollment Status</p>
          <Badge tone={ENROLLMENT_STATUS_TONE[student.enrollmentStatus]}>{student.enrollmentStatus}</Badge>
        </div>
      </Card>

      {isVip && (
        <Card>
          <CardHeader title="Companion Information" subtitle="Available for VIP and Dual VIP packages." />
          <Field
            label="Companion Name"
            value={student.companionName || "—"}
            onRequestUpdate={() => openModal("Companion Name")}
          />
        </Card>
      )}

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
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={`Request Update — ${field}`}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              CANCEL
            </Button>
            <Button onClick={handleSubmit} disabled={!newValue.trim() || !reason.trim()}>
              SUBMIT REQUEST
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <SelectField
            label="Field"
            value={field}
            onChange={(e) => setField(e.target.value as (typeof ENROLLMENT_FIELDS)[number])}
            options={ENROLLMENT_FIELDS.map((f) => ({ value: f, label: f }))}
          />
          <p className="text-sm text-maia-ink-soft">
            Current value: <span className="font-semibold text-maia-ink">{currentValue(field, student) || "—"}</span>
          </p>
          <TextField
            label="Requested New Value"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            required
          />
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
          <p className="text-xs text-maia-ink-soft">
            This will be reviewed by the Academy — your record will not change until it&rsquo;s approved.
          </p>
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
        <span className="text-sm font-medium text-maia-ink">{value}</span>
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
