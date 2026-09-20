import { useNavigate } from "react-router-dom";
import { Card, CardHeader } from "@/components/common/Card";
import { StaffTasksCard } from "@/components/dashboard/StaffTasksCard";
import type { TaskRecord } from "@/types/task";
import type { TaskSnapshot } from "@/utils/staffTasks";

export function StaffTaskSnapshotCard({ tasks, snapshot }: { tasks: TaskRecord[]; snapshot: TaskSnapshot }) {
  const navigate = useNavigate();

  const tiles = [
    { label: "Due Today", value: snapshot.dueToday, tone: "neutral" as const },
    { label: "Overdue", value: snapshot.overdue, tone: "danger" as const },
    { label: "In Progress", value: snapshot.inProgress, tone: "gold" as const },
    { label: "For Review", value: snapshot.forReview, tone: "warning" as const },
    { label: "Completed Today", value: snapshot.completedToday, tone: "success" as const },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader title="Staff Tasks" subtitle="Live snapshot from the Task Management module (Step 5)." />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {tiles.map((tile) => (
            <button
              key={tile.label}
              onClick={() => navigate("/team/tasks")}
              className="rounded-xl bg-maia-bg px-3 py-3 text-left transition-colors hover:bg-maia-gold-bg"
            >
              <p
                className={`font-display text-2xl font-extrabold leading-none ${
                  tile.tone === "danger"
                    ? "text-maia-danger"
                    : tile.tone === "warning"
                      ? "text-maia-warning"
                      : tile.tone === "gold"
                        ? "text-maia-gold-deep"
                        : tile.tone === "success"
                          ? "text-maia-success"
                          : "text-maia-ink"
                }`}
              >
                {tile.value}
              </p>
              <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-wide text-maia-ink-soft">{tile.label}</p>
            </button>
          ))}
        </div>
      </Card>

      <StaffTasksCard tasks={tasks} title="Priority Tasks" />
    </div>
  );
}
