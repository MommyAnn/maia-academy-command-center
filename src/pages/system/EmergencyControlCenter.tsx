import { useEffect, useState } from "react";
import { Card, CardHeader } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { ApiError, authApi, safetyApi, type ApiSafetyControl, type SafetyControlKey } from "@/api/client";

// M.A.I.A. Emergency Control Center — Pre-Pilot Safety Hardening.
// Same self-authenticating pattern as every other admin page built
// directly against the real backend this session (server/): this app's
// own login (AuthContext) is a separate, mock, localStorage-only system,
// so this page signs in against the real backend directly. Owner/
// Administrator only by default (the "Emergency Controls" permission
// module) — every route this page calls is server-side RBAC-gated
// regardless of what this page does or doesn't render.

type ConnectionState = "checking" | "signed-out" | "ready" | "unreachable" | "forbidden";

const CONTROL_META: Record<SafetyControlKey, { label: string; description: string; onLabel: string; offLabel: string; onState: string; offState: string }> = {
  CHECKOUT: {
    label: "Commerce Checkout",
    description: "Global kill switch for the self-service Commerce checkout flow. Blocks new checkout sessions only — Finance's manual payment recording is never affected either way.",
    onLabel: "Enabled",
    offLabel: "Disabled",
    onState: "ENABLED",
    offState: "DISABLED",
  },
  GHL_SYNC: {
    label: "GHL Sync",
    description: "Pauses only outbound sync to GoHighLevel. Queued/history records are never deleted, and inbound webhook deliveries are still accepted.",
    onLabel: "Enabled",
    offLabel: "Paused",
    onState: "ENABLED",
    offState: "PAUSED",
  },
  ADS_SYNC: {
    label: "Ads Live API Sync",
    description: "Pauses only the live Meta/Google Ads API sync. CSV import and manual Ads data entry are completely unaffected.",
    onLabel: "Enabled",
    offLabel: "Paused",
    onState: "ENABLED",
    offState: "PAUSED",
  },
  AUTOMATIONS_GLOBAL: {
    label: "Automations",
    description: "A global veto on top of each individual Automation's own status. When paused, no new run starts and no queued run advances — nothing is deleted.",
    onLabel: "Active",
    offLabel: "All Paused",
    onState: "ACTIVE",
    offState: "PAUSED",
  },
  MAINTENANCE_MODE: {
    label: "Maintenance Mode",
    description: "Blocks every non-essential API at the backend level (not just a frontend banner). Health, login/logout, and this Emergency Control Center itself stay reachable.",
    onLabel: "ON",
    offLabel: "OFF",
    onState: "ON",
    offState: "OFF",
  },
};

const DISPLAY_STATUS_TONE: Record<string, "danger" | "warning" | "info" | "neutral" | "success"> = {
  NOT_CONFIGURED: "neutral",
  CONFIGURED_BUT_PAUSED: "warning",
  CONNECTED_AND_ACTIVE: "success",
  DEGRADED: "warning",
  ERROR: "danger",
};

export function EmergencyControlCenter() {
  const [state, setState] = useState<ConnectionState>("checking");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [controls, setControls] = useState<ApiSafetyControl[] | null>(null);
  const [busyKey, setBusyKey] = useState<SafetyControlKey | null>(null);

  async function load() {
    try {
      const res = await safetyApi.status();
      setControls(res.controls);
      setState("ready");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) setState("signed-out");
      else if (err instanceof ApiError && err.status === 403) setState("forbidden");
      else setState("unreachable");
    }
  }

  useEffect(() => {
    async function init() {
      try {
        await authApi.me();
        await load();
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) setState("signed-out");
        else setState("unreachable");
      }
    }
    init();
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError(null);
    try {
      await authApi.login(email, password);
      setState("checking");
      await load();
    } catch (err) {
      setLoginError(err instanceof ApiError ? err.message : "Could not reach the real backend.");
    }
  }

  async function handleToggle(control: ApiSafetyControl) {
    const meta = CONTROL_META[control.key];
    const isOn = control.state === meta.onState;
    const targetState = isOn ? meta.offState : meta.onState;
    const targetLabel = isOn ? meta.offLabel : meta.onLabel;

    // Two-step confirmation (spec Task 6: "Do not make accidental
    // single-click activation possible") — a plain click can never change
    // a control; the operator must explicitly confirm AND type a reason,
    // both of which the backend also independently requires and rejects
    // without.
    const confirmed = window.confirm(`Change "${meta.label}" from "${control.state}" to "${targetState}" (${targetLabel})?\n\nThis takes effect immediately and is recorded in the Activity Log.`);
    if (!confirmed) return;

    const reason = window.prompt(`Reason for this change (required, shown in the Activity Log):`);
    if (!reason || reason.trim().length < 3) {
      window.alert("A reason of at least 3 characters is required — no change was made.");
      return;
    }

    setBusyKey(control.key);
    try {
      await safetyApi.setControl(control.key, targetState, reason.trim());
      await load();
    } catch (err) {
      window.alert(err instanceof ApiError ? err.message : "Could not change this control.");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-lg font-bold text-maia-ink">Emergency Control Center</h2>
        <p className="text-sm text-maia-ink-soft">Owner/Administrator only. Every change here is server-enforced immediately, requires explicit confirmation and a reason, and is permanently audit-logged.</p>
      </div>

      {state === "checking" && <Card>Checking connection to the real backend…</Card>}

      {state === "unreachable" && (
        <Card className="border-dashed">
          <p className="text-sm text-maia-ink-soft">The real backend (server/) is not reachable from this browser. This is expected unless it has been started separately.</p>
        </Card>
      )}

      {state === "forbidden" && (
        <Card className="border-dashed">
          <p className="text-sm text-maia-ink-soft">Signed in, but this account does not hold the &quot;Emergency Controls&quot; permission — by default, only Owner/Administrator do.</p>
        </Card>
      )}

      {state === "signed-out" && (
        <Card>
          <CardHeader title="Sign in to the real backend" subtitle="This is a separate session from this app's own demo login." />
          <form onSubmit={handleLogin} className="mt-3 flex flex-col gap-3 sm:max-w-sm">
            <input type="email" required placeholder="Staff email" value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-lg border border-maia-border px-3 py-2 text-sm" />
            <input type="password" required placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="rounded-lg border border-maia-border px-3 py-2 text-sm" />
            {loginError && <p className="text-xs font-semibold text-maia-danger">{loginError}</p>}
            <button type="submit" className="rounded-lg bg-maia-gold-deep px-3 py-2 text-sm font-bold text-white">
              Sign in
            </button>
          </form>
        </Card>
      )}

      {state === "ready" && controls && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {controls.map((control) => {
            const meta = CONTROL_META[control.key];
            const isOn = control.state === meta.onState;
            return (
              <Card key={control.key}>
                <div className="flex items-start justify-between gap-3">
                  <CardHeader title={meta.label} subtitle={meta.description} />
                  <Badge tone={isOn ? "success" : control.key === "MAINTENANCE_MODE" ? "danger" : "warning"}>{isOn ? meta.onLabel : meta.offLabel}</Badge>
                </div>

                {control.displayStatus && (
                  <div className="mt-2">
                    <Badge tone={DISPLAY_STATUS_TONE[control.displayStatus] ?? "neutral"}>{control.displayStatus.replace(/_/g, " ")}</Badge>
                  </div>
                )}

                <div className="mt-3 space-y-1 text-xs text-maia-ink-soft">
                  <p>
                    Last changed by: <span className="font-semibold text-maia-ink">{control.updatedByName ?? "System default (no manual change yet)"}</span>
                  </p>
                  <p>Last changed at: {new Date(control.updatedAt).toLocaleString()}</p>
                  {control.reason && <p>Reason: &quot;{control.reason}&quot;</p>}
                </div>

                <button
                  onClick={() => handleToggle(control)}
                  disabled={busyKey === control.key}
                  className="mt-4 rounded-lg border border-maia-border px-4 py-2 text-sm font-bold text-maia-ink disabled:opacity-50"
                >
                  {busyKey === control.key ? "Applying…" : `Switch to ${isOn ? meta.offLabel : meta.onLabel}`}
                </button>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
