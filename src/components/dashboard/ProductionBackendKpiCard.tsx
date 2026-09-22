import { useEffect, useState } from "react";
import { Database } from "lucide-react";
import { Card } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { ApiError, dashboardApi, type DashboardSummary } from "@/api/client";
import { formatPeso } from "@/utils/format";

type ConnectionStatus = "loading" | "ready" | "auth-required" | "unreachable";

/**
 * Additive Production Phase 2 proof-of-connection widget — NOT a
 * replacement for any of the mock-data KPIs above it. Every number here is
 * read live from the real Postgres-backed server/ (never hard-coded), but
 * this card is entirely optional: if that backend isn't running (the normal
 * case for anyone just exploring the demo app), it fails gracefully and
 * says so, without touching anything else on this page.
 *
 * This app's own login (AuthContext) is a separate, mock, localStorage-only
 * system from the real backend's cookie-session login — signing into the
 * demo app does NOT sign this browser into server/. Until a dedicated auth
 * bridge exists (tracked for a later phase), this card can only ever show
 * "Backend reachable, sign-in required" here, even with the real server
 * running. That's disclosed below rather than papered over.
 */
export function ProductionBackendKpiCard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("loading");

  useEffect(() => {
    let cancelled = false;
    dashboardApi
      .summary()
      .then((res) => {
        if (!cancelled) {
          setSummary(res.summary);
          setStatus("ready");
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          setStatus("auth-required");
        } else {
          setStatus("unreachable");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Card className="border-dashed">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-bold text-maia-ink">
          <Database size={16} className="text-maia-gold-deep" />
          Production Backend (Phase 2)
        </div>
        {status === "ready" && <Badge tone="success">Connected</Badge>}
        {status === "auth-required" && <Badge tone="warning">Sign-in required</Badge>}
        {status === "unreachable" && <Badge tone="neutral">Not reachable</Badge>}
        {status === "loading" && <Badge tone="neutral">Checking…</Badge>}
      </div>

      {status === "unreachable" && (
        <p className="mt-2 text-xs text-maia-ink-soft">
          The real backend (server/) is not reachable from this browser. This is expected unless it has been started
          separately — the KPIs above continue to use the app&apos;s existing demo data.
        </p>
      )}

      {status === "auth-required" && (
        <p className="mt-2 text-xs text-maia-ink-soft">
          The real backend is running, but this browser has no authenticated session with it — this app&apos;s own
          login is a separate demo system that does not sign into server/. The KPIs above continue to use the
          app&apos;s existing demo data.
        </p>
      )}

      {status === "ready" && summary && (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <ProductionKpi label="Students (DB)" value={String(summary.totalStudents)} />
          <ProductionKpi label="New Enrollments (DB)" value={String(summary.newEnrollments)} />
          <ProductionKpi label="Verified Collections (DB)" value={formatPeso(summary.verifiedCollections)} />
          <ProductionKpi label="Receivables (DB)" value={formatPeso(summary.receivables)} />
          <ProductionKpi label="Pending Verification (DB)" value={String(summary.pendingPaymentVerification)} />
          <ProductionKpi label="Fully Paid Students (DB)" value={String(summary.fullyPaidStudents)} />
          <ProductionKpi label="Students w/ Balance (DB)" value={String(summary.studentsWithBalance)} />
        </div>
      )}
    </Card>
  );
}

function ProductionKpi({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-maia-ink-soft">{label}</p>
      <p className="mt-0.5 text-sm font-extrabold text-maia-ink">{value}</p>
    </div>
  );
}
