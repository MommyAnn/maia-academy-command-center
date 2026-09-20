import { useState } from "react";
import { CheckCircle2, PlayCircle, RotateCcw, ShieldAlert, UserCog, Send } from "lucide-react";
import { Button } from "@/components/common/Button";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { ReassignModal } from "@/components/team/ReassignModal";
import { TaskFormModal } from "@/components/team/TaskFormModal";
import { useTaskStore } from "@/data/taskStore";
import type { TaskRecord } from "@/types/task";

export function TaskStatusActions({ task }: { task: TaskRecord }) {
  const { startTask, sendForReview, approveAndComplete, returnForChanges, markBlocked, unblockTask, cancelTask } =
    useTaskStore();

  const [confirming, setConfirming] = useState<null | "block" | "cancel" | "return">(null);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const isAuto = task.source === "Automatic";

  if (task.status === "Completed" || task.status === "Cancelled") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-maia-ink-soft">
          This task is {task.status.toLowerCase()} and kept in history — completed tasks are never deleted.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {task.status === "To Do" && (
        <Button onClick={() => startTask(task.id)}>
          <PlayCircle size={15} />
          START TASK
        </Button>
      )}

      {task.status === "In Progress" && (
        <Button onClick={() => sendForReview(task.id)}>
          <Send size={15} />
          SEND FOR REVIEW
        </Button>
      )}

      {task.status === "For Review" && (
        <>
          <Button onClick={() => approveAndComplete(task.id)}>
            <CheckCircle2 size={15} />
            APPROVE &amp; COMPLETE
          </Button>
          <Button variant="secondary" onClick={() => setConfirming("return")}>
            <RotateCcw size={15} />
            RETURN FOR CHANGES
          </Button>
        </>
      )}

      {task.status === "Blocked" ? (
        <Button variant="secondary" onClick={() => unblockTask(task.id)}>
          <PlayCircle size={15} />
          UNBLOCK / RESUME
        </Button>
      ) : (
        <Button variant="secondary" onClick={() => setConfirming("block")}>
          <ShieldAlert size={15} />
          MARK BLOCKED
        </Button>
      )}

      <Button variant="secondary" onClick={() => setReassignOpen(true)}>
        <UserCog size={15} />
        REASSIGN
      </Button>

      {!isAuto && (
        <Button variant="secondary" onClick={() => setEditOpen(true)}>
          EDIT
        </Button>
      )}

      <Button variant="ghost" onClick={() => setConfirming("cancel")}>
        CANCEL TASK
      </Button>

      <ConfirmDialog
        open={confirming === "block"}
        onClose={() => setConfirming(null)}
        onConfirm={(reason) => {
          if (reason) markBlocked(task.id, reason);
          setConfirming(null);
        }}
        title="Mark Task as Blocked"
        description="Explain what's blocking progress on this task. It stays visible on Workload/Calendar as blocked until resumed."
        confirmLabel="MARK BLOCKED"
        tone="danger"
        requireReason
        reasonLabel="Reason for blocking"
      />

      <ConfirmDialog
        open={confirming === "cancel"}
        onClose={() => setConfirming(null)}
        onConfirm={(reason) => {
          if (reason) cancelTask(task.id, reason);
          setConfirming(null);
        }}
        title="Cancel Task"
        description="Cancelling keeps this task in history (never deleted) but marks it as no longer active."
        confirmLabel="CANCEL TASK"
        tone="danger"
        requireReason
        reasonLabel="Reason for cancelling"
      />

      <ConfirmDialog
        open={confirming === "return"}
        onClose={() => setConfirming(null)}
        onConfirm={(reason) => {
          if (reason) returnForChanges(task.id, reason);
          setConfirming(null);
        }}
        title="Return for Changes"
        description="Send this task back to In Progress with notes on what needs to change."
        confirmLabel="RETURN FOR CHANGES"
        requireReason
        reasonLabel="What needs to change"
      />

      {reassignOpen && <ReassignModal open={reassignOpen} onClose={() => setReassignOpen(false)} task={task} />}
      {editOpen && <TaskFormModal open={editOpen} onClose={() => setEditOpen(false)} editingTask={task} />}
    </div>
  );
}
