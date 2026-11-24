import { RotateCcw, Undo2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { adminApi, media, type AdminJob, type CreditTransaction } from "../api";
import { Alert, Button, Card, formatDate, Input, PageHeader, Select, Spinner, StatusBadge, STYLE_LABEL } from "../components/ui";

export function AdminJobsPage() {
  const [jobs, setJobs] = useState<AdminJob[] | null>(null);
  const [status, setStatus] = useState("ALL");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setJobs((await adminApi.jobs({ status, search: search.trim() || undefined })).jobs);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load jobs.");
    }
  }, [status, search]);
  useEffect(() => {
    const t = setTimeout(load, 250);
    const i = setInterval(load, 10_000);
    return () => {
      clearTimeout(t);
      clearInterval(i);
    };
  }, [load]);

  return (
    <div>
      <PageHeader
        title="Video Jobs"
        subtitle="Every generation request, its real provider status, cost estimate and errors."
        action={
          <Button variant="secondary" onClick={async () => { await adminApi.runWorker(); void load(); }}>
            Run worker now
          </Button>
        }
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_200px]">
        <Input type="search" placeholder="Search job ID or customer…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="ALL">All statuses</option>
          <option value="IN_PROGRESS">In progress</option>
          <option value="COMPLETED">Completed</option>
          <option value="FAILED">Failed</option>
        </Select>
      </div>
      {error && <Alert kind="error">{error}</Alert>}
      {!jobs ? (
        <Spinner />
      ) : jobs.length === 0 ? (
        <Card className="text-center text-sm text-vc-muted">No jobs.</Card>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-vc-border">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-vc-surface text-xs uppercase tracking-wider text-vc-dim">
              <tr>
                <th className="px-4 py-3">Job</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Style</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Credits</th>
                <th className="px-4 py-3 text-right">Est. cost</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-vc-border">
              {jobs.map((j) => (
                <tr key={j.id} className="cursor-pointer bg-vc-black hover:bg-vc-surface" onClick={() => setOpenId(j.id)}>
                  <td className="px-4 py-3 font-mono text-xs text-vc-ivory">
                    {j.displayId}
                    {j.deletedAt && <span className="ml-1 text-vc-dim">(deleted)</span>}
                  </td>
                  <td className="px-4 py-3 text-vc-ivory">{j.customer.fullName}</td>
                  <td className="px-4 py-3 text-vc-muted">
                    {STYLE_LABEL[j.style]} · {j.durationSeconds}s · {j.resolution}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={j.status} />
                    {j.errorCategory && <span className="ml-2 text-xs text-vc-danger">{j.errorCategory}</span>}
                  </td>
                  <td className="px-4 py-3 text-right text-vc-muted">
                    {j.creditsCharged}
                    {j.creditStatus === "REFUNDED" && <span className="text-vc-success"> ↩</span>}
                  </td>
                  <td className="px-4 py-3 text-right text-vc-muted">{j.estimatedCostUsd === null ? "—" : `$${j.estimatedCostUsd.toFixed(2)}`}</td>
                  <td className="px-4 py-3 text-xs text-vc-muted">{formatDate(j.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {openId && <JobDrawer id={openId} onClose={() => setOpenId(null)} onChanged={load} />}
    </div>
  );
}

function JobDrawer({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const [data, setData] = useState<{ job: AdminJob; ledger: CreditTransaction[] } | null>(null);
  const [msg, setMsg] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const load = useCallback(() => adminApi.job(id).then(setData, (e) => setMsg({ kind: "error", text: e.message })), [id]);
  useEffect(() => {
    void load();
  }, [load]);
  const j = data?.job;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70" role="dialog" aria-modal="true">
      <div className="h-full w-full max-w-xl overflow-y-auto border-l border-vc-border bg-vc-surface p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold text-vc-ivory">{j?.displayId ?? "Job"}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-vc-muted hover:bg-vc-raised">
            <X className="h-5 w-5" />
          </button>
        </div>
        {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}
        {!j ? (
          <Spinner />
        ) : (
          <div className="space-y-5 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={j.status} />
              <span className="text-vc-muted">{j.statusMessage}</span>
            </div>
            {j.media?.videoUrl && <video src={media(j.media.videoUrl)} controls playsInline className="max-h-96 w-full rounded-xl bg-black" />}
            <div className="grid grid-cols-2 gap-3">
              {j.photoUrl && (
                <figure>
                  <img src={media(j.photoUrl)} alt="Product photo" className="aspect-square w-full rounded-xl bg-white object-contain" />
                  <figcaption className="mt-1 text-xs text-vc-dim">Uploaded photo</figcaption>
                </figure>
              )}
              {j.firstFrameUrl && (
                <figure>
                  <img src={media(j.firstFrameUrl)} alt="First frame" className="aspect-square w-full rounded-xl bg-black object-contain" />
                  <figcaption className="mt-1 text-xs text-vc-dim">First frame sent to Google</figcaption>
                </figure>
              )}
            </div>
            <dl className="grid grid-cols-[130px_1fr] gap-x-3 gap-y-2">
              <dt className="text-vc-dim">Customer</dt>
              <dd className="text-vc-ivory">{j.customer.fullName}</dd>
              <dt className="text-vc-dim">Model</dt>
              <dd className="break-all font-mono text-xs text-vc-ivory">{j.model}</dd>
              <dt className="text-vc-dim">Settings</dt>
              <dd className="text-vc-ivory">
                {STYLE_LABEL[j.style]} · {j.aspectRatio} · {j.durationSeconds}s · {j.resolution} · {j.language}
              </dd>
              <dt className="text-vc-dim">Operation</dt>
              <dd className="break-all font-mono text-xs text-vc-muted">{j.operationName ?? "—"}</dd>
              <dt className="text-vc-dim">Attempts</dt>
              <dd className="text-vc-ivory">
                {j.submitAttempts} submit · {j.pollFailures ?? 0} poll errors
              </dd>
              <dt className="text-vc-dim">Est. cost</dt>
              <dd className="text-vc-ivory">{j.estimatedCostUsd === null ? "—" : `$${j.estimatedCostUsd.toFixed(4)}`}</dd>
              <dt className="text-vc-dim">Created</dt>
              <dd className="text-vc-ivory">{formatDate(j.createdAt)}</dd>
              <dt className="text-vc-dim">Finished</dt>
              <dd className="text-vc-ivory">{formatDate(j.completedAt)}</dd>
            </dl>
            {j.errorMessage && (
              <Alert kind="error" title={j.errorCategory ?? "Error"}>
                <span className="break-words font-mono text-xs">{j.errorMessage}</span>
              </Alert>
            )}
            <details className="rounded-xl border border-vc-border p-3">
              <summary className="cursor-pointer font-semibold text-vc-ivory">AI prompt sent to Google</summary>
              <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-vc-muted">{j.prompt}</p>
              <p className="mt-2 text-xs text-vc-dim">Negative: {j.negativePrompt}</p>
            </details>
            <div>
              <p className="mb-1 font-semibold text-vc-ivory">Credit ledger for this job</p>
              {data.ledger.map((l) => (
                <p key={l.id} className="text-xs text-vc-muted">
                  {formatDate(l.createdAt)} · {l.type} · {l.amount > 0 ? "+" : ""}
                  {l.amount} → balance {l.balanceAfter}
                </p>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {j.status === "FAILED" && (
                <Button
                  onClick={async () => {
                    try {
                      await adminApi.retryJob(j.id);
                      setMsg({ kind: "success", text: "Re-queued at no charge to the customer." });
                      void load();
                      onChanged();
                    } catch (e) {
                      setMsg({ kind: "error", text: e instanceof Error ? e.message : "Retry failed." });
                    }
                  }}
                >
                  <RotateCcw className="h-4 w-4" /> Retry free of charge
                </Button>
              )}
              {j.creditStatus === "CHARGED" && (j.status === "COMPLETED" || j.status === "FAILED") && (
                <Button
                  variant="secondary"
                  onClick={async () => {
                    const reason = window.prompt("Reason for refunding this video's credits?");
                    if (!reason) return;
                    try {
                      await adminApi.refundJob(j.id, reason);
                      setMsg({ kind: "success", text: "Credits refunded." });
                      void load();
                      onChanged();
                    } catch (e) {
                      setMsg({ kind: "error", text: e instanceof Error ? e.message : "Refund failed." });
                    }
                  }}
                >
                  <Undo2 className="h-4 w-4" /> Refund credits
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
