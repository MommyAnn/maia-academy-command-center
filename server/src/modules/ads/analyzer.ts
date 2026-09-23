// M.A.I.A. Ads Analyzer (spec sections 27-30, 93-95) — the same structured-
// generation pattern Phase 11/12/13 already established: checkToolAccess ->
// checkUsageLimits -> buildAiRequestContext -> resolveModelConfig ->
// generateStructured, a real AiGeneration audit row, and the AI's own
// output never trusted blindly. Grounded ONLY in real retrieved
// AdPerformanceSnapshot data for the requested scope and date range plus
// its immediately preceding comparison period (spec section 94) — never
// analyzes a metric that isn't actually present (spec section 26).

import type { Prisma } from "@prisma/client";
import { db } from "../../db.js";
import { getProvider, resolveModelConfig } from "../../ai/registry.js";
import { buildAiRequestContext, renderUserMessage, type AiRequestContext } from "../ai/context.js";
import { checkToolAccess } from "../ai-tools/access.js";
import { checkUsageLimits } from "../ai-tools/usage.js";
import { generateAiGenerationDisplayId, generateAdRecommendationDisplayId } from "../sequence.js";
import { writeAuditLog } from "../../audit/log.js";
import { resolveDateRange, DATE_RANGE_PRESETS, type DateRangePreset } from "./date-range.js";
import { aggregateSnapshots, deriveMetrics, type AggregatedMetrics, type DerivedMetrics } from "./metrics.js";

export type AnalyzerOutcome = { ok: true; generationId: string; recommendationId: string; body: AnalyzerBody } | { ok: false; httpStatus: number; reason: string };

interface AnalyzerBody {
  observedFacts: string[];
  metricChanges: string[];
  potentialStrengths: string[];
  potentialWeaknesses: string[];
  possibleExplanations: string[];
  recommendedTests: string[];
  risks: string[];
}

interface PreparedGeneration {
  tool: NonNullable<Awaited<ReturnType<typeof db.aiTool.findUnique>>>;
  context: AiRequestContext;
  baseData: {
    generationDisplayId: string;
    studentId: string;
    businessId: string;
    projectId: null;
    toolId: string;
    promptVersionId: string;
    masterBrainDocumentId: string | null;
    masterBrainVersion: number | null;
    userInputJson: Prisma.InputJsonValue;
    requestedAt: Date;
  };
  resolvedConfig: { provider: Parameters<typeof getProvider>[0]; model: string; maxOutputTokens: number; temperature?: number };
}

async function prepareGeneration(input: { studentId: string; businessId: string; toolKey: string; userRequest: string }) {
  const access = await checkToolAccess(input.studentId, input.toolKey);
  if (!access.allowed) return { ok: false as const, httpStatus: 403, reason: access.reason! };

  const tool = await db.aiTool.findUnique({ where: { toolKey: input.toolKey } });
  if (!tool) return { ok: false as const, httpStatus: 404, reason: "Unknown AI tool." };
  const student = await db.student.findUnique({ where: { id: input.studentId } });
  if (!student) return { ok: false as const, httpStatus: 404, reason: "Unknown student." };

  const usage = await checkUsageLimits(input.studentId, tool.id, student.packageId);
  if (!usage.allowed) return { ok: false as const, httpStatus: 429, reason: usage.reason! };

  const contextResult = await buildAiRequestContext({ studentId: input.studentId, businessId: input.businessId, toolKey: input.toolKey, userRequest: input.userRequest });
  if (!contextResult.ok) {
    const httpStatus = contextResult.code === "BUSINESS_NOT_OWNED" ? 403 : contextResult.code === "NO_MASTER_BRAIN" ? 422 : 404;
    return { ok: false as const, httpStatus, reason: contextResult.reason };
  }
  const context = contextResult.context;
  if (!context.modelConfigKey) return { ok: false as const, httpStatus: 422, reason: "This tool has no model configuration assigned." };
  const resolved = await resolveModelConfig(context.modelConfigKey);
  if (!resolved.ok) return { ok: false as const, httpStatus: 503, reason: resolved.reason };

  const generationDisplayId = await generateAiGenerationDisplayId();
  const baseData = {
    generationDisplayId,
    studentId: input.studentId,
    businessId: input.businessId,
    projectId: null,
    toolId: tool.id,
    promptVersionId: context.promptVersionId,
    masterBrainDocumentId: context.masterBrainDocumentId,
    masterBrainVersion: context.masterBrainVersion,
    userInputJson: { userRequest: input.userRequest } as Prisma.InputJsonValue,
    requestedAt: new Date(),
  };

  return { ok: true as const, prepared: { tool, context, baseData, resolvedConfig: resolved.config } };
}

async function runStructured<T>(prepared: PreparedGeneration, schema: Record<string, unknown>, schemaName: string, actorUserId: string): Promise<{ ok: true; generationId: string; data: T } | { ok: false; httpStatus: number; reason: string }> {
  const { tool, context, baseData, resolvedConfig } = prepared;
  const provider = getProvider(resolvedConfig.provider);
  const userMessage = renderUserMessage(context);

  const result = await provider.generateStructured<T>({
    model: resolvedConfig.model,
    systemInstruction: context.systemInstruction,
    userMessage,
    maxOutputTokens: resolvedConfig.maxOutputTokens,
    temperature: resolvedConfig.temperature,
    schema,
    schemaName,
  });

  if (!result.ok) {
    const generation = await db.aiGeneration.create({
      data: { ...baseData, provider: resolvedConfig.provider, model: resolvedConfig.model, status: "FAILED", failureReason: result.message, errorCategory: result.errorCategory, completedAt: new Date() },
    });
    await writeAuditLog({ action: "AI Generation Failed", summary: `${tool.name} generation failed: ${result.errorCategory}`, actorUserId, entityType: "AiGeneration", entityId: generation.id });
    return { ok: false, httpStatus: 502, reason: result.message };
  }

  const generation = await db.aiGeneration.create({
    data: { ...baseData, provider: resolvedConfig.provider, model: resolvedConfig.model, outputJson: result.data.data as unknown as Prisma.InputJsonValue, status: "COMPLETED", usageJson: result.data.usage as unknown as Prisma.InputJsonValue, completedAt: new Date() },
  });
  await writeAuditLog({ action: "AI Tool Used", summary: `${tool.name} used`, actorUserId, entityType: "AiGeneration", entityId: generation.id });
  return { ok: true, generationId: generation.id, data: result.data.data };
}

const ANALYZER_SCHEMA = {
  type: "object",
  required: ["observedFacts", "metricChanges", "potentialStrengths", "potentialWeaknesses", "possibleExplanations", "recommendedTests", "risks"],
  properties: {
    observedFacts: { type: "array", items: { type: "string" } },
    metricChanges: { type: "array", items: { type: "string" } },
    potentialStrengths: { type: "array", items: { type: "string" } },
    potentialWeaknesses: { type: "array", items: { type: "string" } },
    possibleExplanations: { type: "array", items: { type: "string" } },
    recommendedTests: { type: "array", items: { type: "string" } },
    risks: { type: "array", items: { type: "string" } },
  },
};

function formatMetrics(agg: AggregatedMetrics, derived: DerivedMetrics): string {
  const line = (label: string, v: number | null, unit = "") => `${label}: ${v === null ? "UNKNOWN (no data reported)" : `${v.toFixed(2)}${unit}`}`;
  return [
    line("Spend", agg.spend),
    line("Impressions", agg.impressions),
    line("Reach", agg.reach),
    line("Clicks", agg.clicks),
    line("Leads", agg.leads),
    line("Messages", agg.messages),
    line("Purchases", agg.purchases),
    line("Platform-Reported Purchase Value", agg.purchaseValue),
    line("CPL", derived.cpl),
    line("CPC", derived.cpc),
    line("CTR", derived.ctr === null ? null : derived.ctr * 100, "%"),
    line("CPM", derived.cpm),
    line("Platform-Reported ROAS", derived.platformReportedRoas),
  ].join("\n");
}

function previousPeriod(from: Date, to: Date): { from: Date; to: Date } {
  const lengthMs = to.getTime() - from.getTime();
  const prevTo = new Date(from.getTime() - 24 * 60 * 60 * 1000);
  const prevFrom = new Date(prevTo.getTime() - lengthMs);
  return { from: prevFrom, to: prevTo };
}

export async function analyzeAdCampaign(input: {
  studentId: string;
  businessId: string;
  adCampaignId: string;
  preset?: DateRangePreset;
  from?: string;
  to?: string;
  actorUserId: string;
}): Promise<AnalyzerOutcome> {
  const campaign = await db.adCampaign.findUnique({ where: { id: input.adCampaignId } });
  if (!campaign || campaign.studentId !== input.studentId || campaign.businessId !== input.businessId) {
    return { ok: false, httpStatus: 403, reason: "This campaign does not belong to the requesting student/business." };
  }

  let range;
  try {
    range = resolveDateRange(input.preset ?? "LAST_30_DAYS", { from: input.from, to: input.to });
  } catch (err) {
    return { ok: false, httpStatus: 400, reason: err instanceof Error ? err.message : "Invalid date range." };
  }
  const prior = previousPeriod(range.from, range.to);

  const [currentSnapshots, priorSnapshots] = await Promise.all([
    db.adPerformanceSnapshot.findMany({ where: { campaignId: campaign.id, dateFrom: { gte: range.from }, dateTo: { lte: range.to } } }),
    db.adPerformanceSnapshot.findMany({ where: { campaignId: campaign.id, dateFrom: { gte: prior.from }, dateTo: { lte: prior.to } } }),
  ]);

  const currentAgg = aggregateSnapshots(currentSnapshots);
  const currentDerived = deriveMetrics(currentAgg);
  const priorAgg = aggregateSnapshots(priorSnapshots);
  const priorDerived = deriveMetrics(priorAgg);

  const userRequest = [
    `Analyze campaign "${campaign.name}" (objective: ${campaign.objective ?? "not set"}).`,
    `CURRENT PERIOD (${range.from.toISOString().slice(0, 10)} to ${range.to.toISOString().slice(0, 10)}):`,
    formatMetrics(currentAgg, currentDerived),
    `PREVIOUS PERIOD (${prior.from.toISOString().slice(0, 10)} to ${prior.to.toISOString().slice(0, 10)}):`,
    formatMetrics(priorAgg, priorDerived),
    "Only reference metrics explicitly listed above. A metric marked UNKNOWN has no real data — never invent, estimate, or assume its value. Separate FACT from INTERPRETATION at all times.",
  ].join("\n\n");

  const prep = await prepareGeneration({ studentId: input.studentId, businessId: input.businessId, toolKey: "ads-analyzer", userRequest });
  if (!prep.ok) return prep;

  const outcome = await runStructured<AnalyzerBody>(prep.prepared, ANALYZER_SCHEMA, "AdsAnalysis", input.actorUserId);
  if (!outcome.ok) return outcome;

  const recommendation = await db.adRecommendation.create({
    data: {
      recommendationDisplayId: await generateAdRecommendationDisplayId(),
      studentId: input.studentId,
      businessId: input.businessId,
      adCampaignId: campaign.id,
      category: "GENERAL",
      title: `Ads Analyzer report — "${campaign.name}"`,
      bodyJson: outcome.data as unknown as Prisma.InputJsonValue,
      status: "OPEN",
    },
  });

  return { ok: true, generationId: outcome.generationId, recommendationId: recommendation.id, body: outcome.data };
}

export { DATE_RANGE_PRESETS };
