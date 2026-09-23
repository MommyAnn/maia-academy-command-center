// M.A.I.A. Ads Campaign Planner (spec sections 68-73, 87-89) — the same
// structured-generation pattern Phase 11/12/13 already established. Always
// produces a DRAFT AdCampaignPlan — a planning artifact, never a live
// campaign (spec section 69); converting one into a real AdCampaign is
// always a separate, explicit human action.

import type { Prisma } from "@prisma/client";
import { db } from "../../db.js";
import { getProvider, resolveModelConfig } from "../../ai/registry.js";
import { buildAiRequestContext, renderUserMessage, type AiRequestContext } from "../ai/context.js";
import { checkToolAccess } from "../ai-tools/access.js";
import { checkUsageLimits } from "../ai-tools/usage.js";
import { generateAiGenerationDisplayId, generateAdCampaignPlanDisplayId } from "../sequence.js";
import { writeAuditLog } from "../../audit/log.js";

export type PlannerOutcome = { ok: true; generationId: string; planId: string } | { ok: false; httpStatus: number; reason: string };

interface PlanBody {
  audience: string;
  offer: string;
  creativeStrategy: string;
  creativeVariations: string[];
  funnel: string;
  tracking: string;
  budgetContext: string;
  testingPlan: string[];
  metricsToWatch: string[];
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

const PLAN_SCHEMA = {
  type: "object",
  required: ["audience", "offer", "creativeStrategy", "creativeVariations", "funnel", "tracking", "budgetContext", "testingPlan", "metricsToWatch", "risks"],
  properties: {
    audience: { type: "string" },
    offer: { type: "string" },
    creativeStrategy: { type: "string" },
    creativeVariations: { type: "array", items: { type: "string" } },
    funnel: { type: "string" },
    tracking: { type: "string" },
    budgetContext: { type: "string" },
    testingPlan: { type: "array", items: { type: "string" } },
    metricsToWatch: { type: "array", items: { type: "string" } },
    risks: { type: "array", items: { type: "string" } },
  },
};

export async function generateCampaignPlan(input: {
  studentId: string;
  businessId: string;
  objective: string;
  offerId?: string;
  offerContext?: string;
  audienceNotes?: string;
  budgetContext?: string;
  actorUserId: string;
}): Promise<PlannerOutcome> {
  const userRequest = [
    `Generate a DRAFT ads campaign plan. Objective: ${input.objective}.`,
    input.offerContext ? `Offer/product context: ${input.offerContext}` : "",
    input.audienceNotes ? `Audience notes: ${input.audienceNotes}` : "",
    input.budgetContext ? `Budget context: ${input.budgetContext}` : "",
    "This is a PLAN only — never claim it is a live campaign, never guarantee platform approval, ROAS, leads, or sales. Never recommend targeting based on sensitive personal attributes. Never label an audience 'guaranteed buyers'.",
  ].filter(Boolean).join("\n");

  const prep = await prepareGeneration({ studentId: input.studentId, businessId: input.businessId, toolKey: "facebook-ads-strategist", userRequest });
  if (!prep.ok) return prep;

  const outcome = await runStructured<PlanBody>(prep.prepared, PLAN_SCHEMA, "AdsCampaignPlan", input.actorUserId);
  if (!outcome.ok) return outcome;

  const plan = await db.adCampaignPlan.create({
    data: {
      planDisplayId: await generateAdCampaignPlanDisplayId(),
      studentId: input.studentId,
      businessId: input.businessId,
      offerId: input.offerId ?? null,
      objective: input.objective,
      audienceJson: { notes: outcome.data.audience } as unknown as Prisma.InputJsonValue,
      creativeStrategyJson: { strategy: outcome.data.creativeStrategy, variations: outcome.data.creativeVariations } as unknown as Prisma.InputJsonValue,
      funnelPlanJson: { funnel: outcome.data.funnel } as unknown as Prisma.InputJsonValue,
      trackingPlanJson: { tracking: outcome.data.tracking } as unknown as Prisma.InputJsonValue,
      budgetContextJson: { context: outcome.data.budgetContext } as unknown as Prisma.InputJsonValue,
      testingPlanJson: outcome.data.testingPlan as unknown as Prisma.InputJsonValue,
      metricsToWatchJson: outcome.data.metricsToWatch as unknown as Prisma.InputJsonValue,
      generationId: outcome.generationId,
      createdById: input.actorUserId,
    },
  });
  await writeAuditLog({ action: "Ad Campaign Plan Created", summary: `Campaign plan "${plan.planDisplayId}" drafted (objective: ${input.objective})`, actorUserId: input.actorUserId, entityType: "AdCampaignPlan", entityId: plan.id });

  return { ok: true, generationId: outcome.generationId, planId: plan.id };
}
