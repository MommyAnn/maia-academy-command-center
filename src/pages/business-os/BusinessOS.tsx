import { useEffect, useState } from "react";
import { Card, CardHeader } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import {
  ApiError,
  authApi,
  businessOsApi,
  type ApiBusiness,
  type ApiBusinessHome,
  type ApiBusinessContact,
  type ApiAskBusinessResult,
} from "@/api/client";

// M.A.I.A. Business OS (Production Phase 15) — "ONE BUSINESS -> ONE COMMAND
// CENTER". Same disclosed limitation as the M.A.I.A. Intelligence Command
// Center (src/pages/intelligence/CommandCenter.tsx): this app's own login
// (AuthContext) is a separate, mock, localStorage-only system from the real
// backend's cookie-session login, so this page signs in against the real
// backend (server/) directly. Everything shown after sign-in is real,
// DB-derived data for the selected business — no fabricated numbers, no
// invented recommendations (spec sections 78-81, 146).
//
// This build covers the core unifying flow end-to-end: Business Switcher,
// Business Home (Snapshot/Health/Action Center/Goals), the Unified CRM's
// Contacts list, and Ask M.A.I.A. Business Copilot. It deliberately does
// NOT yet include every one of the 147 spec sections' screens (Business
// Plan editor, Sales pipeline board, Product Catalog, SOP Library, Content
// Calendar, Setup Wizard, Team management UI, etc.) — those real backend
// routes already exist and are tested (server/src/modules/business-os/*,
// server/tests/phase15-business-os.test.ts) but have no dedicated screen
// yet. See the Phase 15 completion report's Blueprint-Only section.

type ConnectionState = "checking" | "signed-out" | "no-student" | "ready" | "unreachable" | "forbidden";

const HEALTH_TONE: Record<string, "danger" | "warning" | "info" | "neutral" | "success"> = {
  SETUP_REQUIRED: "neutral",
  NEEDS_ATTENTION: "danger",
  OPERATIONAL: "success",
  INSUFFICIENT_DATA: "info",
};

export function BusinessOS() {
  const [state, setState] = useState<ConnectionState>("checking");
  const [studentId, setStudentId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);

  const [businesses, setBusinesses] = useState<ApiBusiness[]>([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState<string | null>(null);
  const [home, setHome] = useState<ApiBusinessHome | null>(null);
  const [contacts, setContacts] = useState<ApiBusinessContact[]>([]);

  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<ApiAskBusinessResult | { ok: false; error: string } | null>(null);
  const [asking, setAsking] = useState(false);

  async function loadBusinesses(forStudentId: string) {
    try {
      const res = await businessOsApi.listBusinesses(forStudentId);
      setBusinesses(res.businesses);
      setState("ready");
      if (res.businesses.length > 0) setSelectedBusinessId((prev) => prev ?? res.businesses[0]!.id);
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
        await loadBusinesses(user.studentId);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) setState("signed-out");
        else setState("unreachable");
      }
    }
    init();
  }, []);

  // Business Context Lock (spec section 3) — switching business reloads
  // EVERY view below from the newly-selected business's own real data; the
  // previous business's Home/CRM state is discarded, never carried over.
  async function loadBusinessContext(businessId: string | null) {
    setHome(null);
    setContacts([]);
    setAnswer(null);
    if (!businessId) return;
    businessOsApi.home(businessId).then(setHome).catch(() => setHome(null));
    businessOsApi.contacts(businessId).then((r) => setContacts(r.contacts)).catch(() => setContacts([]));
  }

  useEffect(() => {
    loadBusinessContext(selectedBusinessId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBusinessId]);

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
      await loadBusinesses(user.studentId);
    } catch (err) {
      setLoginError(err instanceof ApiError ? err.message : "Could not reach the real backend.");
    }
  }

  async function handleAsk(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim() || !selectedBusinessId) return;
    setAsking(true);
    setAnswer(null);
    try {
      const res = await businessOsApi.ask(selectedBusinessId, question);
      setAnswer(res);
    } catch (err) {
      setAnswer({ ok: false, error: err instanceof ApiError ? err.message : "Could not reach Ask M.A.I.A." });
    } finally {
      setAsking(false);
    }
  }

  async function handleQuickAddContact() {
    if (!selectedBusinessId || !studentId) return;
    const fullName = window.prompt("New contact's full name:");
    if (!fullName) return;
    const email = window.prompt("Email (optional):") || undefined;
    await businessOsApi.createContact(studentId, { businessId: selectedBusinessId, fullName, email });
    const res = await businessOsApi.contacts(selectedBusinessId);
    setContacts(res.contacts);
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-lg font-bold text-maia-ink">M.A.I.A. Business OS</h2>
        <p className="text-sm text-maia-ink-soft">One business, one command center — real data, explainable status, never an invented score.</p>
      </div>

      {state === "checking" && <Card>Checking connection to the real backend…</Card>}

      {state === "unreachable" && (
        <Card className="border-dashed">
          <p className="text-sm text-maia-ink-soft">The real backend (server/) is not reachable from this browser. This is expected unless it has been started separately.</p>
        </Card>
      )}

      {state === "forbidden" && (
        <Card className="border-dashed">
          <p className="text-sm text-maia-ink-soft">Signed in, but this account is not authorized for Business OS. A Student sees only their own businesses; staff need the &quot;Business OS&quot; permission.</p>
        </Card>
      )}

      {state === "no-student" && (
        <Card className="border-dashed">
          <p className="text-sm text-maia-ink-soft">Business OS is a Student-owned workspace — sign in with a Student account to see your businesses.</p>
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

      {state === "ready" && (
        <>
          <Card>
            <CardHeader title="Business Switcher" subtitle="Switching business changes the entire operational context below (spec section 3) — nothing from another business ever leaks in." />
            {businesses.length === 0 ? (
              <p className="mt-3 text-sm text-maia-ink-soft">No business yet. Create one from My Master Brain to get started.</p>
            ) : (
              <select
                value={selectedBusinessId ?? ""}
                onChange={(e) => setSelectedBusinessId(e.target.value)}
                className="mt-3 rounded-lg border border-maia-border px-3 py-2 text-sm sm:max-w-sm"
              >
                {businesses.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} {b.stage ? `(${b.stage})` : ""}
                  </option>
                ))}
              </select>
            )}
          </Card>

          {home && (
            <>
              <Card>
                <CardHeader title={`${home.business.name} — Business Home`} subtitle={`UI mode: ${home.business.uiExperienceLevel}. ${home.business.stage ? `Stage: ${home.business.stage}.` : "Stage not yet set."}`} />
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Fact label="Open Opportunities" value={home.salesSnapshot.openOpportunityCount} />
                  <Fact label="Active Campaigns" value={home.marketingSnapshot.activeCampaignCount} />
                  <Fact label="Open Action Items" value={home.actionItems.length} />
                  <Fact label="Goals Tracked" value={home.goals.length} />
                </div>
              </Card>

              <Card>
                <CardHeader title="Business Health" subtitle="Explainable categories — never a 0-100 AI score (spec section 16)." />
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {home.health.map((h) => (
                    <div key={h.category} className="rounded-xl border border-maia-border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-maia-ink">{h.category.replace(/_/g, " ")}</span>
                        <Badge tone={HEALTH_TONE[h.status] ?? "neutral"}>{h.status.replace(/_/g, " ")}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-maia-ink-soft">{h.reason}</p>
                    </div>
                  ))}
                </div>
              </Card>

              <Card>
                <CardHeader title="Today's Priorities (Action Center)" subtitle="Every item opens the exact record that needs attention (spec section 9)." />
                {home.actionItems.length === 0 && <p className="mt-3 text-sm text-maia-ink-soft">No open action items right now.</p>}
                <div className="mt-3 flex flex-col gap-2">
                  {home.actionItems.map((item, i) => (
                    <div key={i} className="rounded-xl border border-maia-border p-3">
                      <div className="flex items-center gap-2">
                        <Badge tone="warning">{item.type.replace(/_/g, " ")}</Badge>
                        <span className="text-sm font-semibold text-maia-ink">{item.title}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card>
                <CardHeader title="Goals" subtitle="MANUAL goals only move when a human updates them; COMPUTED goals recompute from a real query — never invented progress (spec section 13)." />
                {home.goals.length === 0 && <p className="mt-3 text-sm text-maia-ink-soft">No goals set yet.</p>}
                <div className="mt-3 flex flex-col gap-2">
                  {home.goals.map((g) => (
                    <div key={g.id} className="rounded-xl border border-maia-border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-maia-ink">{g.name}</span>
                        <Badge tone="info">{g.status.replace(/_/g, " ")}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-maia-ink-soft">
                        {g.currentValue} / {g.target} {g.unit} — source: {g.dataSource}
                      </p>
                      {g.statusReason && <p className="mt-1 text-xs text-maia-ink-soft">{g.statusReason}</p>}
                    </div>
                  ))}
                </div>
              </Card>

              <Card>
                <CardHeader title="Unified CRM — Contacts" subtitle="A Person, never duplicated — reused across the Academy's own records and this Business's CRM (spec section 26)." />
                <button onClick={handleQuickAddContact} className="mt-3 rounded-lg border border-maia-border px-3 py-1.5 text-xs font-bold text-maia-ink">
                  + Add Contact
                </button>
                {contacts.length === 0 ? (
                  <p className="mt-3 text-sm text-maia-ink-soft">No contacts yet.</p>
                ) : (
                  <div className="mt-3 flex flex-col gap-2">
                    {contacts.map((c) => (
                      <div key={c.id} className="flex items-center justify-between rounded-xl border border-maia-border p-3">
                        <div>
                          <p className="text-sm font-bold text-maia-ink">{c.person.fullName}</p>
                          <p className="text-xs text-maia-ink-soft">{c.person.email ?? "No email on file"}</p>
                        </div>
                        <Badge tone="neutral">{c.pipelineStageKey.replace(/_/g, " ")}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card>
                <CardHeader title="Ask M.A.I.A. — Business Copilot" subtitle='Every fact is retrieved, never estimated. Try: "How is my business doing?" or "Which leads need follow-up?"' />
                <form onSubmit={handleAsk} className="mt-3 flex gap-2">
                  <input type="text" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="What should I focus on today?" className="flex-1 rounded-lg border border-maia-border px-3 py-2 text-sm" />
                  <button type="submit" disabled={asking} className="rounded-lg bg-maia-gold-deep px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                    {asking ? "Asking…" : "Ask"}
                  </button>
                </form>
                {answer && (
                  <div className="mt-3 rounded-xl border border-maia-border p-3">
                    {"error" in answer ? (
                      <p className="text-sm text-maia-danger">{answer.error}</p>
                    ) : answer.kind === "FACT" ? (
                      <>
                        <p className="text-sm text-maia-ink">{answer.answer}</p>
                        <p className="mt-1 text-[10px] uppercase tracking-wider text-maia-ink-soft">FACT{answer.aiPhrased ? " (AI-reworded, facts unchanged)" : " (unmodified)"}</p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm text-maia-ink">{answer.guidance}</p>
                        <p className="mt-1 text-[10px] uppercase tracking-wider text-maia-ink-soft">ROUTED TO: {answer.module}</p>
                      </>
                    )}
                  </div>
                )}
              </Card>
            </>
          )}
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
