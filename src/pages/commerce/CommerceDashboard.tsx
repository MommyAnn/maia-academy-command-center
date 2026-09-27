import { useEffect, useState } from "react";
import { Card, CardHeader } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { ApiError, authApi, commerceApi, type ApiCommerceDashboard, type ApiRefundRequest, type ApiAffiliate } from "@/api/client";

// M.A.I.A. Commerce & Growth Engine — Admin Commerce Dashboard
// (Production Phase 17, spec sections 90, 106-107). Same disclosed
// limitation as every other admin module built directly against the real
// backend this session: this app's own login (AuthContext) is a separate,
// mock, localStorage-only system, so this page signs in against the real
// backend (server/) directly.
//
// This build covers the real, tested backbone: the dashboard's live KPIs,
// refund review/process, and affiliate application review. It deliberately
// does NOT yet include every one of the spec's 20 Commerce sections as a
// dedicated screen (Orders list, Coupons builder, Payout Batch builder UI,
// Growth Analytics charts) — those real backend routes already exist and
// are tested (server/src/commerce/*, server/tests/phase17-commerce.test.ts)
// but have no dedicated screen yet.

type ConnectionState = "checking" | "signed-out" | "ready" | "unreachable" | "forbidden";

const REFUND_STATUS_TONE: Record<string, "danger" | "warning" | "info" | "neutral" | "success"> = {
  REQUESTED: "warning",
  UNDER_REVIEW: "info",
  APPROVED: "success",
  REJECTED: "danger",
  PROCESSING: "info",
  REFUNDED: "success",
  FAILED: "danger",
};

const AFFILIATE_STATUS_TONE: Record<string, "danger" | "warning" | "info" | "neutral" | "success"> = {
  APPLIED: "neutral",
  PENDING_REVIEW: "warning",
  ACTIVE: "success",
  SUSPENDED: "danger",
  REJECTED: "danger",
  INACTIVE: "neutral",
};

export function CommerceDashboard() {
  const [state, setState] = useState<ConnectionState>("checking");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);

  const [dashboard, setDashboard] = useState<ApiCommerceDashboard | null>(null);
  const [refunds, setRefunds] = useState<ApiRefundRequest[]>([]);
  const [affiliates, setAffiliates] = useState<(ApiAffiliate & { person: { fullName: string } })[]>([]);

  async function loadAll() {
    try {
      const [dashRes, refundsRes, affiliatesRes] = await Promise.all([commerceApi.dashboard(), commerceApi.refundRequests("REQUESTED"), commerceApi.adminAffiliates()]);
      setDashboard(dashRes);
      setRefunds(refundsRes.refundRequests);
      setAffiliates(affiliatesRes.affiliates);
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
        await loadAll();
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
      await loadAll();
    } catch (err) {
      setLoginError(err instanceof ApiError ? err.message : "Could not reach the real backend.");
    }
  }

  async function handleReviewRefund(id: string, decision: "APPROVED" | "REJECTED") {
    try {
      await commerceApi.reviewRefund(id, decision);
      await loadAll();
    } catch (err) {
      window.alert(err instanceof ApiError ? err.message : "Could not review refund.");
    }
  }

  async function handleProcessRefund(id: string) {
    const accessPolicy = window.confirm("Revoke the Student's access as part of this refund? Click Cancel to keep access active.") ? "REVOKE_ACCESS" : "RETAIN_ACCESS";
    const providerRefundRef = window.prompt("Reference for this refund (e.g. bank transfer ref):") || undefined;
    try {
      await commerceApi.processRefund(id, accessPolicy, providerRefundRef);
      await loadAll();
    } catch (err) {
      window.alert(err instanceof ApiError ? err.message : "Could not process refund. It may need review/approval first.");
    }
  }

  async function handleAffiliateStatus(id: string, status: string) {
    try {
      await commerceApi.setAffiliateStatus(id, status);
      await loadAll();
    } catch (err) {
      window.alert(err instanceof ApiError ? err.message : "Could not update affiliate status.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-lg font-bold text-maia-ink">M.A.I.A. Commerce</h2>
        <p className="text-sm text-maia-ink-soft">Real Orders, real verified revenue, real human-approved refunds and payouts — never simulated or estimated.</p>
      </div>

      {state === "checking" && <Card>Checking connection to the real backend…</Card>}

      {state === "unreachable" && (
        <Card className="border-dashed">
          <p className="text-sm text-maia-ink-soft">The real backend (server/) is not reachable from this browser. This is expected unless it has been started separately.</p>
        </Card>
      )}

      {state === "forbidden" && (
        <Card className="border-dashed">
          <p className="text-sm text-maia-ink-soft">Signed in, but this account does not hold the &quot;Commerce&quot; permission.</p>
        </Card>
      )}

      {state === "signed-out" && (
        <Card>
          <CardHeader title="Sign in to the real backend" subtitle="This is a separate session from this app's own demo login — see the note above." />
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

      {state === "ready" && dashboard && (
        <>
          <Card>
            <CardHeader title="Today" subtitle={`Currency: ${dashboard.currency}. Verified revenue only includes payments that actually reached PAID (spec section 96).`} />
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Fact label="Today's Orders" value={dashboard.todaysOrders} />
              <Fact label="Pending Payments" value={dashboard.pendingPayments} />
              <Fact label="Verified Revenue Today" value={dashboard.verifiedRevenueToday} money />
              <Fact label="Upgrades Today" value={dashboard.upgradesToday} />
              <Fact label="Active Subscriptions" value={dashboard.activeSubscriptions} />
              <Fact label="Past Due Subscriptions" value={dashboard.pastDueSubscriptions} />
              <Fact label="Refunds Awaiting Review" value={dashboard.refundsAwaitingReview} />
              <Fact label="Payable Commissions" value={dashboard.payableCommissions} money />
            </div>
            {dashboard.checkoutIssues.expiredUnusedSessions > 0 && (
              <p className="mt-3 text-xs text-maia-warning">{dashboard.checkoutIssues.expiredUnusedSessions} checkout session(s) expired unused — informational only, not an error.</p>
            )}
          </Card>

          <Card>
            <CardHeader title="Refunds Awaiting Review" subtitle="Every decision here is a human one — nothing is auto-approved (spec section 110)." />
            {refunds.length === 0 ? (
              <p className="mt-3 text-sm text-maia-ink-soft">No refund requests awaiting review.</p>
            ) : (
              <div className="mt-3 flex flex-col gap-2">
                {refunds.map((r) => (
                  <div key={r.id} className="rounded-xl border border-maia-border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-bold text-maia-ink">
                        {r.refundDisplayId} — {r.student?.studentDisplayId ?? r.studentId}
                      </span>
                      <Badge tone={REFUND_STATUS_TONE[r.status] ?? "neutral"}>{r.status.replace(/_/g, " ")}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-maia-ink-soft">
                      ₱{Number(r.amount).toLocaleString()} for {r.purchase?.product?.name ?? r.purchaseId} — &quot;{r.reason}&quot;
                    </p>
                    <div className="mt-2 flex gap-2">
                      <button onClick={() => handleReviewRefund(r.id, "APPROVED")} className="rounded-lg bg-maia-gold-deep px-3 py-1.5 text-xs font-bold text-white">
                        Approve
                      </button>
                      <button onClick={() => handleReviewRefund(r.id, "REJECTED")} className="rounded-lg border border-maia-border px-3 py-1.5 text-xs font-bold text-maia-ink">
                        Reject
                      </button>
                      <button onClick={() => handleProcessRefund(r.id)} className="rounded-lg border border-maia-border px-3 py-1.5 text-xs font-bold text-maia-ink">
                        Process (after Approve)
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Affiliate Applications" subtitle="Admin approval required before any commission eligibility (spec section 64)." />
            {affiliates.length === 0 ? (
              <p className="mt-3 text-sm text-maia-ink-soft">No affiliates yet.</p>
            ) : (
              <div className="mt-3 flex flex-col gap-2">
                {affiliates.map((a) => (
                  <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-maia-border p-3">
                    <div>
                      <p className="text-sm font-bold text-maia-ink">
                        {a.person.fullName} <span className="font-mono text-xs text-maia-ink-soft">({a.referralCode})</span>
                      </p>
                      <p className="mt-1 text-xs text-maia-ink-soft">{a.affiliateDisplayId}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone={AFFILIATE_STATUS_TONE[a.status] ?? "neutral"}>{a.status.replace(/_/g, " ")}</Badge>
                      {a.status === "APPLIED" && (
                        <button onClick={() => handleAffiliateStatus(a.id, "PENDING_REVIEW")} className="rounded-lg border border-maia-border px-3 py-1.5 text-xs font-bold text-maia-ink">
                          Start Review
                        </button>
                      )}
                      {a.status === "PENDING_REVIEW" && (
                        <button onClick={() => handleAffiliateStatus(a.id, "ACTIVE")} className="rounded-lg bg-maia-gold-deep px-3 py-1.5 text-xs font-bold text-white">
                          Approve
                        </button>
                      )}
                      {a.status === "ACTIVE" && (
                        <button onClick={() => handleAffiliateStatus(a.id, "SUSPENDED")} className="rounded-lg border border-maia-border px-3 py-1.5 text-xs font-bold text-maia-ink">
                          Suspend
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
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
