import { useEffect, useState } from "react";
import { Card, CardHeader } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import {
  ApiError,
  authApi,
  entitlementsApi,
  type ApiCommerceProduct,
  type ApiMyAccessView,
} from "@/api/client";

// M.A.I.A. Student Access Center — "My Access" (Production Phase 16, spec
// sections 90-93). Same disclosed limitation as Business OS/Intelligence
// Command Center: this app's own login (AuthContext) is a separate, mock,
// localStorage-only system from the real backend's cookie-session login,
// so this page signs in against the real backend (server/) directly.
// Every entitlement, purchase and subscription shown is real, DB-derived
// data for the signed-in Student — every row carries its real source so a
// Student can always answer "why do I have this?" (spec section 91).
//
// This build covers the core self-service flow: viewing current access
// with its live resolver decision, browsing ACTIVE products, creating a
// purchase, submitting manual payment proof, and (once staff verify)
// activating the resulting access. It deliberately does NOT yet include
// every one of the spec's screens (in-app upgrade/downgrade wizard,
// Student Marketplace browsing/filtering, coupon redemption UI) — those
// real backend routes already exist and are tested
// (server/src/modules/entitlements/*, server/tests/phase16-entitlements.test.ts)
// but have no dedicated screen yet.

type ConnectionState = "checking" | "signed-out" | "no-student" | "ready" | "unreachable" | "forbidden";

const DECISION_TONE: Record<string, "danger" | "warning" | "info" | "neutral" | "success"> = {
  ALLOWED: "success",
  LIMIT_REACHED: "warning",
  EXPIRED: "danger",
  SUSPENDED: "danger",
  REQUIRES_PAYMENT: "info",
  REQUIRES_UPGRADE: "neutral",
  DENIED: "danger",
};

const PURCHASE_STATUS_TONE: Record<string, "danger" | "warning" | "info" | "neutral" | "success"> = {
  PENDING_PAYMENT: "neutral",
  AWAITING_VERIFICATION: "warning",
  PAID: "success",
  FAILED: "danger",
  CANCELLED: "danger",
  REFUNDED: "danger",
  PARTIALLY_REFUNDED: "warning",
};

export function MyAccess() {
  const [state, setState] = useState<ConnectionState>("checking");
  const [studentId, setStudentId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);

  const [access, setAccess] = useState<ApiMyAccessView | null>(null);
  const [products, setProducts] = useState<ApiCommerceProduct[]>([]);
  const [billingMessage, setBillingMessage] = useState<string | null>(null);
  const [busyPurchaseId, setBusyPurchaseId] = useState<string | null>(null);

  async function loadAccess(forStudentId: string) {
    try {
      const [accessRes, productsRes, billingRes] = await Promise.all([
        entitlementsApi.myAccess(forStudentId),
        entitlementsApi.catalog(),
        entitlementsApi.billingStatus(),
      ]);
      setAccess(accessRes);
      setProducts(productsRes.products);
      setBillingMessage(billingRes.message);
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
        const { user } = await authApi.me();
        if (!user.studentId) {
          setState("no-student");
          return;
        }
        setStudentId(user.studentId);
        await loadAccess(user.studentId);
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
      const { user } = await authApi.login(email, password);
      if (!user.studentId) {
        setState("no-student");
        return;
      }
      setStudentId(user.studentId);
      setState("checking");
      await loadAccess(user.studentId);
    } catch (err) {
      setLoginError(err instanceof ApiError ? err.message : "Could not reach the real backend.");
    }
  }

  async function refresh() {
    if (studentId) await loadAccess(studentId);
  }

  async function handlePurchase(productId: string) {
    if (!studentId) return;
    const promotionCode = window.prompt("Promotion code (optional):") || undefined;
    try {
      await entitlementsApi.createPurchase(studentId, { productId, promotionCode, checkoutMode: "MANUAL_PAYMENT" });
      await refresh();
    } catch (err) {
      window.alert(err instanceof ApiError ? err.message : "Could not create purchase.");
    }
  }

  async function handleSubmitPayment(purchaseId: string) {
    const paymentMethod = window.prompt("Payment method (e.g. GCash, Bank Transfer):");
    if (!paymentMethod) return;
    const referenceNumber = window.prompt("Reference number (optional):") || undefined;
    setBusyPurchaseId(purchaseId);
    try {
      await entitlementsApi.submitPayment(purchaseId, { paymentMethod, referenceNumber });
      await refresh();
    } catch (err) {
      window.alert(err instanceof ApiError ? err.message : "Could not submit payment.");
    } finally {
      setBusyPurchaseId(null);
    }
  }

  async function handleActivate(purchaseId: string) {
    setBusyPurchaseId(purchaseId);
    try {
      await entitlementsApi.activatePurchase(purchaseId);
      await refresh();
    } catch (err) {
      window.alert(err instanceof ApiError ? err.message : "Could not activate access yet — payment may not be verified.");
    } finally {
      setBusyPurchaseId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-lg font-bold text-maia-ink">My Access</h2>
        <p className="text-sm text-maia-ink-soft">Every entitlement below carries its real source — you can always see exactly why you have (or don&apos;t have) access to something.</p>
      </div>

      {state === "checking" && <Card>Checking connection to the real backend…</Card>}

      {state === "unreachable" && (
        <Card className="border-dashed">
          <p className="text-sm text-maia-ink-soft">The real backend (server/) is not reachable from this browser. This is expected unless it has been started separately.</p>
        </Card>
      )}

      {state === "forbidden" && (
        <Card className="border-dashed">
          <p className="text-sm text-maia-ink-soft">Signed in, but this account is not authorized to view this Student&apos;s access.</p>
        </Card>
      )}

      {state === "no-student" && (
        <Card className="border-dashed">
          <p className="text-sm text-maia-ink-soft">My Access is a Student-owned view — sign in with a Student account to see your own entitlements.</p>
        </Card>
      )}

      {state === "signed-out" && (
        <Card>
          <CardHeader title="Sign in to the real backend" subtitle="This is a separate session from this app's own demo login — see the note above." />
          <form onSubmit={handleLogin} className="mt-3 flex flex-col gap-3 sm:max-w-sm">
            <input type="email" required placeholder="Student email" value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-lg border border-maia-border px-3 py-2 text-sm" />
            <input type="password" required placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="rounded-lg border border-maia-border px-3 py-2 text-sm" />
            {loginError && <p className="text-xs font-semibold text-maia-danger">{loginError}</p>}
            <button type="submit" className="rounded-lg bg-maia-gold-deep px-3 py-2 text-sm font-bold text-white">
              Sign in
            </button>
          </form>
        </Card>
      )}

      {state === "ready" && access && (
        <>
          {billingMessage && (
            <Card className="border-dashed">
              <p className="text-xs text-maia-ink-soft">{billingMessage}</p>
            </Card>
          )}

          <Card>
            <CardHeader title="Current Access" subtitle="Live resolver decision for each entitlement — never a stale cached flag." />
            {access.entitlements.length === 0 ? (
              <p className="mt-3 text-sm text-maia-ink-soft">No access granted yet. Browse products below to get started.</p>
            ) : (
              <div className="mt-3 flex flex-col gap-2">
                {access.entitlements.map((e) => (
                  <div key={e.id} className="rounded-xl border border-maia-border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-bold text-maia-ink">{e.featureKey.replace(/_/g, " ")}</span>
                      <Badge tone={DECISION_TONE[e.resolvedDecision] ?? "neutral"}>{e.resolvedDecision.replace(/_/g, " ")}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-maia-ink-soft">
                      Source: {e.source.replace(/_/g, " ")}
                      {e.product ? ` — ${e.product.name}` : ""} · Status: {e.status}
                      {e.usage ? ` · Usage: ${e.usage.used}/${e.usage.limit} (${e.usage.periodKey})` : ""}
                    </p>
                    {e.overrideReason && <p className="mt-1 text-xs text-maia-ink-soft">Admin override reason: {e.overrideReason}</p>}
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Available Products" subtitle="Purchasing creates a real, tracked Purchase — payment is manually verified by staff before any access is granted (spec sections 45-46)." />
            {products.length === 0 ? (
              <p className="mt-3 text-sm text-maia-ink-soft">No products currently available.</p>
            ) : (
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {products.map((p) => (
                  <div key={p.id} className="flex flex-col justify-between rounded-xl border border-maia-border p-3">
                    <div>
                      <p className="text-sm font-bold text-maia-ink">{p.name}</p>
                      <p className="mt-1 text-xs text-maia-ink-soft">{p.description ?? p.type.replace(/_/g, " ")}</p>
                      <p className="mt-1 text-xs font-semibold text-maia-ink">{p.basePrice != null ? `₱${Number(p.basePrice).toLocaleString()}` : "Price on request"}</p>
                    </div>
                    <button onClick={() => handlePurchase(p.id)} className="mt-3 rounded-lg border border-maia-border px-3 py-1.5 text-xs font-bold text-maia-ink">
                      Purchase
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="My Purchases" subtitle="A failed or pending purchase never grants access on its own — verification and activation are separate, real steps (spec sections 115-116)." />
            {access.purchases.length === 0 ? (
              <p className="mt-3 text-sm text-maia-ink-soft">No purchases yet.</p>
            ) : (
              <div className="mt-3 flex flex-col gap-2">
                {access.purchases.map((p) => (
                  <div key={p.id} className="rounded-xl border border-maia-border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-bold text-maia-ink">{p.product?.name ?? p.purchaseDisplayId}</span>
                      <Badge tone={PURCHASE_STATUS_TONE[p.status] ?? "neutral"}>{p.status.replace(/_/g, " ")}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-maia-ink-soft">
                      ₱{Number(p.priceAtPurchase).toLocaleString()} · {p.purchaseDisplayId}
                      {p.activatedAt ? ` · Activated ${new Date(p.activatedAt).toLocaleDateString()}` : ""}
                    </p>
                    <div className="mt-2 flex gap-2">
                      {p.status === "PENDING_PAYMENT" && (
                        <button onClick={() => handleSubmitPayment(p.id)} disabled={busyPurchaseId === p.id} className="rounded-lg bg-maia-gold-deep px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">
                          Submit Payment Proof
                        </button>
                      )}
                      {p.status === "PAID" && !p.activatedAt && (
                        <button onClick={() => handleActivate(p.id)} disabled={busyPurchaseId === p.id} className="rounded-lg bg-maia-gold-deep px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">
                          Activate Access
                        </button>
                      )}
                      {p.status === "AWAITING_VERIFICATION" && <span className="text-xs text-maia-ink-soft">Waiting for staff to verify your payment.</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {access.subscriptions.length > 0 && (
            <Card>
              <CardHeader title="My Subscriptions" subtitle="Manually tracked (MANUAL provider) — no live payment gateway is connected in this environment (spec section 54)." />
              <div className="mt-3 flex flex-col gap-2">
                {access.subscriptions.map((s) => (
                  <div key={s.id} className="rounded-xl border border-maia-border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-bold text-maia-ink">{s.product?.name ?? s.subscriptionDisplayId}</span>
                      <Badge tone={s.status === "ACTIVE" ? "success" : s.status === "PAST_DUE" ? "warning" : "danger"}>{s.status.replace(/_/g, " ")}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-maia-ink-soft">
                      Current period ends {new Date(s.currentPeriodEnd).toLocaleDateString()}
                      {s.cancelAtPeriodEnd ? " · Will not renew" : ""}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
