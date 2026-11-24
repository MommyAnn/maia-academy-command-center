import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { adminApi, type AdminOverview } from "../api";
import { Alert, Card, formatDate, formatDuration, PageHeader, Spinner } from "../components/ui";

export function AdminOverviewPage() {
  const [o, setO] = useState<AdminOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    adminApi.overview().then(setO, (e) => setError(e instanceof Error ? e.message : "Failed to load."));
  }, []);
  if (error) return <Alert kind="error" title="Cannot load the admin dashboard">{error}</Alert>;
  if (!o) return <Spinner />;
  const maxDay = Math.max(1, ...o.perDay.map((d) => d.completed + d.failed));

  return (
    <div className="space-y-6">
      <PageHeader title="AI Video Creator — Admin" subtitle="Usage, costs and health of the video generator." />
      {!o.provider.connected && (
        <Alert kind="error" title="Google Veo is not connected">
          Set <code>GOOGLE_AI_API_KEY</code> on the server, then use <Link to="/studio/admin/settings" className="underline">Settings → Check Google connection</Link>.
        </Alert>
      )}
      {!o.provider.generationEnabled && <Alert kind="warning" title="Generation is paused">Customers cannot start new videos until you turn it back on in Settings.</Alert>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Videos generated" value={o.jobs.completed} sub={`${o.jobs.total} requests total`} />
        <Kpi label="Active customers" value={o.customers.active} sub={`${o.customers.total} accounts`} />
        <Kpi label="Success rate" value={o.jobs.successRate === null ? "—" : `${o.jobs.successRate}%`} sub={`${o.jobs.failed} failed · ${o.jobs.inProgress} in progress`} />
        <Kpi label="Est. Google cost (30 days)" value={`$${o.usage.estimatedCostUsdLast30Days.toFixed(2)}`} sub={`${o.usage.secondsGeneratedLast30Days}s of video · all-time $${o.usage.estimatedCostUsdAllTime.toFixed(2)}`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h2 className="font-display font-bold text-vc-ivory">Last 30 days</h2>
          {o.perDay.length === 0 ? (
            <p className="mt-6 text-sm text-vc-muted">No videos yet.</p>
          ) : (
            <div className="mt-5 flex h-40 items-end gap-1">
              {o.perDay.map((d) => (
                <div key={d.day} className="flex flex-1 flex-col justify-end" title={`${new Date(d.day).toLocaleDateString()}: ${d.completed} ready, ${d.failed} failed`}>
                  <div className="rounded-t bg-vc-danger/70" style={{ height: `${(d.failed / maxDay) * 100}%` }} />
                  <div className="bg-vc-gold" style={{ height: `${(d.completed / maxDay) * 100}%` }} />
                </div>
              ))}
            </div>
          )}
          <p className="mt-3 text-xs text-vc-dim">
            <span className="text-vc-gold">■</span> ready <span className="ml-3 text-vc-danger">■</span> failed
          </p>
        </Card>
        <Card>
          <h2 className="font-display font-bold text-vc-ivory">Performance & provider</h2>
          <dl className="mt-4 space-y-2.5 text-sm">
            <Row k="Active model" v={o.provider.activeModel} />
            <Row k="Median time to ready" v={o.timing.medianSeconds === null ? "—" : formatDuration(o.timing.medianSeconds)} />
            <Row k="90% ready within" v={o.timing.p90Seconds === null ? "—" : formatDuration(o.timing.p90Seconds)} />
            <Row k="Sample size" v={`${o.timing.sampleSize} videos`} />
            <Row k="Credits granted" v={String(o.credits.GRANT?.total ?? 0)} />
            <Row k="Credits used" v={String(-(o.credits.GENERATION_CHARGE?.total ?? 0))} />
            <Row k="Credits refunded" v={String(o.credits.GENERATION_REFUND?.total ?? 0)} />
          </dl>
          <p className="mt-3 text-xs text-vc-dim">Costs are estimates from Settings → model pricing. Your real bill is in Google Cloud Billing.</p>
        </Card>
      </div>

      <Card>
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold text-vc-ivory">Recent failures</h2>
          <Link to="/studio/admin/jobs" className="text-sm text-vc-gold">
            All jobs →
          </Link>
        </div>
        {o.recentFailures.length === 0 ? (
          <p className="mt-4 text-sm text-vc-muted">No failed jobs. 🎉</p>
        ) : (
          <ul className="mt-3 divide-y divide-vc-border text-sm">
            {o.recentFailures.map((f) => (
              <li key={f.id} className="py-3">
                <p className="font-medium text-vc-ivory">
                  {f.displayId} · {f.customer} · <span className="text-vc-danger">{f.errorCategory}</span>
                </p>
                <p className="mt-0.5 line-clamp-2 text-xs text-vc-muted">
                  {formatDate(f.createdAt)} — {f.errorMessage}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string | number; sub: string }) {
  return (
    <Card>
      <p className="text-sm text-vc-muted">{label}</p>
      <p className="mt-2 font-display text-3xl font-extrabold text-vc-gold-bright">{value}</p>
      <p className="mt-1 text-xs text-vc-dim">{sub}</p>
    </Card>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-vc-muted">{k}</dt>
      <dd className="break-all text-right font-medium text-vc-ivory">{v}</dd>
    </div>
  );
}
