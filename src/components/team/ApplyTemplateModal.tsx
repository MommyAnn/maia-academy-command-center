import { useState } from "react";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/common/Button";
import { SelectField } from "@/components/common/SelectField";
import { TASK_TEMPLATES } from "@/data/taskConfig";
import { useStaffStore } from "@/data/staffStore";
import { useTaskStore } from "@/data/taskStore";
import type { Batch } from "@/types/student";

export function ApplyTemplateModal({
  open,
  onClose,
  relatedStudentId,
  relatedStudentName,
  relatedBatch,
}: {
  open: boolean;
  onClose: () => void;
  relatedStudentId?: string | null;
  relatedStudentName?: string | null;
  relatedBatch?: Batch | null;
}) {
  const { staff } = useStaffStore();
  const { applyTemplate } = useTaskStore();
  const [templateId, setTemplateId] = useState(TASK_TEMPLATES[0]?.id ?? "");
  const [assignedTo, setAssignedTo] = useState(staff[0]?.id ?? "");

  const template = TASK_TEMPLATES.find((t) => t.id === templateId);

  function handleSubmit() {
    const assignee = staff.find((s) => s.id === assignedTo);
    if (!template || !assignee) return;
    applyTemplate({
      templateId: template.id,
      assignedTo: assignee.id,
      assignedToName: assignee.fullName,
      relatedStudentId: relatedStudentId ?? null,
      relatedStudentName: relatedStudentName ?? null,
      relatedBatch: relatedBatch ?? null,
    });
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Apply Task Template"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            CANCEL
          </Button>
          <Button onClick={handleSubmit} disabled={!template || !assignedTo}>
            APPLY TEMPLATE
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <SelectField
          label="Template"
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
          options={TASK_TEMPLATES.map((t) => ({ value: t.id, label: t.name }))}
        />

        {template && (
          <div className="rounded-lg bg-maia-bg px-3.5 py-3 text-xs text-maia-ink-soft">
            <p className="mb-1.5 font-semibold text-maia-ink">{template.description}</p>
            <p>Creates {template.items.length} task(s):</p>
            <ul className="mt-1 list-inside list-disc">
              {template.items.map((item) => (
                <li key={item.title}>{item.title}</li>
              ))}
            </ul>
          </div>
        )}

        <SelectField
          label="Assign To"
          value={assignedTo}
          onChange={(e) => setAssignedTo(e.target.value)}
          options={staff.filter((s) => s.accountStatus === "Active").map((s) => ({ value: s.id, label: s.fullName }))}
        />

        {relatedStudentName && (
          <p className="text-xs text-maia-ink-soft">
            Linked to student: <span className="font-semibold text-maia-ink">{relatedStudentName}</span>
          </p>
        )}
      </div>
    </Modal>
  );
}
