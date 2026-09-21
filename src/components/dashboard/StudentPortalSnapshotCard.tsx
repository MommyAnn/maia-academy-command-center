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
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
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

export function StudentPortalSnapshotCard({
  portalAccountsActive,
  neverLoggedIn,
  pendingStudentActions,
  openSupportRequests,
  masterBrainNotStarted,
  requirementsMissing,
}: {
  portalAccountsActive: number;
  neverLoggedIn: number;
  pendingStudentActions: number;
  openSupportRequests: number;
  masterBrainNotStarted: number;
  requirementsMissing: number;
}) {
  return (
    <Card>
      <CardHeader title="Student Portal" subtitle="Live from student portal accounts and their requests." />
      <TileGrid
        tiles={[
          { label: "Portal Accounts Active", value: portalAccountsActive, path: "/students/all", tone: "success" },
          { label: "Never Logged In", value: neverLoggedIn, path: "/students/all", tone: "warning" },
          { label: "Pending Student Actions", value: pendingStudentActions, path: "/students/all", tone: "warning" },
          { label: "Open Support Requests", value: openSupportRequests, path: "/communication/support-requests", tone: openSupportRequests > 0 ? "danger" : undefined },
          { label: "Master Brain Not Started", value: masterBrainNotStarted, path: "/students/all?masterBrain=Not%20Started" },
          { label: "Requirements Missing", value: requirementsMissing, path: "/students/all?requirements=For%20Verification" },
        ]}
      />
    </Card>
  );
}
