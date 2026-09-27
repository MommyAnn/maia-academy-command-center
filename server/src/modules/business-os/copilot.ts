// M.A.I.A. Business OS — Ask M.A.I.A. Business Copilot (spec sections
// 74-83). Same fixed-handler, grounded-retrieval pattern as Phase 10's Ask
// M.A.I.A. (src/modules/intelligence/ask.ts) and Phase 14's Ask M.A.I.A.
// Ads (src/modules/ads/ask.ts): every fact comes from a real deterministic
// query below; an optional AI pass may only reword an already-computed
// answer, never invent one (spec section 80: "retrieve actual count. Do
// not estimate."). Action-oriented requests are ROUTED to the existing
// Creative/Automation/Website/Ads capabilities (spec section 76) rather
// than this module fabricating a duplicate AI system (spec section 77) —
// this build does not yet auto-create a draft record on the copilot's
// behalf; see the Phase 15 completion report's Blueprint-Only section.

import { db } from "../../db.js";
import { resolveModelConfig, getProvider } from "../../ai/registry.js";
import { computeBusinessHealth, computeActionCenter } from "./home.js";

export interface AskBusinessContext {
  businessId: string;
}

interface FactHandler {
  match: RegExp;
  retrieve: (ctx: AskBusinessContext) => Promise<{ facts: Record<string, unknown>; factualAnswer: string }>;
}

const FACT_HANDLERS: FactHandler[] = [
  {
    match: /focus on today|today.*priorit|what should i do/i,
    async retrieve(ctx) {
      const items = await computeActionCenter(ctx.businessId);
      return {
        facts: { count: items.length, items },
        factualAnswer: items.length === 0 ? "No open action items right now." : items.slice(0, 5).map((i) => i.title).join("; "),
      };
    },
  },
  {
    match: /how is my business|business.*doing|business health/i,
    async retrieve(ctx) {
      const categories = await computeBusinessHealth(ctx.businessId);
      const needsAttention = categories.filter((c) => c.status === "NEEDS_ATTENTION" || c.status === "SETUP_REQUIRED");
      return {
        facts: { categories },
        factualAnswer: needsAttention.length === 0 ? "All tracked categories are OPERATIONAL or have insufficient data to flag." : needsAttention.map((c) => `${c.category}: ${c.status} — ${c.reason}`).join(" | "),
      };
    },
  },
  {
    match: /which leads?.*follow.?up|leads?.*need.*follow/i,
    async retrieve(ctx) {
      const stale = await db.businessContact.findMany({ where: { businessId: ctx.businessId, status: "Active", updatedAt: { lte: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) } }, include: { person: true }, take: 20 });
      return {
        facts: { count: stale.length, contacts: stale.map((c) => ({ id: c.id, name: c.person.fullName })) },
        factualAnswer: stale.length === 0 ? "No contacts are currently overdue for follow-up (3+ days without activity)." : `${stale.length} contact(s) need follow-up: ${stale.slice(0, 5).map((c) => c.person.fullName).join(", ")}${stale.length > 5 ? "…" : ""}.`,
      };
    },
  },
  {
    match: /how many leads?|lead count|number of leads?/i,
    async retrieve(ctx) {
      const count = await db.businessContact.count({ where: { businessId: ctx.businessId } });
      return { facts: { count }, factualAnswer: `${count} business contact(s) recorded.` };
    },
  },
  {
    match: /which campaign.*attention|campaign.*need/i,
    async retrieve(ctx) {
      const campaigns = await db.campaign.findMany({ where: { businessId: ctx.businessId, status: { notIn: ["ACTIVE", "ARCHIVED"] } }, take: 10, select: { id: true, name: true, status: true } });
      return {
        facts: { campaigns },
        factualAnswer: campaigns.length === 0 ? "No campaign is currently stalled outside ACTIVE/ARCHIVED." : campaigns.map((c) => `"${c.name}" is ${c.status}`).join("; "),
      };
    },
  },
  {
    match: /content.*this week|what content should i create/i,
    async retrieve(ctx) {
      const items = await db.contentCalendarItem.findMany({ where: { businessId: ctx.businessId, stage: { in: ["IDEA", "DRAFT"] } }, take: 10, select: { id: true, title: true, stage: true } });
      return {
        facts: { items },
        factualAnswer: items.length === 0 ? "No content ideas or drafts are queued yet — use the Content Calendar to add one." : items.map((i) => `"${i.title}" (${i.stage})`).join("; "),
      };
    },
  },
  {
    match: /open opportunit|sales pipeline|estimated value/i,
    async retrieve(ctx) {
      const opportunities = await db.opportunity.findMany({ where: { businessId: ctx.businessId, status: "OPEN" }, select: { estimatedValue: true } });
      const totalEstimated = opportunities.reduce((sum, o) => sum + Number(o.estimatedValue ?? 0), 0);
      return {
        facts: { count: opportunities.length, totalEstimated },
        factualAnswer: `${opportunities.length} OPEN opportunity(ies), ESTIMATED (not verified) total value ${totalEstimated.toFixed(2)}.`,
      };
    },
  },
];

// Action-oriented requests are routed to the module that actually owns
// that capability (spec section 76) — never executed here directly.
const ROUTE_HANDLERS: { match: RegExp; module: string; guidance: string }[] = [
  { match: /follow.?up automation|build.*automation/i, module: "Automation Studio", guidance: "Use the Automation Architect to build this — it can draft a follow-up automation from your goal and audience." },
  { match: /landing page|create.*page/i, module: "Website & Funnel Studio", guidance: "Use the Funnel/Website Architect to draft a landing page for this offer." },
  { match: /creative ideas?|new (hook|angle|script)/i, module: "Creative Studio", guidance: "Use the Creative Angle/Hook generator to produce new ideas grounded in your Master Brain." },
  { match: /ads?.*performing|ad performance/i, module: "Ads Command Center", guidance: "Open Ask M.A.I.A. Ads inside the Ads Command Center for a real performance answer scoped to a specific ad account." },
];

export type AskBusinessResult =
  | { ok: true; kind: "FACT"; answer: string; facts: Record<string, unknown>; aiPhrased: boolean }
  | { ok: true; kind: "ROUTE"; module: string; guidance: string }
  | { ok: false; reason: "NO_MATCHING_HANDLER" };

export async function askMaiaBusiness(question: string, ctx: AskBusinessContext): Promise<AskBusinessResult> {
  const factHandler = FACT_HANDLERS.find((h) => h.match.test(question));
  if (factHandler) {
    const { facts, factualAnswer } = await factHandler.retrieve(ctx);

    const resolved = await resolveModelConfig("default");
    if (!resolved.ok) return { ok: true, kind: "FACT", answer: factualAnswer, facts, aiPhrased: false };

    const provider = getProvider(resolved.config.provider);
    const result = await provider.generate({
      model: resolved.config.model,
      systemInstruction:
        "You reword an already-computed factual answer about a small business into one short, clear sentence for the business owner. " +
        "You must not add, infer, or change any number or fact. If you cannot reword it faithfully, repeat it verbatim. Never invent a recommendation not present in the facts.",
      userMessage: `Question: ${question}\nComputed factual answer: ${factualAnswer}\nFacts: ${JSON.stringify(facts)}`,
      maxOutputTokens: 200,
    });

    if (!result.ok) return { ok: true, kind: "FACT", answer: factualAnswer, facts, aiPhrased: false };
    return { ok: true, kind: "FACT", answer: result.data.text.trim() || factualAnswer, facts, aiPhrased: true };
  }

  const routeHandler = ROUTE_HANDLERS.find((h) => h.match.test(question));
  if (routeHandler) return { ok: true, kind: "ROUTE", module: routeHandler.module, guidance: routeHandler.guidance };

  return { ok: false, reason: "NO_MATCHING_HANDLER" };
}
