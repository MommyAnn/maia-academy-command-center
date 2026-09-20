import { useState } from "react";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/common/Button";
import { SelectField } from "@/components/common/SelectField";
import { useStaffStore } from "@/data/staffStore";
import { useTaskStore } from "@/data/taskStore";
import type { TaskRecord } from "@/types/task";

export function ReassignModal({ open, onClose, task }: { open: boolean; onClose: () => void; task: TaskRecord }) {
  const { staff } = useStaffStore();
  const { reassignTask } = useTaskStore();
  const [staffId, setStaffId] = useState(task.assignedTo);

  function handleSubmit() {
    const target = staff.find((s) => s.id === staffId);
    if (!target) return;
    reassignTask(task.id, target.id, target.fullName);
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Reassign Task"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            CANCEL
          </Button>
          <Button onClick={handleSubmit}>REASSIGN</Button>
        </div>
      }
    >
      <p className="mb-4 text-sm text-maia-ink-soft">
        Currently assigned to <span className="font-semibold text-maia-ink">{task.assignedToName}</span>.
      </p>
      <SelectField
        label="Reassign To"
        value={staffId}
        onChange={(e) => setStaffId(e.target.value)}
        options={staff.filter((s) => s.accountStatus === "Active").map((s) => ({ value: s.id, label: s.fullName }))}
      />
    </Modal>
  );
}
