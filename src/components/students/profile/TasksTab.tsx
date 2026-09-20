import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LayoutTemplate, Plus } from "lucide-react";
import { Card, CardHeader } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { TASK_STATUS_TONE, TASK_PRIORITY_TONE } from "@/components/team/statusMeta";
import { TaskFormModal } from "@/components/team/TaskFormModal";
import { ApplyTemplateModal } from "@/components/team/ApplyTemplateModal";
import { useTaskStore } from "@/data/taskStore";
import type { StudentRecord } from "@/types/student";

export function TasksTab({ student }: { student: StudentRecord }) {
  const { getTasksForStudent } = useTaskStore();
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);

  const tasks = getTasksForStudent(student.id).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  return (
    <Card padded={false}>
      <div className="flex flex-wrap items-start justify-between gap-3 p-5 sm:p-6">
        <CardHeader title="Tasks" subtitle={`${tasks.length} task(s) linked to this student — manual and automatic.`} />
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setTemplateOpen(true)}>
            <LayoutTemplate size={14} />
            APPLY TEMPLATE
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus size={14} />
            NEW TASK
          </Button>
        </div>
      </div>

      {tasks.length === 0 ? (
        <p className="px-5 pb-6 text-sm text-maia-ink-soft sm:px-6">No tasks linked to this student yet.</p>
      ) : (
        <div className="overflow-x-auto border-t border-maia-border">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-maia-border bg-maia-bg/60 text-left text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Assigned To</th>
                <th className="px-4 py-3">Due Date</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => (
                <tr key={t.id} className="border-b border-maia-border/60 last:border-0 hover:bg-maia-bg/40">
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-maia-ink">{t.title}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <Badge tone={TASK_PRIORITY_TONE[t.priority]}>{t.priority}</Badge>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <Badge tone={TASK_STATUS_TONE[t.status]}>{t.status}</Badge>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{t.assignedToName}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{t.dueDate}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <Button size="sm" variant="secondary" onClick={() => navigate(`/team/tasks/${encodeURIComponent(t.id)}`)}>
                      VIEW TASK
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <TaskFormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        defaultRelatedStudentId={student.id}
      />
      <ApplyTemplateModal
        open={templateOpen}
        onClose={() => setTemplateOpen(false)}
        relatedStudentId={student.id}
        relatedStudentName={student.fullName}
        relatedBatch={student.batch}
      />
    </Card>
  );
}
