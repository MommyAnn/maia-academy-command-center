import { useNavigate } from "react-router-dom";
import { Card, CardHeader } from "@/components/common/Card";

interface Tile {
  label: string;
  value: number | string;
  path: string;
  tone?: "danger" | "warning" | "success";
}

function TileGrid({ tiles }: { tiles: Tile[] }) {
  const navigate = useNavigate();
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {tiles.map((tile) => (
        <button
          key={tile.label}
          onClick={() => navigate(tile.path)}
          className="rounded-xl bg-maia-bg px-3.5 py-3 text-left transition-colors hover:bg-maia-gold-bg"
        >
          <p
            className={`font-display text-xl font-extrabold leading-none ${
              tile.tone === "danger" ? "text-maia-danger" : tile.tone === "warning" ? "text-maia-warning" : tile.tone === "success" ? "text-maia-success" : "text-maia-ink"
            }`}
          >
            {tile.value}
          </p>
          <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-wide text-maia-ink-soft">{tile.label}</p>
        </button>
      ))}
    </div>
  );
}

export function TrainingAttendanceSnapshotCard({
  upcomingSessions,
  sessionsThisMonth,
  expectedToday,
  checkedInToday,
  absentToday,
  certsForPrep,
  certsReady,
  certsIssued,
}: {
  upcomingSessions: number;
  sessionsThisMonth: number;
  expectedToday: number;
  checkedInToday: number;
  absentToday: number;
  certsForPrep: number;
  certsReady: number;
  certsIssued: number;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <Card>
        <CardHeader title="Training" subtitle="Live from Training Sessions." />
        <TileGrid
          tiles={[
            { label: "Upcoming Sessions", value: upcomingSessions, path: "/training/sessions" },
            { label: "Sessions This Month", value: sessionsThisMonth, path: "/training/sessions" },
          ]}
        />
      </Card>
      <Card>
        <CardHeader title="Today's Attendance" subtitle="Live from today's training sessions." />
        <TileGrid
          tiles={[
            { label: "Expected Students", value: expectedToday, path: "/training/attendance" },
            { label: "Checked In", value: checkedInToday, path: "/training/attendance", tone: "success" },
            { label: "Absent", value: absentToday, path: "/training/attendance", tone: "danger" },
          ]}
        />
      </Card>
      <Card>
        <CardHeader title="Certificates" subtitle="Live from the Certificate module." />
        <TileGrid
          tiles={[
            { label: "For Preparation", value: certsForPrep, path: "/training/certificates", tone: "warning" },
            { label: "Ready", value: certsReady, path: "/training/certificates" },
            { label: "Issued", value: certsIssued, path: "/training/certificates", tone: "success" },
          ]}
        />
      </Card>
    </div>
  );
}
