import clsx from "clsx";
import { CheckCircle2, PlugZap, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { adminApi, type AdminSettings } from "../api";
import { Alert, Button, Card, Input, Label, PageHeader, Spinner } from "../components/ui";

type Check = Awaited<ReturnType<typeof adminApi.checkProvider>>;

export function AdminSettingsPage() {
  const [s, setS] = useState<AdminSettings | null>(null);
  const [meta, setMeta] = useState<{ effectiveModel: string; envDefaultModel: string; providerConnected: boolean; emailConfigured: boolean } | null>(null);
  const [pricing, setPricing] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [check, setCheck] = useState<Check | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    adminApi.settings().then(
      (r) => {
        setS(r.settings);
        setMeta(r);
        setPricing(JSON.stringify(r.settings.modelPricing, null, 2));
      },
      (e) => setMsg({ kind: "error", text: e.message }),
    );
  }, []);

  if (!s || !meta) return msg ? <Alert kind="error">{msg.text}</Alert> : <Spinner />;
  const num = (k: keyof AdminSettings) => (e: { target: { value: string } }) => setS({ ...s, [k]: Number(e.target.value) });
  const toggleIn = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const modelPricing = JSON.parse(pricing);
      const r = await adminApi.saveSettings({ ...s!, modelPricing });
      setS(r.settings);
      setMeta((m) => (m ? { ...m, effectiveModel: r.effectiveModel } : m));
      setMsg({ kind: "success", text: "Settings saved. They apply to new videos immediately." });
    } catch (e) {
      setMsg({ kind: "error", text: e instanceof SyntaxError ? "Model pricing is not valid JSON." : e instanceof Error ? e.message : "Save failed." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader title="Settings" subtitle="Credits, limits and the Google Veo model. Changes are audited." />

      <Card>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display font-bold text-vc-ivory">Google Veo connection</h2>
            <p className="text-sm text-vc-muted">
              API key on server: {meta.providerConnected ? <span className="text-vc-success">set</span> : <span className="text-vc-danger">missing</span>} · active model <code className="text-vc-gold">{meta.effectiveModel}</code>
            </p>
          </div>
          <Button
            variant="secondary"
            loading={checking}
            onClick={async () => {
              setChecking(true);
              try {
                setCheck(await adminApi.checkProvider());
              } catch (e) {
                setCheck({ connected: false, message: e instanceof Error ? e.message : "Check failed." });
              } finally {
                setChecking(false);
              }
            }}
          >
            <PlugZap className="h-4 w-4" /> Check Google connection
          </Button>
        </div>
        {check && (
          <div className="mt-4 space-y-3">
            {check.connected ? (
              <Alert kind={check.activeModelAvailable ? "success" : "warning"} title={check.activeModelAvailable ? "Connected — the active model is available to your key." : "Connected, but the active model is NOT in your key's model list."}>
                Pick one of the models below that supports video generation.
              </Alert>
            ) : (
              <Alert kind="error" title={`Not connected (${check.errorCategory ?? "error"})`}>
                {check.message}
              </Alert>
            )}
            {check.models && (
              <ul className="divide-y divide-vc-border rounded-xl border border-vc-border text-sm">
                {check.models.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                    <span className="min-w-0">
                      <span className="block font-mono text-xs text-vc-ivory">{m.id}</span>
                      <span className="block truncate text-xs text-vc-dim">{m.displayName}</span>
                    </span>
                    {m.supportsVideoGeneration ? (
                      <Button size="sm" variant={s.activeModel === m.id ? "primary" : "secondary"} onClick={() => setS({ ...s, activeModel: m.id })}>
                        {s.activeModel === m.id ? "Selected" : "Use this"}
                      </Button>
                    ) : (
                      <span className="text-xs text-vc-dim">not for video</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        <div className="mt-4">
          <Label htmlFor="model" hint={`(blank = server default ${meta.envDefaultModel})`}>Active model ID</Label>
          <Input id="model" value={s.activeModel ?? ""} onChange={(e) => setS({ ...s, activeModel: e.target.value.trim() || null })} placeholder={meta.envDefaultModel} />
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 font-display font-bold text-vc-ivory">Generation</h2>
        <button type="button" role="switch" aria-checked={s.generationEnabled} onClick={() => setS({ ...s, generationEnabled: !s.generationEnabled })} className={clsx("flex w-full items-center gap-3 rounded-xl border p-4 text-left", s.generationEnabled ? "border-vc-success/40" : "border-vc-danger/40")}>
          {s.generationEnabled ? <CheckCircle2 className="h-5 w-5 text-vc-success" /> : <XCircle className="h-5 w-5 text-vc-danger" />}
          <span>
            <span className="block font-semibold text-vc-ivory">{s.generationEnabled ? "Customers can create videos" : "Video creation is PAUSED"}</span>
            <span className="block text-xs text-vc-muted">Pause during provider outages or billing issues. Existing videos stay available.</span>
          </span>
        </button>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="mpu">Max videos in progress per customer</Label>
            <Input id="mpu" type="number" min={1} max={20} value={s.maxActiveJobsPerUser} onChange={num("maxActiveJobsPerUser")} />
          </div>
          <div>
            <Label htmlFor="mg">Max videos at Google at once (all customers)</Label>
            <Input id="mg" type="number" min={1} max={200} value={s.maxActiveJobsGlobal} onChange={num("maxActiveJobsGlobal")} />
          </div>
        </div>
        <div className="mt-4">
          <Label>Video lengths offered</Label>
          <div className="flex gap-2">
            {[4, 6, 8].map((d) => (
              <Button key={d} size="sm" variant={s.allowedDurations.includes(d) ? "primary" : "secondary"} onClick={() => setS({ ...s, allowedDurations: toggleIn(s.allowedDurations, d) })}>
                {d}s
              </Button>
            ))}
          </div>
        </div>
        <div className="mt-4">
          <Label>Quality offered</Label>
          <div className="flex gap-2">
            {["720p", "1080p"].map((r) => (
              <Button key={r} size="sm" variant={s.allowedResolutions.includes(r) ? "primary" : "secondary"} onClick={() => setS({ ...s, allowedResolutions: toggleIn(s.allowedResolutions, r) })}>
                {r}
              </Button>
            ))}
          </div>
          <p className="mt-1 text-xs text-vc-dim">Some Veo models only allow 1080p with 8-second videos; Google rejects other combinations and the customer's credits are refunded.</p>
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 font-display font-bold text-vc-ivory">Credits</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="cpv">Credits per video</Label>
            <Input id="cpv" type="number" min={1} value={s.creditsPerVideo} onChange={num("creditsPerVideo")} />
          </div>
          <div>
            <Label htmlFor="x1080">Extra credits for 1080p</Label>
            <Input id="x1080" type="number" min={0} value={s.extraCreditsFor1080p} onChange={num("extraCreditsFor1080p")} />
          </div>
          <div>
            <Label htmlFor="start">Default starting credits</Label>
            <Input id="start" type="number" min={0} value={s.defaultStartingCredits} onChange={num("defaultStartingCredits")} />
          </div>
        </div>
        <p className="mt-2 text-xs text-vc-dim">Starting credits are applied when you create a new customer (you can override per customer). Changing costs never alters past transactions.</p>
      </Card>

      <Card>
        <h2 className="mb-1 font-display font-bold text-vc-ivory">Model pricing (USD per generated second)</h2>
        <p className="mb-3 text-xs text-vc-muted">Used only for the cost estimates on the Overview. Check current prices at ai.google.dev/gemini-api/docs/pricing — Google bills your Cloud project directly.</p>
        <textarea value={pricing} onChange={(e) => setPricing(e.target.value)} rows={8} spellCheck={false} className="w-full rounded-xl border border-vc-border bg-vc-black p-3 font-mono text-xs text-vc-ivory focus:border-vc-gold focus:outline-none" />
      </Card>

      <Card>
        <h2 className="font-display font-bold text-vc-ivory">Email</h2>
        <p className="mt-1 text-sm text-vc-muted">{meta.emailConfigured ? "Password reset emails are sent automatically." : "No email provider configured: customers who forget their password get a reset link from you (Customers → Manage → Password reset link). Set RESEND_API_KEY and EMAIL_FROM to send emails automatically."}</p>
      </Card>

      {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}
      <Button size="lg" className="w-full" onClick={save} loading={saving}>
        Save settings
      </Button>
    </div>
  );
}
