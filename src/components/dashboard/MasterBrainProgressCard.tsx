import { Card, CardHeader } from "@/components/common/Card";
import type { MasterBrainProgress } from "@/types";

const SEGMENTS: { key: keyof MasterBrainProgress; label: string; color: string }[] = [
  { key: "notStarted", label: "Not Started", color: "#c7c2b3" },
  { key: "inProgress", label: "In Progress", color: "#3b6ea8" },
  { key: "submitted", label: "Submitted", color: "#b3781c" },
  { key: "underReview", label: "Under Review", color: "#c8a44d" },
  { key: "completed", label: "Completed", color: "#2f7d5a" },
];

export function MasterBrainProgressCard({ data }: { data: MasterBrainProgress }) {
  const total = SEGMENTS.reduce((sum, seg) => sum + data[seg.key], 0);

  return (
    <Card>
      <CardHeader title="Master Brain Progress" subtitle={`${total} students tracked`} />

      <div className="mb-5 flex h-3 w-full overflow-hidden rounded-full bg-maia-bg">
        {SEGMENTS.map((seg) => {
          const value = data[seg.key];
          const percent = total === 0 ? 0 : (value / total) * 100;
          return (
            <div
              key={seg.key}
              style={{ width: `${percent}%`, backgroundColor: seg.color }}
              title={`${seg.label}: ${value}`}
            />
          );
        })}
      </div>

      <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {SEGMENTS.map((seg) => (
          <li key={seg.key} className="flex items-center justify-between rounded-lg bg-maia-bg px-3 py-2">
            <span className="flex items-center gap-2 text-sm text-maia-ink-soft">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: seg.color }} />
              {seg.label}
            </span>
            <span className="font-display text-sm font-bold text-maia-ink">{data[seg.key]}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
