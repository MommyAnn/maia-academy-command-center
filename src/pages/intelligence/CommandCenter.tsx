import { useEffect, useState } from "react";
import { Card, CardHeader } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { ApiError, authApi, intelligenceApi, type ApiDailyBrief, type ApiTodaysPriority } from "@/api/client";

// M.A.I.A. Intelligence — Owner Command Center (Production Phase 10).
//
// This app's own login (AuthContext) is a separate, mock, localStorage-only
// system from the real backend's cookie-session login — the same
// disclosed limitation ProductionBackendKpiCard documents. Rather than
// leave this whole module unusable until that gap is closed, this page
// authenticates directly against the real backend (server/) with its own
// small sign-in step below. Everything shown after sign-in is real,
// DB-derived data — no fabricated numbers, no fake alerts (spec sections
// 1-8).

type ConnectionState = "checking" | "signed-out" | "ready" | "unreachable" | "forbidden";

const SEVERITY_TONE: Record<string, "danger" | "warning" | "info" | "neutral"> = {
  CRITICAL: "danger",
  HIGH: "warning",
  MEDIUM: "info",
  LOW: "neutral",
};

export function CommandCenter() {
  const [state, setState] = useState<ConnectionState>("checking");
  const [priorities, setPriorities] = useState<ApiTodaysPriority[]>([]);
  const [brief, setBrief] = useState<ApiDailyBrief | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<{ text: string; matched: boolean; aiPhrased: boolean } | null>(null);
  const [asking, setAsking] = useState(false);

  async function loadData() {
    try {
      const [p, b] = await Promise.all([intelligenceApi.priorities(), intelligenceApi.dailyBrief(1)]);
      setPriorities(p.priorities);
      setBrief(b.brief);
      setState("ready");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) setState("signed-out");
      else if (err instanceof ApiError && err.status === 403) setState("forbidden");
      else setState("unreachable");
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError(null);
    try {
      await authApi.login(email, password);
      setState("checking");
      await loadData();
    } catch (err) {
      setLoginError(err instanceof ApiError ? err.message : "Could not reach the real backend.");
    }
  }

  async function handleResolve(signalId: string) {
    const resolution = window.prompt("Resolution note (required):");
    if (!resolution) return;
    await intelligenceApi.resolveSignal(signalId, resolution);
    await loadData();
  }

  async function handleDismiss(signalId: string) {
    const resolution = window.prompt("Dismissal reason (required):");
    if (!resolution) return;
    await intelligenceApi.dismissSignal(signalId, resolution);
    await loadData();
  }

  async function handleAsk(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;
    setAsking(true);
    setAnswer(null);
    try {
      const res = await intelligenceApi.ask(question);
      setAnswer({ text: res.answer, matched: res.matched, aiPhrased: res.aiPhrased });
    } catch (err) {
      setAnswer({ text: err instanceof ApiError ? err.message : "Could not reach M.A.I.A. Intelligence.", matched: false, aiPhrased: false });
    } finally {
      setAsking(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-lg font-bold text-maia-ink">M.A.I.A. Intelligence — Command Center</h2>
        <p className="text-sm text-maia-ink-soft">
          Deterministic rule-based signals over real Academy data. The database stays the source of truth — this
          reads and annotates it, never the other way around.
        </p>
      </div>

      {state === "checking" && <Card>Checking connection to the real backend…</Card>}

      {state === "unreachable" && (
        <Card className="border-dashed">
          <p className="text-sm text-maia-ink-soft">
            The real backend (server/) is not reachable from this browser. This is expected unless it has been
            started separately.
          </p>
        </Card>
      )}

      {state === "forbidden" && (
        <Card className="border-dashed">
          <p className="text-sm text-maia-ink-soft">
            Signed in, but this account does not have the &quot;M.A.I.A. Intelligence&quot; permission on the real
            backend. Ask an Owner/Administrator to grant it via Roles &amp; Permissions.
          </p>
        </Card>
      )}

      {state === "signed-out" && (
        <Card>
          <CardHeader title="Sign in to the real backend" subtitle="This is a separate session from this app's own demo login — see the note above." />
          <form onSubmit={handleLogin} className="mt-3 flex flex-col gap-3 sm:max-w-sm">
            <input
              type="email"
              required
              placeholder="Owner/Admin email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-lg border border-maia-border px-3 py-2 text-sm"
            />
            <input
              type="password"
              required
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-lg border border-maia-border px-3 py-2 text-sm"
            />
            {loginError && <p className="text-xs font-semibold text-maia-danger">{loginError}</p>}
            <button type="submit" className="rounded-lg bg-maia-gold-deep px-3 py-2 text-sm font-bold text-white">
              Sign in
            </button>
          </form>
        </Card>
      )}

      {state === "ready" && brief && (
        <>
          <Card>
            <CardHeader title="Daily Brief" subtitle={`Since ${new Date(brief.since).toLocaleString()} — every figure computed live, nothing cached or invented.`} />
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Fact label="New Leads" value={brief.facts.newLeads} />
              <Fact label="Webinar Registrations" value={brief.facts.webinarRegistrations} />
              <Fact label="Follow-Ups Due Now" value={brief.facts.followUpsDueNow} />
              <Fact label="New Enrollments" value={brief.facts.newEnrollments} />
              <Fact label="Verified Collections" value={brief.calculatedMetrics.verifiedCollections} money />
              <Fact label="Receivables" value={brief.calculatedMetrics.receivables} money />
              <Fact label="Pending Verification" value={brief.calculatedMetrics.pendingPaymentVerificationCount} />
              <Fact label="Open Signals" value={brief.ruleBasedSignals.totalOpen} />
            </div>
          </Card>

          <Card>
            <CardHeader title="Today's Priorities" subtitle="Every item is a rule-based signal, sorted by severity, with the exact condition that triggered it." />
            {priorities.length === 0 && <p className="mt-3 text-sm text-maia-ink-soft">Nothing currently needs attention — no open signals.</p>}
            <div className="mt-3 flex flex-col gap-2">
              {priorities.map((p) => (
                <div key={p.id} className="rounded-xl border border-maia-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge tone={SEVERITY_TONE[p.severity] ?? "neutral"}>{p.severity}</Badge>
                      <span className="text-sm font-bold text-maia-ink">{p.title}</span>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleResolve(p.id)} className="text-xs font-semibold text-maia-success">
                        Resolve
                      </button>
                      <button onClick={() => handleDismiss(p.id)} className="text-xs font-semibold text-maia-ink-soft">
                        Dismiss
                      </button>
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-maia-ink-soft">{p.explanation}</p>
                  <p className="mt-1 text-xs font-semibold text-maia-gold-deep">Recommended: {p.recommendation}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Ask M.A.I.A." subtitle="Answers are grounded in real retrieved data — never a guess. Try: “How many payments are pending verification?”" />
            <form onSubmit={handleAsk} className="mt-3 flex gap-2">
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="What needs my attention today?"
                className="flex-1 rounded-lg border border-maia-border px-3 py-2 text-sm"
              />
              <button type="submit" disabled={asking} className="rounded-lg bg-maia-gold-deep px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                {asking ? "Asking…" : "Ask"}
              </button>
            </form>
            {answer && (
              <div className="mt-3 rounded-xl border border-maia-border p-3">
                <p className="text-sm text-maia-ink">{answer.text}</p>
                {answer.matched && (
                  <p className="mt-1 text-[10px] uppercase tracking-wider text-maia-ink-soft">
                    Source: RULE-BASED{answer.aiPhrased ? " (AI-reworded, facts unchanged)" : " (facts, unmodified)"}
                  </p>
                )}
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
