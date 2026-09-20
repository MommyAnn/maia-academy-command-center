import { useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, MessageSquare, Paperclip, User } from "lucide-react";
import { Card, CardHeader } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { TASK_STATUS_TONE, TASK_PRIORITY_TONE, TASK_CATEGORY_TONE } from "@/components/team/statusMeta";
import { TaskStatusActions } from "@/components/team/TaskStatusActions";
import { useTaskStore } from "@/data/taskStore";

export function TaskDetail() {
  const { taskId } = useParams<{ taskId: string }>();
  const { getTaskById, toggleChecklistItem, addComment } = useTaskStore();
  const navigate = useNavigate();
  const [commentText, setCommentText] = useState("");

  const task = taskId ? getTaskById(taskId) : undefined;

  if (!task) {
    return <Navigate to="/team/tasks" replace />;
  }

  const doneCount = task.checklist.filter((c) => c.done).length;

  function handleAddComment() {
    if (!commentText.trim() || !task) return;
    addComment(task.id, commentText);
    setCommentText("");
  }

  return (
    <div className="flex flex-col gap-6 pb-4">
      <button
        onClick={() => navigate("/team/tasks")}
        className="flex w-fit items-center gap-1.5 text-sm font-medium text-maia-ink-soft hover:text-maia-ink"
      >
        <ArrowLeft size={15} />
        Back to Tasks
      </button>

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-mono text-xs font-semibold text-maia-ink-soft">{task.id}</p>
            <h1 className="mt-1 font-display text-xl font-extrabold text-maia-ink sm:text-2xl">{task.title}</h1>
            <p className="mt-2 max-w-2xl text-sm text-maia-ink-soft">{task.description || "No description provided."}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone={TASK_STATUS_TONE[task.status]}>{task.status}</Badge>
            <Badge tone={TASK_PRIORITY_TONE[task.priority]}>{task.priority}</Badge>
            <Badge tone={TASK_CATEGORY_TONE[task.category]}>{task.category}</Badge>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4 border-t border-maia-border pt-5 sm:grid-cols-4">
          <Field label="Assigned To" value={task.assignedToName} />
          <Field label="Due Date" value={task.dueDate} />
          <Field label="Created By" value={task.createdBy} />
          <Field label="Source" value={task.source} />
          {task.relatedStudentName && (
            <Field
              label="Related Student"
              value={task.relatedStudentName}
              onClick={task.relatedStudentId ? () => navigate(`/students/${task.relatedStudentId}`) : undefined}
            />
          )}
          {task.relatedBatch && <Field label="Batch" value={task.relatedBatch} />}
          {task.blockedReason && <Field label="Blocked Reason" value={task.blockedReason} tone="danger" />}
          {task.cancelledReason && <Field label="Cancelled Reason" value={task.cancelledReason} tone="danger" />}
          {task.reviewNotes && <Field label="Review Notes" value={task.reviewNotes} />}
        </div>

        <div className="mt-5 border-t border-maia-border pt-5">
          <TaskStatusActions task={task} />
        </div>
      </Card>

      {task.checklist.length > 0 && (
        <Card>
          <CardHeader title="Checklist" subtitle={`${doneCount} of ${task.checklist.length} complete`} />
          <div className="flex flex-col gap-2">
            {task.checklist.map((item) => (
              <label
                key={item.id}
                className="flex items-center gap-3 rounded-lg bg-maia-bg px-3.5 py-2.5 text-sm text-maia-ink"
              >
                <input
                  type="checkbox"
                  checked={item.done}
                  onChange={() => toggleChecklistItem(task.id, item.id)}
                  className="h-4 w-4 cursor-pointer accent-maia-gold-deep"
                />
                <span className={item.done ? "text-maia-ink-soft line-through" : ""}>{item.label}</span>
              </label>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <CardHeader title="Internal Comments" subtitle="Visible to staff only — never shown to students." action={<MessageSquare size={16} className="text-maia-ink-soft" />} />
        <div className="mb-4 flex flex-col gap-3">
          {task.comments.length === 0 && <p className="text-sm text-maia-ink-soft">No comments yet.</p>}
          {task.comments.map((c) => (
            <div key={c.id} className="rounded-lg bg-maia-bg px-3.5 py-2.5">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-maia-ink">
                  <User size={12} />
                  {c.author}
                </span>
                <span className="text-[11px] text-maia-ink-soft">{new Date(c.timestamp).toLocaleString("en-PH")}</span>
              </div>
              <p className="mt-1.5 text-sm text-maia-ink-soft">{c.text}</p>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Add an internal comment..."
            className="flex-1 rounded-lg border border-maia-border bg-maia-surface px-3.5 py-2.5 text-sm text-maia-ink outline-none focus:border-maia-gold focus:ring-2 focus:ring-maia-gold/20"
            onKeyDown={(e) => e.key === "Enter" && handleAddComment()}
          />
          <Button onClick={handleAddComment} disabled={!commentText.trim()}>
            POST
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader title="Attachments" subtitle="Filename/type/size metadata only — no real file storage backend exists yet." action={<Paperclip size={16} className="text-maia-ink-soft" />} />
        {task.attachments.length === 0 ? (
          <p className="text-sm text-maia-ink-soft">No attachments.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {task.attachments.map((a) => (
              <li key={a.fileName} className="flex items-center justify-between rounded-lg bg-maia-bg px-3.5 py-2.5 text-sm">
                <span className="text-maia-ink">{a.fileName}</span>
                <span className="text-xs text-maia-ink-soft">{a.fileSizeLabel}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Field({ label, value, onClick, tone }: { label: string; value: string; onClick?: () => void; tone?: "danger" }) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp onClick={onClick} className={`text-left ${onClick ? "cursor-pointer hover:underline" : ""}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-maia-ink-soft">{label}</p>
      <p className={`mt-0.5 text-sm font-medium ${tone === "danger" ? "text-maia-danger" : "text-maia-ink"}`}>{value}</p>
    </Comp>
  );
}
