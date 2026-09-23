// Ask M.A.I.A. Ads (spec sections 91-95) — the same fixed-handler,
// grounded-retrieval pattern Phase 10's Ask M.A.I.A. established
// (src/modules/intelligence/ask.ts): every number comes from real
// deterministic retrieval below; an optional AI pass may only reword the
// already-computed facts into a sentence, never invent a new one. If the AI
// provider is unavailable, the raw factual answer is returned directly.

import { db } from "../../db.js";
import { resolveModelConfig, getProvider } from "../../ai/registry.js";
import { aggregateSnapshots, deriveMetrics } from "./metrics.js";
import { getCreativePerformanceRollup } from "./creative.js";
import { getRevenueAttribution } from "./attribution.js";

export interface AskAdsContext {
  studentId: string;
  businessId: string;
  adAccountId: string;
}

interface QuestionHandler {
  match: RegExp;
  retrieve: (ctx: AskAdsContext) => Promise<{ facts: Record<string, unknown>; factualAnswer: string }>;
}

function last30Days(): { from: Date; to: Date } {
  const to = new Date();
  const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
  return { from, to };
}

const HANDLERS: QuestionHandler[] = [
  {
    match: /how.*ads?.*(performing|doing)|ads?.*performance/i,
    async retrieve(ctx) {
      const { from, to } = last30Days();
      const snapshots = await db.adPerformanceSnapshot.findMany({ where: { adAccountId: ctx.adAccountId, dateFrom: { gte: from }, dateTo: { lte: to } } });
      const aggregate = aggregateSnapshots(snapshots);
      const derived = deriveMetrics(aggregate);
      return {
        facts: { aggregate, derived, dateRange: { from, to } },
        factualAnswer:
          aggregate.spend === null
            ? "No ad performance data is available for this account in the last 30 days yet."
            : `Over the last 30 days: spend ${aggregate.spend.toFixed(2)}, ${aggregate.impressions ?? "unknown"} impressions, ${aggregate.leads ?? "unknown"} leads, CPL ${derived.cpl !== null ? derived.cpl.toFixed(2) : "unknown"}.`,
      };
    },
  },
  {
    match: /cpl.*(increase|up|higher)|why.*cpl/i,
    async retrieve(ctx) {
      const { from, to } = last30Days();
      const priorTo = new Date(from.getTime() - 24 * 60 * 60 * 1000);
      const priorFrom = new Date(priorTo.getTime() - (to.getTime() - from.getTime()));
      const [current, prior] = await Promise.all([
        db.adPerformanceSnapshot.findMany({ where: { adAccountId: ctx.adAccountId, dateFrom: { gte: from }, dateTo: { lte: to } } }),
        db.adPerformanceSnapshot.findMany({ where: { adAccountId: ctx.adAccountId, dateFrom: { gte: priorFrom }, dateTo: { lte: priorTo } } }),
      ]);
      const currentCpl = deriveMetrics(aggregateSnapshots(current)).cpl;
      const priorCpl = deriveMetrics(aggregateSnapshots(prior)).cpl;
      if (currentCpl === null || priorCpl === null) {
        return { facts: { currentCpl, priorCpl }, factualAnswer: "There isn't enough data in both the current and previous periods to compare CPL." };
      }
      const changePct = ((currentCpl - priorCpl) / priorCpl) * 100;
      return {
        facts: { currentCpl, priorCpl, changePct },
        factualAnswer: `CPL went from ${priorCpl.toFixed(2)} to ${currentCpl.toFixed(2)} (${changePct >= 0 ? "+" : ""}${changePct.toFixed(1)}%) over the last 30 days vs the prior period. Run the Ads Analyzer on a specific campaign for possible explanations.`,
      };
    },
  },
  {
    match: /highest ctr|best creative|which (hook|creative)/i,
    async retrieve(ctx) {
      const { from, to } = last30Days();
      const rollup = await getCreativePerformanceRollup({ adAccountId: ctx.adAccountId, groupBy: "hook", dateFrom: from, dateTo: to });
      const sorted = rollup.filter((r) => r.derived.ctr !== null).sort((a, b) => (b.derived.ctr ?? 0) - (a.derived.ctr ?? 0));
      if (sorted.length === 0) {
        return { facts: { rollup }, factualAnswer: "No ads with a linked hook and real CTR data were found for this account in the last 30 days." };
      }
      const top = sorted[0]!;
      return {
        facts: { top, rollup: sorted },
        factualAnswer: `TOP-PERFORMING BY CTR: "${top.groupLabel}" at ${((top.derived.ctr ?? 0) * 100).toFixed(2)}% CTR across ${top.adCount} ad(s).`,
      };
    },
  },
  {
    match: /verified enrollments?|which campaign.*enroll/i,
    async retrieve(ctx) {
      const campaigns = await db.adCampaign.findMany({ where: { adAccountId: ctx.adAccountId } });
      const { from, to } = last30Days();
      const rows = await Promise.all(
        campaigns.map(async (c) => ({ name: c.name, revenue: await getRevenueAttribution(c.id, from, to) })),
      );
      const ranked = rows.filter((r) => r.revenue.attributedEnrollmentCount > 0).sort((a, b) => b.revenue.attributedEnrollmentCount - a.revenue.attributedEnrollmentCount);
      if (ranked.length === 0) {
        return { facts: { rows }, factualAnswer: "No campaign in this account has an attributed enrollment yet." };
      }
      return {
        facts: { ranked },
        factualAnswer: ranked.map((r) => `${r.name}: ${r.revenue.attributedEnrollmentCount} enrollment(s)`).join("; "),
      };
    },
  },
  {
    match: /what should i test|what to test next|test next/i,
    async retrieve(ctx) {
      const recommendations = await db.adRecommendation.findMany({ where: { businessId: ctx.businessId, status: "OPEN", category: { in: ["TEST_SUGGESTION", "CREATIVE_FATIGUE"] } }, orderBy: { createdAt: "desc" }, take: 5 });
      return {
        facts: { count: recommendations.length, recommendations: recommendations.map((r) => r.title) },
        factualAnswer: recommendations.length === 0 ? "No open test suggestions right now — run the Ads Analyzer or a Creative Fatigue check to generate new ones." : recommendations.map((r) => r.title).join("; "),
      };
    },
  },
];

export type AskAdsResult =
  | { ok: true; answer: string; facts: Record<string, unknown>; source: "RULE-BASED"; aiPhrased: boolean }
  | { ok: false; reason: "NO_MATCHING_HANDLER" };

export async function askMaiaAds(question: string, ctx: AskAdsContext): Promise<AskAdsResult> {
  const handler = HANDLERS.find((h) => h.match.test(question));
  if (!handler) return { ok: false, reason: "NO_MATCHING_HANDLER" };

  const { facts, factualAnswer } = await handler.retrieve(ctx);

  const resolved = await resolveModelConfig("default");
  if (!resolved.ok) return { ok: true, answer: factualAnswer, facts, source: "RULE-BASED", aiPhrased: false };

  const provider = getProvider(resolved.config.provider);
  const result = await provider.generate({
    model: resolved.config.model,
    systemInstruction:
      "You reword an already-computed factual answer about advertising performance into one short, clear sentence for a business owner. " +
      "You must not add, infer, or change any number or fact. If you cannot reword it faithfully, repeat it verbatim. Never claim causality that isn't in the facts.",
    userMessage: `Question: ${question}\nComputed factual answer: ${factualAnswer}\nFacts: ${JSON.stringify(facts)}`,
    maxOutputTokens: 200,
  });

  if (!result.ok) return { ok: true, answer: factualAnswer, facts, source: "RULE-BASED", aiPhrased: false };
  return { ok: true, answer: result.data.text.trim() || factualAnswer, facts, source: "RULE-BASED", aiPhrased: true };
}
