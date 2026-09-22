import { useState } from "react";
import { AlertTriangle, CheckCircle2, PlugZap, Webhook } from "lucide-react";
import { Card, CardHeader } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { SelectField } from "@/components/common/SelectField";
import { TextField } from "@/components/common/TextField";
import { InfoTooltip } from "@/components/common/InfoTooltip";
import { useCommunicationsStore } from "@/data/communicationsStore";
import { INTEGRATION_MODES } from "@/types/communications";
import type { IntegrationMode } from "@/types/communications";

export function GhlIntegration() {
  const { contactSyncs, syncLogs, communicationLogs, webhookLog, integrationSettings, setIntegrationSettings, simulateInboundWebhook } = useCommunicationsStore();
  const [webhookEventType, setWebhookEventType] = useState("Contact Updated");

  const lastSuccessfulSync = [...syncLogs].filter((s) => s.status === "Success").sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))[0];
  const failedSyncs = syncLogs.filter((s) => s.status === "Failed" || s.status === "Needs Review").length;
  const retryPending = syncLogs.filter((s) => s.status === "Retry Pending").length;
  const possibleDuplicates = contactSyncs.filter((c) => c.possibleDuplicate).length;
  const commFailures = communicationLogs.filter((c) => c.status === "Failed").length;
  const totalSynced = contactSyncs.filter((c) => c.lastSyncStatus === "Synced").length;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-lg font-bold text-maia-ink">GHL Integration</h2>
        <p className="text-sm text-maia-ink-soft">Connection status and sync health — see Integration Settings for field/tag/workflow mapping.</p>
      </div>

      {integrationSettings.mode === "Disconnected" && (
        <div className="flex items-center gap-2.5 rounded-2xl border border-maia-danger/30 bg-maia-danger-bg px-4 py-3.5 text-sm font-semibold text-maia-danger">
          <AlertTriangle size={16} />
          GHL NOT CONNECTED — every sync/send below will be recorded as a failure until a mode other than Disconnected is selected. No real GoHighLevel
          credentials exist in this build even outside Disconnected mode — see the notice below.
        </div>
      )}

      <Card>
        <CardHeader title="Connection" action={<Badge tone={integrationSettings.mode === "Disconnected" ? "danger" : "success"}>{integrationSettings.mode}</Badge>} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField
            label="Integration Mode"
            value={integrationSettings.mode}
            onChange={(e) => setIntegrationSettings({ mode: e.target.value as IntegrationMode })}
            options={INTEGRATION_MODES.map((m) => ({ value: m, label: m }))}
          />
          <TextField
            label="Location Label (display only, not a credential)"
            value={integrationSettings.locationLabel}
            onChange={(e) => setIntegrationSettings({ locationLabel: e.target.value })}
            placeholder="e.g. M.A.I.A. Academy — Main Location"
          />
          <TextField
            label="Webhook URL Label (display only)"
            value={integrationSettings.webhookUrlLabel}
            onChange={(e) => setIntegrationSettings({ webhookUrlLabel: e.target.value })}
            placeholder="e.g. https://your-backend.example.com/webhooks/ghl"
          />
          <TextField label="Retry Limit" type="number" value={String(integrationSettings.retryLimit)} onChange={(e) => setIntegrationSettings({ retryLimit: Number(e.target.value) || 1 })} />
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-xs text-maia-ink-soft">
          <InfoTooltip text="No real GHL API token exists anywhere in this frontend build. A production integration stores credentials server-side only — never here, never in localStorage, never shown to an Admin user (spec section 49)." />
          No API credentials are stored or displayed here — none exist in this build.
        </p>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <HealthTile icon={<PlugZap size={16} />} label="Contacts Synced" value={totalSynced} />
        <HealthTile icon={<AlertTriangle size={16} />} label="Failed Syncs" value={failedSyncs} tone={failedSyncs > 0 ? "danger" : undefined} />
        <HealthTile icon={<AlertTriangle size={16} />} label="Retry Pending" value={retryPending} tone={retryPending > 0 ? "warning" : undefined} />
        <HealthTile icon={<AlertTriangle size={16} />} label="Communication Failures" value={commFailures} tone={commFailures > 0 ? "danger" : undefined} />
      </div>

      <Card>
        <CardHeader title="Sync Health" subtitle={lastSuccessfulSync ? `Last successful sync: ${new Date(lastSuccessfulSync.occurredAt).toLocaleString("en-PH")}` : "No successful sync yet."} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-maia-bg px-4 py-3">
            <p className="font-display text-xl font-extrabold text-maia-ink">{contactSyncs.length}</p>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-maia-ink-soft">Total Contact Records</p>
          </div>
          <div className="rounded-xl bg-maia-bg px-4 py-3">
            <p className="font-display text-xl font-extrabold text-maia-warning">{possibleDuplicates}</p>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-maia-ink-soft">Possible Duplicates Flagged</p>
          </div>
          <div className="rounded-xl bg-maia-bg px-4 py-3">
            <p className="font-display text-xl font-extrabold text-maia-ink">{webhookLog.length}</p>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-maia-ink-soft">Webhook Deliveries Logged</p>
          </div>
        </div>
      </Card>

      <Card>
        <div className="mb-2 flex items-center gap-1.5">
          <CardHeader title="Inbound Webhook Simulator" />
          <InfoTooltip text="No real webhook endpoint exists — this demonstrates the idempotent-processing architecture (signature check, duplicate-delivery detection) a real server-side handler would need (spec sections 52-53, 57, 70)." />
        </div>
        <div className="flex flex-wrap items-end gap-2.5">
          <div className="min-w-[220px]">
            <SelectField
              label="Simulated Event Type"
              value={webhookEventType}
              onChange={(e) => setWebhookEventType(e.target.value)}
              options={["Contact Created", "Contact Updated", "Tag Changed", "Communication Preference Changed"].map((v) => ({ value: v, label: v }))}
            />
          </div>
          <Button variant="secondary" onClick={() => simulateInboundWebhook(webhookEventType)}>
            <Webhook size={14} />
            SIMULATE DELIVERY
          </Button>
          {webhookLog[0] && (
            <Button variant="secondary" onClick={() => simulateInboundWebhook(webhookLog[0].eventType, webhookLog[0].webhookId)}>
              RE-DELIVER LAST (test duplicate handling)
            </Button>
          )}
        </div>
        <div className="mt-4 flex flex-col gap-2">
          {webhookLog.slice(0, 8).map((w) => (
            <div key={w.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-maia-bg px-3 py-2.5 text-sm">
              <div>
                <p className="font-medium text-maia-ink">{w.eventType} <span className="font-mono text-xs text-maia-ink-soft">({w.webhookId})</span></p>
                <p className="text-xs text-maia-ink-soft">{w.payloadSummary}</p>
              </div>
              <div className="flex items-center gap-1.5">
                {w.signatureVerified ? <Badge tone="success"><CheckCircle2 size={11} />Verified</Badge> : <Badge tone="danger">Unverified</Badge>}
                {w.duplicate ? <Badge tone="warning">Duplicate — Skipped</Badge> : <Badge tone="success">Processed</Badge>}
              </div>
            </div>
          ))}
          {webhookLog.length === 0 && <p className="text-xs text-maia-ink-soft">No webhook deliveries logged yet.</p>}
        </div>
      </Card>
    </div>
  );
}

function HealthTile({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone?: "danger" | "warning" }) {
  return (
    <div className="rounded-2xl border border-maia-border bg-maia-surface px-4 py-4">
      <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${tone === "danger" ? "bg-maia-danger-bg text-maia-danger" : tone === "warning" ? "bg-maia-warning-bg text-maia-warning" : "bg-maia-bg text-maia-ink-soft"}`}>
        {icon}
      </div>
      <p className="mt-2.5 font-display text-xl font-extrabold text-maia-ink">{value}</p>
      <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-maia-ink-soft">{label}</p>
    </div>
  );
}
