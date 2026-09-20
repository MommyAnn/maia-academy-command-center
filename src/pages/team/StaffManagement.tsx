import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Users } from "lucide-react";
import { Card } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { SearchInput } from "@/components/common/SearchInput";
import { FilterSelect } from "@/components/common/FilterSelect";
import { StaffFormModal } from "@/components/team/StaffFormModal";
import { STAFF_STATUS_TONE } from "@/components/team/statusMeta";
import { STAFF_ACCOUNT_STATUS_OPTIONS, STAFF_ROLES } from "@/types/staff";
import { useStaffStore } from "@/data/staffStore";
import { useTaskStore } from "@/data/taskStore";
import { isTaskActive } from "@/utils/staffTasks";

export function StaffManagement() {
  const { staff } = useStaffStore();
  const { tasks } = useTaskStore();
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);

  const filtered = useMemo(
    () =>
      staff.filter((s) => {
        const searchable = `${s.fullName} ${s.staffId} ${s.email}`.toLowerCase();
        if (search.trim() && !searchable.includes(search.trim().toLowerCase())) return false;
        if (role !== "all" && s.role !== role) return false;
        if (status !== "all" && s.accountStatus !== status) return false;
        return true;
      }),
    [staff, search, role, status],
  );

  return (
    <div className="flex flex-col gap-6 pb-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-maia-gold-deep">Team</p>
          <h1 className="mt-1 font-display text-2xl font-extrabold text-maia-ink sm:text-[28px]">Staff Management</h1>
          <p className="mt-1 text-sm text-maia-ink-soft">{staff.length} staff accounts.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus size={15} />
          ADD STAFF
        </Button>
      </div>

      <p className="rounded-lg border border-maia-warning/30 bg-maia-warning-bg px-4 py-2.5 text-xs text-maia-warning">
        Demo only: no real login/password exists for these accounts yet, and every visitor to this build signs in as the
        Owner regardless of what staff records exist here. See a staff member's profile for a preview of what their own
        dashboard would look like.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search by name, staff ID, or email..." />
        <FilterSelect
          value={role}
          onChange={setRole}
          options={[{ value: "all", label: "All Roles" }, ...STAFF_ROLES.map((r) => ({ value: r, label: r }))]}
        />
        <FilterSelect
          value={status}
          onChange={setStatus}
          options={[{ value: "all", label: "All Statuses" }, ...STAFF_ACCOUNT_STATUS_OPTIONS.map((s) => ({ value: s, label: s }))]}
        />
      </div>

      <Card padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-maia-border bg-maia-bg/60 text-left text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">
                <th className="px-4 py-3">Staff ID</th>
                <th className="px-4 py-3">Full Name</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Active Tasks</th>
                <th className="px-4 py-3">Account Status</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => {
                const activeTasks = tasks.filter((t) => t.assignedTo === s.id && isTaskActive(t.status)).length;
                return (
                  <tr key={s.id} className="border-b border-maia-border/60 last:border-0 hover:bg-maia-bg/40">
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-semibold text-maia-ink">{s.staffId}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-maia-ink">{s.fullName}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">
                      {s.role === "Custom Role" ? s.customRoleLabel || "Custom Role" : s.role}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{s.email}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{activeTasks}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Badge tone={STAFF_STATUS_TONE[s.accountStatus]}>{s.accountStatus}</Badge>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Button size="sm" variant="secondary" onClick={() => navigate(`/team/staff/${s.id}`)}>
                        VIEW PROFILE
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-maia-ink-soft">
                    <Users className="mx-auto mb-2 text-maia-ink-soft/50" size={22} />
                    No staff match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <StaffFormModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
