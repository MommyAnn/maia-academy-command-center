import { useState } from "react";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/common/Button";
import { TextField } from "@/components/common/TextField";
import { SelectField } from "@/components/common/SelectField";
import { TASK_CATEGORIES, TASK_PRIORITIES, type TaskCategory, type TaskPriority, type TaskRecord } from "@/types/task";
import { useStaffStore } from "@/data/staffStore";
import { useStudentStore } from "@/data/studentStore";
import { useTaskStore, type CreateTaskInput } from "@/data/taskStore";

export function TaskFormModal({
  open,
  onClose,
  editingTask,
  onCreated,
  defaultRelatedStudentId,
}: {
  open: boolean;
  onClose: () => void;
  editingTask?: TaskRecord | null;
  onCreated?: (task: TaskRecord) => void;
  /** Pre-links a new task to this student (e.g. from the Student Profile Tasks tab). Ignored in edit mode. */
  defaultRelatedStudentId?: string;
}) {
  const { staff } = useStaffStore();
  const { students } = useStudentStore();
  const { createTask, updateTask } = useTaskStore();

  const isEdit = Boolean(editingTask);

  const [title, setTitle] = useState(editingTask?.title ?? "");
  const [description, setDescription] = useState(editingTask?.description ?? "");
  const [category, setCategory] = useState<TaskCategory>(editingTask?.category ?? "General");
  const [priority, setPriority] = useState<TaskPriority>(editingTask?.priority ?? "Medium");
  const [dueDate, setDueDate] = useState(editingTask?.dueDate ?? new Date().toISOString().slice(0, 10));
  const [assignedTo, setAssignedTo] = useState(editingTask?.assignedTo ?? staff[0]?.id ?? "");
  const [relatedStudentId, setRelatedStudentId] = useState(editingTask?.relatedStudentId ?? defaultRelatedStudentId ?? "");

  function reset() {
    setTitle("");
    setDescription("");
    setCategory("General");
    setPriority("Medium");
    setDueDate(new Date().toISOString().slice(0, 10));
    setAssignedTo(staff[0]?.id ?? "");
    setRelatedStudentId(defaultRelatedStudentId ?? "");
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleSubmit() {
    if (!title.trim()) return;

    if (isEdit && editingTask) {
      updateTask(editingTask.id, { title: title.trim(), description: description.trim(), category, priority, dueDate });
      handleClose();
      return;
    }

    const assignee = staff.find((s) => s.id === assignedTo);
    const student = relatedStudentId ? students.find((s) => s.id === relatedStudentId) : undefined;

    const input: CreateTaskInput = {
      title: title.trim(),
      description: description.trim(),
      category,
      priority,
      assignedTo: assignee?.id ?? "",
      assignedToName: assignee?.fullName ?? "Unassigned",
      dueDate,
      relatedStudentId: student?.id ?? null,
      relatedStudentName: student?.fullName ?? null,
      relatedBatch: student?.batch ?? null,
    };
    const created = createTask(input);
    onCreated?.(created);
    handleClose();
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={isEdit ? "Edit Task" : "New Task"}
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={handleClose}>
            CANCEL
          </Button>
          <Button onClick={handleSubmit} disabled={!title.trim()}>
            {isEdit ? "SAVE CHANGES" : "CREATE TASK"}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <TextField label="Task Title" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Verify Proof of Payment" />

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-maia-ink">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="What needs to be done?"
            className="w-full resize-none rounded-lg border border-maia-border bg-maia-surface px-3.5 py-2.5 text-sm text-maia-ink outline-none focus:border-maia-gold focus:ring-2 focus:ring-maia-gold/20"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField
            label="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value as TaskCategory)}
            options={TASK_CATEGORIES.map((c) => ({ value: c, label: c }))}
          />
          <SelectField
            label="Priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value as TaskPriority)}
            options={TASK_PRIORITIES.map((p) => ({ value: p, label: p }))}
          />
        </div>

        <TextField label="Due Date" type="date" required value={dueDate} onChange={(e) => setDueDate(e.target.value)} />

        {!isEdit && (
          <>
            <SelectField
              label="Assign To"
              required
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              options={staff.filter((s) => s.accountStatus === "Active").map((s) => ({ value: s.id, label: `${s.fullName} — ${s.role === "Custom Role" ? s.customRoleLabel : s.role}` }))}
            />

            <SelectField
              label="Related Student (optional)"
              value={relatedStudentId}
              onChange={(e) => setRelatedStudentId(e.target.value)}
              options={[
                { value: "", label: "None" },
                ...students.map((s) => ({ value: s.id, label: `${s.fullName} (${s.studentId})` })),
              ]}
            />
          </>
        )}
      </div>
    </Modal>
  );
}
