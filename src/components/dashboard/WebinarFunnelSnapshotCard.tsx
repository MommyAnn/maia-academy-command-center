import { useNavigate } from "react-router-dom";
import { Card, CardHeader } from "@/components/common/Card";

function Tile({ label, value, path, tone }: { label: string; value: number; path: string; tone?: "gold" | "success" | "danger" }) {
  const navigate = useNavigate();
  return (
    <button onClick={() => navigate(path)} className="rounded-xl bg-maia-bg px-3.5 py-3 text-left transition-colors hover:bg-maia-gold-bg">
      <p
        className={`font-display text-xl font-extrabold leading-none ${
          tone === "gold" ? "text-maia-gold-deep" : tone === "success" ? "text-maia-success" : tone === "danger" ? "text-maia-danger" : "text-maia-ink"
        }`}
      >
        {value}
      </p>
      <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-wide text-maia-ink-soft">{label}</p>
    </button>
  );
}

/**
 * Compact summary for the Owner Dashboard (spec section 40) — never the
 * primary source of truth, just click-throughs into the Free Webinar
 * module's own pages, which compute these numbers live.
 */
export function WebinarFunnelSnapshotCard({
  upcomingWebinars,
  registrations,
  attended,
  interested,
  reservationsPaid,
  enrolled,
  followUpsDue,
}: {
  upcomingWebinars: number;
  registrations: number;
  attended: number;
  interested: number;
  reservationsPaid: number;
  enrolled: number;
  followUpsDue: number;
}) {
  return (
    <Card>
      <CardHeader title="Free Webinar Funnel" subtitle="Compact snapshot — see the Free Webinar module for full lead detail." />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Upcoming Webinar" value={upcomingWebinars} path="/webinar/sessions" />
        <Tile label="Registrations" value={registrations} path="/webinar/registrations" />
        <Tile label="Attended" value={attended} path="/webinar/attendance" />
        <Tile label="Interested" value={interested} path="/webinar/pipeline" tone="gold" />
        <Tile label="Reservations Paid" value={reservationsPaid} path="/webinar/pipeline" tone="gold" />
        <Tile label="Enrolled" value={enrolled} path="/webinar/conversion" tone="success" />
        <Tile label="Follow-ups Due" value={followUpsDue} path="/webinar/follow-ups" tone={followUpsDue > 0 ? "danger" : undefined} />
      </div>
    </Card>
  );
}
