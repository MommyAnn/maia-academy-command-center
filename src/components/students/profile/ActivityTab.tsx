import { Card, CardHeader } from "@/components/common/Card";
import type { StudentRecord } from "@/types/student";

export function ActivityTab({ student }: { student: StudentRecord }) {
  const entries = [...student.activity].reverse();

  return (
    <Card padded={false}>
      <div className="p-5 sm:p-6">
        <CardHeader title="Student Activity History" />
      </div>
      <div className="overflow-x-auto px-5 pb-5 sm:px-6 sm:pb-6">
        <table className="w-full min-w-[520px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-maia-border text-left text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">
              <th className="py-2.5 pr-3">Action</th>
              <th className="py-2.5 pr-3">Date</th>
              <th className="py-2.5 pr-3">Time</th>
              <th className="py-2.5 pr-3">User</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id} className="border-b border-maia-border/60 last:border-0">
                <td className="py-3 pr-3 text-maia-ink">{entry.action}</td>
                <td className="py-3 pr-3 text-maia-ink-soft">{entry.date}</td>
                <td className="py-3 pr-3 text-maia-ink-soft">{entry.time}</td>
                <td className="py-3 pr-3 text-maia-ink-soft">{entry.user}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
