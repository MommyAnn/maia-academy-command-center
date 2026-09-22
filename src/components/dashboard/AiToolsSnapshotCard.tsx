import { useNavigate } from "react-router-dom";
import { Card, CardHeader } from "@/components/common/Card";

function Tile({ label, value, path, tone }: { label: string; value: number; path: string; tone?: "gold" | "danger" }) {
  const navigate = useNavigate();
  return (
    <button onClick={() => navigate(path)} className="rounded-xl bg-maia-bg px-3.5 py-3 text-left transition-colors hover:bg-maia-gold-bg">
      <p className={`font-display text-xl font-extrabold leading-none ${tone === "gold" ? "text-maia-gold-deep" : tone === "danger" ? "text-maia-danger" : "text-maia-ink"}`}>{value}</p>
      <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-wide text-maia-ink-soft">{label}</p>
    </button>
  );
}

/**
 * Compact AI Business Tools snapshot for the Owner Dashboard (Step 12) —
 * deliberately just 4 tiles, never a full AI Dashboard duplicate; click-
 * throughs go to the real AI Business Tools pages.
 */
export function AiToolsSnapshotCard({
  activeUsers,
  totalGenerations,
  failedGenerations,
  activeProjects,
}: {
  activeUsers: number;
  totalGenerations: number;
  failedGenerations: number;
  activeProjects: number;
}) {
  return (
    <Card>
      <CardHeader title="AI Business Tools" subtitle="Compact snapshot — see the AI Dashboard for full detail." />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Active AI Users" value={activeUsers} path="/ai-tools/dashboard" />
        <Tile label="Total Generations" value={totalGenerations} path="/ai-tools/dashboard" />
        <Tile label="Failed Generations" value={failedGenerations} path="/ai-tools/activity" tone={failedGenerations > 0 ? "danger" : undefined} />
        <Tile label="Active Projects" value={activeProjects} path="/ai-tools/projects" />
      </div>
    </Card>
  );
}
