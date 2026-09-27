import { useEffect, useState } from "react";
import { Card, CardHeader } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import {
  ApiError,
  authApi,
  entitlementsApi,
  type ApiCommerceProduct,
  type ApiFeature,
  type ApiPromotion,
} from "@/api/client";

// M.A.I.A. Product Catalog + Feature Catalog admin screen (Production
// Phase 16, spec sections 2-3, 17-18, 69-74, 137). Same disclosed
// limitation as Business OS/Intelligence Command Center: this app's own
// login (AuthContext) is a separate, mock, localStorage-only system from
// the real backend's cookie-session login, so this page signs in against
// the real backend (server/) directly.
//
// This build covers: Feature Catalog (read), Product list + create
// (Package Builder — a Product with type PACKAGE/BUNDLE and a chosen
// Feature grant set), Promotions list + create (with real tracked
// capacity, never a fabricated "slots remaining"), the Access Health
// dashboard, the read-only Legacy Migration Dry Run, and the read-only
// Entitlement Reconciliation report. It deliberately does NOT yet include
// every one of the spec's screens (Upgrade Rule builder UI, per-student
// Customer Access detail view, SaaS-wide Customer 360) — those real
// backend routes already exist and are tested
// (server/src/modules/entitlements/*, server/tests/phase16-entitlements.test.ts)
// but have no dedicated screen yet.

type ConnectionState = "checking" | "signed-out" | "no-student" | "ready" | "unreachable" | "forbidden";

const PRODUCT_TYPES = ["COURSE", "PROGRAM", "PACKAGE", "BUNDLE", "MEMBERSHIP", "SUBSCRIPTION", "SERVICE", "BUILD_WITH_YOU", "ADD_ON", "AI_ACCESS", "BUSINESS_OS_ACCESS", "CUSTOM"] as const;

interface DryRunRow {
  studentDisplayId: string;
  currentPackage: string;
  status?: string;
  proposedProduct?: string;
  mappingConfirmed?: boolean;
  potentialAccessLoss?: string[];
  conflict?: boolean;
}

interface ReconciliationResult {
  category: string;
  detail: string;
  entityType: string;
  entityId: string;
}

export function ProductCatalog() {
  const [state, setState] = useState<ConnectionState>("checking");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);

  const [features, setFeatures] = useState<ApiFeature[]>([]);
  const [products, setProducts] = useState<ApiCommerceProduct[]>([]);
  const [promotions, setPromotions] = useState<ApiPromotion[]>([]);
  const [accessHealth, setAccessHealth] = useState<{ active: number; expiringSoon: number; expired: number; suspended: number; overrides: number; subscriptionsPastDue: number } | null>(null);

  const [newProductName, setNewProductName] = useState("");
  const [newProductType, setNewProductType] = useState<string>("PACKAGE");
  const [newProductPrice, setNewProductPrice] = useState("");
  const [newProductFeatureKey, setNewProductFeatureKey] = useState("");
  const [creatingProduct, setCreatingProduct] = useState(false);

  const [dryRunRows, setDryRunRows] = useState<DryRunRow[] | null>(null);
  const [reconciliation, setReconciliation] = useState<{ flaggedCount: number; results: ReconciliationResult[] } | null>(null);
  const [loadingReport, setLoadingReport] = useState<"dry-run" | "reconciliation" | null>(null);

  async function loadCatalog() {
    try {
      const [featuresRes, productsRes, promotionsRes, healthRes] = await Promise.all([
        entitlementsApi.features(),
        entitlementsApi.products(),
        entitlementsApi.promotions(),
        entitlementsApi.accessHealth(),
      ]);
      setFeatures(featuresRes.features);
      setProducts(productsRes.products);
      setPromotions(promotionsRes.promotions);
      setAccessHealth(healthRes);
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
        await loadCatalog();
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
      await loadCatalog();
    } catch (err) {
      setLoginError(err instanceof ApiError ? err.message : "Could not reach the real backend.");
    }
  }

  async function handleCreateProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!newProductName.trim()) return;
    setCreatingProduct(true);
    try {
      await entitlementsApi.createProduct({
        name: newProductName,
        type: newProductType,
        basePrice: newProductPrice ? Number(newProductPrice) : undefined,
        entitlementsJson: newProductFeatureKey ? [{ featureKey: newProductFeatureKey }] : [],
      });
      setNewProductName("");
      setNewProductPrice("");
      setNewProductFeatureKey("");
      await loadCatalog();
    } catch (err) {
      window.alert(err instanceof ApiError ? err.message : "Could not create product.");
    } finally {
      setCreatingProduct(false);
    }
  }

  async function handleArchiveProduct(id: string) {
    try {
      await entitlementsApi.updateProduct(id, { status: "ARCHIVED" });
      await loadCatalog();
    } catch (err) {
      window.alert(err instanceof ApiError ? err.message : "Could not archive product.");
    }
  }

  async function handleCreatePromotion() {
    const name = window.prompt("Promotion name:");
    if (!name) return;
    const code = window.prompt("Coupon code (optional — leave blank for a non-coupon promotion):") || undefined;
    const amountStr = window.prompt("Fixed discount amount (₱):", "500");
    if (!amountStr) return;
    const usageLimitStr = window.prompt("Usage limit (real tracked capacity, optional):");
    try {
      await entitlementsApi.createPromotion({
        name,
        code,
        type: "FIXED_DISCOUNT",
        valueJson: { amount: Number(amountStr) },
        usageLimit: usageLimitStr ? Number(usageLimitStr) : undefined,
      });
      await loadCatalog();
    } catch (err) {
      window.alert(err instanceof ApiError ? err.message : "Could not create promotion.");
    }
  }

  async function runDryRun() {
    setLoadingReport("dry-run");
    try {
      const res = await entitlementsApi.migrationDryRun();
      setDryRunRows(res.rows as DryRunRow[]);
    } catch (err) {
      window.alert(err instanceof ApiError ? err.message : "Could not run migration dry run.");
    } finally {
      setLoadingReport(null);
    }
  }

  async function runReconciliation() {
    setLoadingReport("reconciliation");
    try {
      const res = await entitlementsApi.reconciliation();
      setReconciliation(res);
    } catch (err) {
      window.alert(err instanceof ApiError ? err.message : "Could not run reconciliation.");
    } finally {
      setLoadingReport(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-lg font-bold text-maia-ink">Product Catalog &amp; Entitlements</h2>
        <p className="text-sm text-maia-ink-soft">Real Products, real Feature grants, real usage — a comparison here can never show a benefit the resolver wouldn&apos;t actually grant.</p>
      </div>

      {state === "checking" && <Card>Checking connection to the real backend…</Card>}

      {state === "unreachable" && (
        <Card className="border-dashed">
          <p className="text-sm text-maia-ink-soft">The real backend (server/) is not reachable from this browser. This is expected unless it has been started separately.</p>
        </Card>
      )}

      {state === "forbidden" && (
        <Card className="border-dashed">
          <p className="text-sm text-maia-ink-soft">Signed in, but this account does not hold the &quot;Product Catalog&quot; permission.</p>
        </Card>
      )}

      {state === "no-student" && (
        <Card className="border-dashed">
          <p className="text-sm text-maia-ink-soft">This view is for staff only.</p>
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

      {state === "ready" && (
        <>
          {accessHealth && (
            <Card>
              <CardHeader title="Access Health" subtitle="Real counts only — never an estimate (spec sections 52, 137)." />
              <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-6">
                <Fact label="Active" value={accessHealth.active} />
                <Fact label="Expiring Soon" value={accessHealth.expiringSoon} />
                <Fact label="Expired" value={accessHealth.expired} />
                <Fact label="Suspended" value={accessHealth.suspended} />
                <Fact label="Admin Overrides" value={accessHealth.overrides} />
                <Fact label="Subscriptions Past Due" value={accessHealth.subscriptionsPastDue} />
              </div>
            </Card>
          )}

          <Card>
            <CardHeader title="Feature Catalog" subtitle="Stable, machine-readable keys — never a renamable UI label used for authorization (spec section 9)." />
            <div className="mt-3 flex flex-wrap gap-2">
              {features.map((f) => (
                <Badge key={f.id} tone="neutral">
                  {f.featureKey}
                </Badge>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Products" subtitle="The Package Builder is just a Product with type PACKAGE/BUNDLE and a configured Feature grant set — no separate builder entity." />
            <form onSubmit={handleCreateProduct} className="mt-3 flex flex-wrap items-end gap-2">
              <input required placeholder="Product name" value={newProductName} onChange={(e) => setNewProductName(e.target.value)} className="rounded-lg border border-maia-border px-3 py-2 text-sm" />
              <select value={newProductType} onChange={(e) => setNewProductType(e.target.value)} className="rounded-lg border border-maia-border px-3 py-2 text-sm">
                {PRODUCT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
              <input type="number" min="0" placeholder="Base price (₱)" value={newProductPrice} onChange={(e) => setNewProductPrice(e.target.value)} className="w-36 rounded-lg border border-maia-border px-3 py-2 text-sm" />
              <select value={newProductFeatureKey} onChange={(e) => setNewProductFeatureKey(e.target.value)} className="rounded-lg border border-maia-border px-3 py-2 text-sm">
                <option value="">No feature grant yet</option>
                {features.map((f) => (
                  <option key={f.id} value={f.featureKey}>
                    {f.featureKey}
                  </option>
                ))}
              </select>
              <button type="submit" disabled={creatingProduct} className="rounded-lg bg-maia-gold-deep px-3 py-2 text-sm font-bold text-white disabled:opacity-50">
                {creatingProduct ? "Creating…" : "Create Product"}
              </button>
            </form>

            <div className="mt-4 flex flex-col gap-2">
              {products.length === 0 && <p className="text-sm text-maia-ink-soft">No products yet.</p>}
              {products.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-xl border border-maia-border p-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-maia-ink">{p.name}</span>
                      <Badge tone={p.status === "ACTIVE" ? "success" : p.status === "DRAFT" ? "neutral" : "danger"}>{p.status}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-maia-ink-soft">
                      {p.type.replace(/_/g, " ")} · {p.basePrice != null ? `₱${Number(p.basePrice).toLocaleString()}` : "No price set"} · {p.productDisplayId}
                    </p>
                  </div>
                  {p.status !== "ARCHIVED" && (
                    <button onClick={() => handleArchiveProduct(p.id)} className="rounded-lg border border-maia-border px-3 py-1.5 text-xs font-bold text-maia-ink">
                      Archive
                    </button>
                  )}
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Promotions / Coupons" subtitle="Real tracked capacity — never a fabricated 'slots remaining' (spec section 72)." />
            <button onClick={handleCreatePromotion} className="mt-1 rounded-lg border border-maia-border px-3 py-1.5 text-xs font-bold text-maia-ink">
              + Create Promotion
            </button>
            <div className="mt-3 flex flex-col gap-2">
              {promotions.length === 0 && <p className="text-sm text-maia-ink-soft">No promotions yet.</p>}
              {promotions.map((promo) => (
                <div key={promo.id} className="flex items-center justify-between rounded-xl border border-maia-border p-3">
                  <div>
                    <p className="text-sm font-bold text-maia-ink">
                      {promo.name} {promo.code ? <span className="font-mono text-xs text-maia-ink-soft">({promo.code})</span> : null}
                    </p>
                    <p className="mt-1 text-xs text-maia-ink-soft">{promo.type.replace(/_/g, " ")}</p>
                  </div>
                  <Badge tone="info">
                    {promo.redeemedCount} / {promo.usageLimit ?? "∞"} redeemed
                  </Badge>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Legacy Migration Dry Run" subtitle="Read-only. Never changes a single row (spec section 99)." />
            <button onClick={runDryRun} disabled={loadingReport === "dry-run"} className="mt-1 rounded-lg border border-maia-border px-3 py-1.5 text-xs font-bold text-maia-ink disabled:opacity-50">
              {loadingReport === "dry-run" ? "Running…" : "Run Dry Run"}
            </button>
            {dryRunRows && (
              <div className="mt-3 flex flex-col gap-2">
                {dryRunRows.map((row) => (
                  <div key={row.studentDisplayId} className="rounded-xl border border-maia-border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-maia-ink">{row.studentDisplayId}</span>
                      {row.conflict ? <Badge tone="danger">Access loss risk</Badge> : <Badge tone="success">Safe</Badge>}
                    </div>
                    <p className="mt-1 text-xs text-maia-ink-soft">
                      {row.status === "MISSING_PACKAGE_MAPPING"
                        ? `No mapping configured for "${row.currentPackage}".`
                        : `"${row.currentPackage}" -> "${row.proposedProduct}" (mapping ${row.mappingConfirmed ? "confirmed" : "unconfirmed"})`}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Entitlement Reconciliation" subtitle="Flags real drift for human review — never auto-resolves anything (spec section 136)." />
            <button onClick={runReconciliation} disabled={loadingReport === "reconciliation"} className="mt-1 rounded-lg border border-maia-border px-3 py-1.5 text-xs font-bold text-maia-ink disabled:opacity-50">
              {loadingReport === "reconciliation" ? "Running…" : "Run Reconciliation"}
            </button>
            {reconciliation && (
              <div className="mt-3 flex flex-col gap-2">
                {reconciliation.flaggedCount === 0 ? (
                  <p className="text-sm text-maia-ink-soft">Nothing flagged.</p>
                ) : (
                  reconciliation.results.map((r, i) => (
                    <div key={i} className="rounded-xl border border-maia-border p-3">
                      <Badge tone="warning">{r.category.replace(/_/g, " ")}</Badge>
                      <p className="mt-1 text-xs text-maia-ink-soft">{r.detail}</p>
                    </div>
                  ))
                )}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-maia-ink-soft">{label}</p>
      <p className="mt-0.5 text-sm font-extrabold text-maia-ink">{value.toLocaleString()}</p>
    </div>
  );
}
