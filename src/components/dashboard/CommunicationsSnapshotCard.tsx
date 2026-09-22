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
 * Compact Communications/Automation snapshot for the Owner Dashboard (spec
 * section 63) — deliberately just 4 tiles, never a full Communications
 * dashboard duplicate; click-throughs go to the real pages.
 */
export function CommunicationsSnapshotCard({
  followUpsDue,
  automationsActive,
  communicationFailures,
  ghlSyncErrors,
}: {
  followUpsDue: number;
  automationsActive: number;
  communicationFailures: number;
  ghlSyncErrors: number;
}) {
  return (
    <Card>
      <CardHeader title="Communications & Automation" subtitle="Compact snapshot — see the Communications module for full detail." />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Follow-ups Due" value={followUpsDue} path="/webinar/follow-ups" tone={followUpsDue > 0 ? "gold" : undefined} />
        <Tile label="Automations Active" value={automationsActive} path="/communications/automation" />
        <Tile label="Communication Failures" value={communicationFailures} path="/communications/logs" tone={communicationFailures > 0 ? "danger" : undefined} />
        <Tile label="GHL Sync Errors" value={ghlSyncErrors} path="/communications/sync-logs" tone={ghlSyncErrors > 0 ? "danger" : undefined} />
      </div>
    </Card>
  );
}
