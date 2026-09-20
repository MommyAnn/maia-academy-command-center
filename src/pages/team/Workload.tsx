import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Info } from "lucide-react";
import { Card, CardHeader } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { STAFF_STATUS_TONE } from "@/components/team/statusMeta";
import { useStaffStore } from "@/data/staffStore";
import { useTaskStore } from "@/data/taskStore";
import { getStaffWorkloads } from "@/utils/staffTasks";

// IMPORTANT: this page is intentionally neutral and operational. It answers
// "who has capacity right now?" — never "who is the best/worst performer?".
// Do NOT add a score, rating, or ranking to this view.
export function Workload() {
  const { staff } = useStaffStore();
  const { tasks } = useTaskStore();
  const navigate = useNavigate();

  const workloads = useMemo(
    () => [...getStaffWorkloads(staff, tasks)].sort((a, b) => a.staffName.localeCompare(b.staffName)),
    [staff, tasks],
  );

  return (
    <div className="flex flex-col gap-6 pb-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-maia-gold-deep">Team</p>
        <h1 className="mt-1 font-display text-2xl font-extrabold text-maia-ink sm:text-[28px]">Workload</h1>
        <p className="mt-1 text-sm text-maia-ink-soft">A capacity view of current task load — not a performance ranking.</p>
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-maia-info/30 bg-maia-info-bg px-4 py-3 text-xs text-maia-info">
        <Info size={16} className="mt-0.5 flex-shrink-0" />
        <p>
          This page is sorted alphabetically and shows counts only — it is not a leaderboard. Use it to see who has open
          capacity before assigning new work, not to compare or score staff.
        </p>
      </div>

      <Card padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-maia-border bg-maia-bg/60 text-left text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">
                <th className="px-4 py-3">Staff</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-center">To Do</th>
                <th className="px-4 py-3 text-center">In Progress</th>
                <th className="px-4 py-3 text-center">For Review</th>
                <th className="px-4 py-3 text-center">Blocked</th>
                <th className="px-4 py-3 text-center">Due Today</th>
                <th className="px-4 py-3 text-center">Overdue</th>
                <th className="px-4 py-3 text-center">Total Active</th>
              </tr>
            </thead>
            <tbody>
              {workloads.map((w) => (
                <tr
                  key={w.staffId}
                  className="cursor-pointer border-b border-maia-border/60 last:border-0 hover:bg-maia-bg/40"
                  onClick={() => navigate(`/team/staff/${w.staffId}`)}
                >
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-maia-ink">{w.staffName}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{w.role}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <Badge tone={STAFF_STATUS_TONE[w.accountStatus]}>{w.accountStatus}</Badge>
                  </td>
                  <td className="px-4 py-3 text-center text-maia-ink-soft">{w.toDo}</td>
                  <td className="px-4 py-3 text-center text-maia-ink-soft">{w.inProgress}</td>
                  <td className="px-4 py-3 text-center text-maia-ink-soft">{w.forReview}</td>
                  <td className="px-4 py-3 text-center text-maia-ink-soft">{w.blocked}</td>
                  <td className="px-4 py-3 text-center text-maia-ink-soft">{w.dueToday}</td>
                  <td className={`px-4 py-3 text-center font-semibold ${w.overdue > 0 ? "text-maia-danger" : "text-maia-ink-soft"}`}>
                    {w.overdue}
                  </td>
                  <td className="px-4 py-3 text-center font-display font-bold text-maia-ink">{w.totalActive}</td>
                </tr>
              ))}
              {workloads.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-sm text-maia-ink-soft">
                    No active staff to show.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardHeader title="Reading This Table" />
        <ul className="list-inside list-disc space-y-1.5 text-sm text-maia-ink-soft">
          <li>Counts reflect currently assigned tasks by status — they are not a quality or speed measure.</li>
          <li>A high "Total Active" count usually just means more was assigned to that person, not that they're behind.</li>
          <li>Use the Overdue column to redistribute or follow up on stuck work, not to single out staff.</li>
        </ul>
      </Card>
    </div>
  );
}
