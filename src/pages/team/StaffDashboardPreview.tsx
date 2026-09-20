import { Navigate, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Eye } from "lucide-react";
import { Card, CardHeader } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { TASK_STATUS_TONE } from "@/components/team/statusMeta";
import { useStaffStore } from "@/data/staffStore";
import { useTaskStore } from "@/data/taskStore";
import { getStaffWorkloads, isTaskActive } from "@/utils/staffTasks";

export function StaffDashboardPreview() {
  const { staffId } = useParams<{ staffId: string }>();
  const { staff, getStaffById } = useStaffStore();
  const { tasks } = useTaskStore();
  const navigate = useNavigate();

  const staffMember = staffId ? getStaffById(staffId) : undefined;

  if (!staffMember) {
    return <Navigate to="/team/staff" replace />;
  }

  const myTasks = tasks.filter((t) => t.assignedTo === staffMember.id);
  const active = myTasks.filter((t) => isTaskActive(t.status));
  const workload = getStaffWorkloads(staff, tasks).find((w) => w.staffId === staffMember.id);

  return (
    <div className="flex flex-col gap-6 pb-4">
      <button
        onClick={() => navigate(`/team/staff/${staffMember.id}`)}
        className="flex w-fit items-center gap-1.5 text-sm font-medium text-maia-ink-soft hover:text-maia-ink"
      >
        <ArrowLeft size={15} />
        Back to Staff Profile
      </button>

      <div className="flex items-start gap-3 rounded-xl border border-maia-gold/30 bg-maia-gold-bg px-4 py-3.5 text-sm text-maia-gold-deep">
        <Eye size={18} className="mt-0.5 flex-shrink-0" />
        <p>
          <strong>Preview only.</strong> This is what {staffMember.fullName}&rsquo;s own dashboard would look like once
          real staff authentication exists. This demo build's login always signs you in as the Owner — visiting this
          page does not log you in as {staffMember.fullName} or grant their permissions.
        </p>
      </div>

      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-maia-gold-deep">Staff Dashboard Preview</p>
        <h1 className="mt-1 font-display text-2xl font-extrabold text-maia-ink sm:text-[28px]">{staffMember.fullName}</h1>
        <p className="mt-1 text-sm text-maia-ink-soft">
          {staffMember.role === "Custom Role" ? staffMember.customRoleLabel || "Custom Role" : staffMember.role}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile label="Active Tasks" value={workload?.totalActive ?? 0} />
        <StatTile label="Due Today" value={workload?.dueToday ?? 0} />
        <StatTile label="Overdue" value={workload?.overdue ?? 0} tone="danger" />
        <StatTile label="Completed Today" value={workload?.completedToday ?? 0} tone="success" />
      </div>

      <Card padded={false}>
        <CardHeader
          title="My Tasks"
          subtitle={`${active.length} active task(s)`}
        />
        <div className="overflow-x-auto px-5 pb-5 sm:px-6 sm:pb-6">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-maia-border text-left text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">
                <th className="py-2.5">Task</th>
                <th className="py-2.5">Status</th>
                <th className="py-2.5">Due Date</th>
              </tr>
            </thead>
            <tbody>
              {active.map((t) => (
                <tr key={t.id} className="border-b border-maia-border/60 last:border-0">
                  <td className="py-2.5 font-medium text-maia-ink">{t.title}</td>
                  <td className="py-2.5">
                    <Badge tone={TASK_STATUS_TONE[t.status]}>{t.status}</Badge>
                  </td>
                  <td className="py-2.5 text-maia-ink-soft">{t.dueDate}</td>
                </tr>
              ))}
              {active.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-8 text-center text-maia-ink-soft">
                    No active tasks.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button variant="secondary" onClick={() => navigate(`/team/tasks?assignee=${staffMember.id}`)}>
          VIEW ALL TASKS
        </Button>
      </div>
    </div>
  );
}

function StatTile({ label, value, tone }: { label: string; value: number; tone?: "danger" | "success" }) {
  return (
    <Card>
      <p className="text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">{label}</p>
      <p
        className={`mt-1.5 font-display text-2xl font-extrabold ${
          tone === "danger" ? "text-maia-danger" : tone === "success" ? "text-maia-success" : "text-maia-ink"
        }`}
      >
        {value}
      </p>
    </Card>
  );
}
