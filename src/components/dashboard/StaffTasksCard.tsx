import { useNavigate } from "react-router-dom";
import { Card, CardHeader } from "@/components/common/Card";
import { Button } from "@/components/common/Button";
import { Badge } from "@/components/common/Badge";
import { TASK_PRIORITY_TONE, TASK_STATUS_TONE } from "@/components/team/statusMeta";
import type { TaskRecord } from "@/types/task";

export function StaffTasksCard({ tasks, title = "Staff Tasks Today" }: { tasks: TaskRecord[]; title?: string }) {
  const navigate = useNavigate();

  return (
    <Card padded={false}>
      <div className="p-5 pb-0 sm:p-6 sm:pb-0">
        <CardHeader
          title={title}
          subtitle="Real task records from Team → Tasks."
          action={
            <Button variant="secondary" size="sm" onClick={() => navigate("/team/tasks")}>
              VIEW ALL TASKS
            </Button>
          }
        />
      </div>

      <div className="overflow-x-auto px-5 pb-5 sm:px-6 sm:pb-6">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-maia-border text-left text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">
              <th className="py-2.5 pr-3">Task</th>
              <th className="py-2.5 pr-3">Assigned To</th>
              <th className="py-2.5 pr-3">Related Student</th>
              <th className="py-2.5 pr-3">Priority</th>
              <th className="py-2.5 pr-3">Due</th>
              <th className="py-2.5 pr-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr
                key={task.id}
                className="cursor-pointer border-b border-maia-border/60 last:border-0 hover:bg-maia-bg/40"
                onClick={() => navigate(`/team/tasks/${encodeURIComponent(task.id)}`)}
              >
                <td className="py-3 pr-3 font-medium text-maia-ink">{task.title}</td>
                <td className="py-3 pr-3 text-maia-ink-soft">{task.assignedToName}</td>
                <td className="py-3 pr-3 text-maia-ink-soft">{task.relatedStudentName ?? "—"}</td>
                <td className="py-3 pr-3">
                  <Badge tone={TASK_PRIORITY_TONE[task.priority]}>{task.priority}</Badge>
                </td>
                <td className="py-3 pr-3 text-maia-ink-soft">{task.dueDate}</td>
                <td className="py-3 pr-3">
                  <Badge tone={TASK_STATUS_TONE[task.status]}>{task.status}</Badge>
                </td>
              </tr>
            ))}
            {tasks.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-maia-ink-soft">
                  No tasks to show.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
