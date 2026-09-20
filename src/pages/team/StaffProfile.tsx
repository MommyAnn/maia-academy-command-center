import { useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { LayoutDashboard, Mail, Phone, ShieldCheck } from "lucide-react";
import { Card, CardHeader } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { Tabs } from "@/components/common/Tabs";
import { SelectField } from "@/components/common/SelectField";
import { STAFF_STATUS_TONE, TASK_STATUS_TONE } from "@/components/team/statusMeta";
import { PermissionsMatrixView } from "@/components/team/PermissionsMatrixView";
import { STAFF_ACCOUNT_STATUS_OPTIONS, type StaffAccountStatus } from "@/types/staff";
import { useStaffStore } from "@/data/staffStore";
import { useTaskStore } from "@/data/taskStore";

const TABS = [
  { value: "overview", label: "Overview" },
  { value: "permissions", label: "Permissions" },
  { value: "tasks", label: "Tasks" },
  { value: "activity", label: "Activity" },
];

export function StaffProfile() {
  const { staffId } = useParams<{ staffId: string }>();
  const { getStaffById, updateAccountStatus } = useStaffStore();
  const { tasks } = useTaskStore();
  const navigate = useNavigate();
  const [tab, setTab] = useState("overview");

  const staff = staffId ? getStaffById(staffId) : undefined;

  if (!staff) {
    return <Navigate to="/team/staff" replace />;
  }

  const staffTasks = tasks.filter((t) => t.assignedTo === staff.id);

  return (
    <div className="flex flex-col gap-6 pb-4">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-maia-black text-lg font-bold text-maia-gold">
              {staff.avatarInitials}
            </div>
            <div>
              <p className="font-mono text-xs font-semibold text-maia-ink-soft">{staff.staffId}</p>
              <h1 className="font-display text-xl font-extrabold text-maia-ink sm:text-2xl">{staff.fullName}</h1>
              <p className="mt-1 text-sm text-maia-ink-soft">
                {staff.role === "Custom Role" ? staff.customRoleLabel || "Custom Role" : staff.role}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={STAFF_STATUS_TONE[staff.accountStatus]}>{staff.accountStatus}</Badge>
            <Button variant="secondary" onClick={() => navigate(`/team/staff/${staff.id}/dashboard`)}>
              <LayoutDashboard size={15} />
              PREVIEW DASHBOARD
            </Button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 border-t border-maia-border pt-5 sm:grid-cols-3">
          <InfoRow icon={<Mail size={14} />} label="Email" value={staff.email} />
          <InfoRow icon={<Phone size={14} />} label="Contact Number" value={staff.contactNumber || "—"} />
          <InfoRow icon={<ShieldCheck size={14} />} label="Date Joined" value={staff.dateJoined} />
        </div>

        <div className="mt-5 max-w-xs border-t border-maia-border pt-5">
          <SelectField
            label="Account Status"
            value={staff.accountStatus}
            onChange={(e) => updateAccountStatus(staff.id, e.target.value as StaffAccountStatus)}
            options={STAFF_ACCOUNT_STATUS_OPTIONS.map((s) => ({ value: s, label: s }))}
          />
        </div>
      </Card>

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === "overview" && (
        <Card>
          <CardHeader title="Overview" subtitle="Assigned batches and notes." />
          <div className="flex flex-col gap-4">
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">Assigned Batches</p>
              {staff.assignedBatches.length === 0 ? (
                <p className="text-sm text-maia-ink-soft">No batches assigned.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {staff.assignedBatches.map((b) => (
                    <Badge key={b} tone="gold">
                      {b}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">Notes</p>
              <p className="rounded-lg bg-maia-bg px-3.5 py-2.5 text-sm text-maia-ink-soft">{staff.notes || "No notes."}</p>
            </div>
          </div>
        </Card>
      )}

      {tab === "permissions" && <PermissionsMatrixView staff={staff} />}

      {tab === "tasks" && (
        <Card padded={false}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-maia-border bg-maia-bg/60 text-left text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">
                  <th className="px-4 py-3">Task ID</th>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Due Date</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {staffTasks.map((t) => (
                  <tr key={t.id} className="border-b border-maia-border/60 last:border-0 hover:bg-maia-bg/40">
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-semibold text-maia-ink">{t.id}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-maia-ink">{t.title}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Badge tone={TASK_STATUS_TONE[t.status]}>{t.status}</Badge>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{t.dueDate}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Button size="sm" variant="secondary" onClick={() => navigate(`/team/tasks/${encodeURIComponent(t.id)}`)}>
                        VIEW TASK
                      </Button>
                    </td>
                  </tr>
                ))}
                {staffTasks.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-sm text-maia-ink-soft">
                      No tasks assigned to this staff member.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === "activity" && (
        <Card>
          <CardHeader title="Activity History" />
          <ul className="flex flex-col gap-2.5">
            {[...staff.activity]
              .reverse()
              .map((entry) => (
                <li key={entry.id} className="flex items-center justify-between rounded-lg bg-maia-bg px-3.5 py-2.5 text-sm">
                  <span className="text-maia-ink">{entry.action}</span>
                  <span className="whitespace-nowrap text-xs text-maia-ink-soft">
                    {entry.date} &middot; {entry.time}
                  </span>
                </li>
              ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-maia-ink-soft">
        {icon}
        {label}
      </p>
      <p className="mt-0.5 text-sm font-medium text-maia-ink">{value}</p>
    </div>
  );
}
