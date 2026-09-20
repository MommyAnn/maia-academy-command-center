import { useNavigate } from "react-router-dom";
import { Card, CardHeader } from "@/components/common/Card";
import { Button } from "@/components/common/Button";
import { Badge } from "@/components/common/Badge";
import type { StaffTask, TaskPriority, TaskStatus } from "@/types";

const PRIORITY_TONE: Record<TaskPriority, "danger" | "warning" | "neutral"> = {
  High: "danger",
  Medium: "warning",
  Low: "neutral",
};

const STATUS_TONE: Record<TaskStatus, "info" | "gold" | "success"> = {
  "To Do": "info",
  "In Progress": "gold",
  Done: "success",
};

export function StaffTasksCard({ tasks }: { tasks: StaffTask[] }) {
  const navigate = useNavigate();

  return (
    <Card padded={false}>
      <div className="p-5 pb-0 sm:p-6 sm:pb-0">
        <CardHeader
          title="Staff Tasks Today"
          action={
            <Button variant="secondary" size="sm" onClick={() => navigate("/team/tasks")}>
              VIEW ALL TASKS
            </Button>
          }
        />
      </div>

      <div className="overflow-x-auto px-5 pb-5 sm:px-6 sm:pb-6">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-maia-border text-left text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">
              <th className="py-2.5 pr-3">Task</th>
              <th className="py-2.5 pr-3">Assigned To</th>
              <th className="py-2.5 pr-3">Priority</th>
              <th className="py-2.5 pr-3">Due</th>
              <th className="py-2.5 pr-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr key={task.id} className="border-b border-maia-border/60 last:border-0">
                <td className="py-3 pr-3 font-medium text-maia-ink">{task.task}</td>
                <td className="py-3 pr-3 text-maia-ink-soft">{task.assignedTo}</td>
                <td className="py-3 pr-3">
                  <Badge tone={PRIORITY_TONE[task.priority]}>{task.priority}</Badge>
                </td>
                <td className="py-3 pr-3 text-maia-ink-soft">{task.due}</td>
                <td className="py-3 pr-3">
                  <Badge tone={STATUS_TONE[task.status]}>{task.status}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
