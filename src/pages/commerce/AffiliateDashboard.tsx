import { useEffect, useState } from "react";
import { Card, CardHeader } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { ApiError, authApi, commerceApi, type ApiAffiliateMe } from "@/api/client";

// M.A.I.A. Affiliate Center — self-service dashboard (Production Phase 17,
// spec sections 78-79). Same self-authenticating pattern as every other
// page this session has built directly against server/. Only ever shows
// this affiliate's OWN aggregates — never another customer's payment
// information or private data (spec section 79).

type ConnectionState = "checking" | "signed-out" | "no-affiliate" | "ready" | "unreachable";

const STATUS_TONE: Record<string, "danger" | "warning" | "info" | "neutral" | "success"> = {
  APPLIED: "neutral",
  PENDING_REVIEW: "warning",
  ACTIVE: "success",
  SUSPENDED: "danger",
  REJECTED: "danger",
  INACTIVE: "neutral",
};

export function AffiliateDashboard() {
  const [state, setState] = useState<ConnectionState>("checking");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [data, setData] = useState<ApiAffiliateMe | null>(null);
  const [applying, setApplying] = useState(false);

  async function load() {
    try {
      const res = await commerceApi.myAffiliateDashboard();
      setData(res);
      setState("ready");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) setState("signed-out");
      else if (err instanceof ApiError && err.status === 404) setState("no-affiliate");
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

  async function handleApply() {
    setApplying(true);
    try {
      await commerceApi.applyAsAffiliate();
      await load();
    } catch (err) {
      window.alert(err instanceof ApiError ? err.message : "Could not submit application.");
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-lg font-bold text-maia-ink">Affiliate Dashboard</h2>
        <p className="text-sm text-maia-ink-soft">Every number below is a real, counted event — never an estimate.</p>
      </div>

      {state === "checking" && <Card>Checking connection to the real backend…</Card>}

      {state === "unreachable" && (
        <Card className="border-dashed">
          <p className="text-sm text-maia-ink-soft">The real backend (server/) is not reachable from this browser. This is expected unless it has been started separately.</p>
        </Card>
      )}

      {state === "signed-out" && (
        <Card>
          <CardHeader title="Sign in to the real backend" subtitle="This is a separate session from this app's own demo login." />
          <form onSubmit={handleLogin} className="mt-3 flex flex-col gap-3 sm:max-w-sm">
            <input type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-lg border border-maia-border px-3 py-2 text-sm" />
            <input type="password" required placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="rounded-lg border border-maia-border px-3 py-2 text-sm" />
            {loginError && <p className="text-xs font-semibold text-maia-danger">{loginError}</p>}
            <button type="submit" className="rounded-lg bg-maia-gold-deep px-3 py-2 text-sm font-bold text-white">
              Sign in
            </button>
          </form>
        </Card>
      )}

      {state === "no-affiliate" && (
        <Card>
          <CardHeader title="Become an M.A.I.A. Affiliate" subtitle="Share your referral link and earn a real, tracked commission on verified purchases." />
          <button onClick={handleApply} disabled={applying} className="mt-3 rounded-lg bg-maia-gold-deep px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
            {applying ? "Applying…" : "Apply Now"}
          </button>
        </Card>
      )}

      {state === "ready" && data && (
        <>
          <Card>
            <CardHeader title="Your Affiliate Account" subtitle={`${data.affiliate.affiliateDisplayId}`} />
            <div className="mt-2 flex items-center gap-2">
              <Badge tone={STATUS_TONE[data.affiliate.status] ?? "neutral"}>{data.affiliate.status.replace(/_/g, " ")}</Badge>
              {data.affiliate.status !== "ACTIVE" && <span className="text-xs text-maia-ink-soft">Commission eligibility begins once an Admin approves your application.</span>}
            </div>
            <p className="mt-3 text-xs font-bold uppercase tracking-wider text-maia-ink-soft">Referral Link</p>
            <p className="mt-1 rounded-lg border border-maia-border bg-maia-bg px-3 py-2 font-mono text-sm text-maia-ink">{data.referralLink}</p>
          </Card>

          <Card>
            <CardHeader title="Referral Activity" subtitle="Real counted events — clicks, leads, orders, and verified purchases (spec section 66)." />
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Fact label="Clicks" value={data.stats.clicks} />
              <Fact label="Leads" value={data.stats.leads} />
              <Fact label="Orders" value={data.stats.orders} />
              <Fact label="Verified Purchases" value={data.stats.verifiedPurchases} />
            </div>
          </Card>

          <Card>
            <CardHeader title="Commissions" subtitle="Pending -> Payable -> Paid. Payouts always require Admin/Finance approval — nothing here is auto-sent (spec section 88)." />
            <div className="mt-3 grid grid-cols-3 gap-3">
              <Fact label="Pending" value={data.commissions.pending} money />
              <Fact label="Payable" value={data.commissions.payable} money />
              <Fact label="Paid" value={data.commissions.paid} money />
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function Fact({ label, value, money }: { label: string; value: number; money?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-maia-ink-soft">{label}</p>
      <p className="mt-0.5 text-sm font-extrabold text-maia-ink">{money ? `₱${value.toLocaleString()}` : value.toLocaleString()}</p>
    </div>
  );
}
