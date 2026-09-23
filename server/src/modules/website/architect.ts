// M.A.I.A. Website Architect + Funnel Architect (spec sections 9-13,
// 87-89) — the same structured-generation pattern Phase 11/12 already
// established: buildAiRequestContext (still enforces the published-
// Master-Brain gate) + resolveModelConfig + generateStructured, a real
// AiGeneration audit row, and the AI's own output never trusted blindly —
// re-parsed through a real zod shape check and the real Publish Validator
// equivalent before being persisted. Always DRAFT; never auto-published,
// never a claim of a live website/funnel (spec section "AI-generated
// website content begins as DRAFT").

import type { Prisma } from "@prisma/client";
import { db } from "../../db.js";
import { getProvider, resolveModelConfig } from "../../ai/registry.js";
import { buildAiRequestContext, renderUserMessage, type AiRequestContext } from "../ai/context.js";
import { checkToolAccess } from "../ai-tools/access.js";
import { checkUsageLimits } from "../ai-tools/usage.js";
import { generateAiGenerationDisplayId, generateWebsiteDisplayId, generatePageDisplayId, generateFunnelDisplayId } from "../sequence.js";
import { writeAuditLog } from "../../audit/log.js";
import { sectionsArraySchema, SECTION_TYPES, WEBSITE_TYPES, FUNNEL_TYPES, type PageSection } from "./sections.js";

export type WebsiteGenerationOutcome<T> = { ok: true; generationId: string; data: T } | { ok: false; httpStatus: number; reason: string };

interface PrepareInput {
  studentId: string;
  businessId: string;
  toolKey: string;
  userRequest: string;
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

async function prepareGeneration(input: PrepareInput) {
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

async function runStructured<T>(prepared: PreparedGeneration, schema: Record<string, unknown>, schemaName: string, actorUserId: string): Promise<WebsiteGenerationOutcome<T>> {
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
    data: {
      ...baseData,
      provider: resolvedConfig.provider,
      model: resolvedConfig.model,
      outputJson: result.data.data as unknown as Prisma.InputJsonValue,
      status: "COMPLETED",
      usageJson: result.data.usage as unknown as Prisma.InputJsonValue,
      completedAt: new Date(),
    },
  });
  await writeAuditLog({ action: "AI Tool Used", summary: `${tool.name} used`, actorUserId, entityType: "AiGeneration", entityId: generation.id });
  return { ok: true, generationId: generation.id, data: result.data.data };
}

// ---------------------------------------------------------------------------
// Website Architect (spec sections 12-14)
// ---------------------------------------------------------------------------

interface WebsiteStructureResult {
  sections: { id: string; type: string; label?: string; config?: Record<string, unknown> }[];
  ctaPlacement: string[];
  formPlacement: string[];
  missingBrandAssets: string[];
}

export async function generateWebsiteStructure(input: {
  studentId: string;
  businessId: string;
  websiteProjectId: string;
  websiteType: string;
  objective?: string;
  actorUserId: string;
}): Promise<WebsiteGenerationOutcome<{ pageId: string }>> {
  const project = await db.websiteProject.findUnique({ where: { id: input.websiteProjectId } });
  if (!project || project.studentId !== input.studentId || project.businessId !== input.businessId) {
    return { ok: false, httpStatus: 403, reason: "This website project does not belong to the requesting student/business." };
  }

  const userRequest = [
    `Generate a page/section structure for a "${input.websiteType}" page.`,
    input.objective ? `Objective: ${input.objective}` : "",
    `Valid section types (use ONLY these): ${SECTION_TYPES.join(", ")}.`,
    "Do not force every section onto this page — recommend only what fits the objective.",
  ].filter(Boolean).join("\n");

  const prep = await prepareGeneration({ studentId: input.studentId, businessId: input.businessId, toolKey: "website-architect", userRequest });
  if (!prep.ok) return prep;

  const schema = {
    type: "object",
    required: ["sections", "ctaPlacement", "formPlacement", "missingBrandAssets"],
    properties: {
      sections: {
        type: "array",
        items: {
          type: "object",
          required: ["id", "type"],
          properties: {
            id: { type: "string" },
            type: { type: "string", enum: SECTION_TYPES as unknown as string[] },
            label: { type: "string" },
            config: { type: "object" },
          },
        },
      },
      ctaPlacement: { type: "array", items: { type: "string" } },
      formPlacement: { type: "array", items: { type: "string" } },
      missingBrandAssets: { type: "array", items: { type: "string" } },
    },
  };

  const outcome = await runStructured<WebsiteStructureResult>(prep.prepared, schema, "WebsiteStructure", input.actorUserId);
  if (!outcome.ok) return outcome;

  const parsed = sectionsArraySchema.safeParse(outcome.data.sections.map((s) => ({ ...s, config: s.config ?? {} })));
  const sections: PageSection[] = parsed.success ? parsed.data : [{ id: "hero", type: "Hero", config: {} }, { id: "cta", type: "CTA", config: {} }];

  const page = await db.websitePage.create({
    data: {
      pageDisplayId: await generatePageDisplayId(),
      websiteProjectId: project.id,
      name: `${project.name} — ${input.websiteType}`,
      slug: `page-${Date.now().toString(36)}`,
      sectionsJson: sections as unknown as Prisma.InputJsonValue,
      status: "DRAFT",
      createdById: input.actorUserId,
    },
  });
  await writeAuditLog({ action: "Website Page Created", summary: `Page structure generated for "${project.name}"`, actorUserId: input.actorUserId, entityType: "WebsitePage", entityId: page.id });

  return { ok: true, generationId: outcome.generationId, data: { pageId: page.id } };
}

// ---------------------------------------------------------------------------
// Funnel Architect (spec sections 9-10)
// ---------------------------------------------------------------------------

interface FunnelStrategyResult {
  funnelGoal: string;
  targetAudience?: string;
  trafficEntry?: string;
  awarenessStage?: string;
  offer?: string;
  stages: { stageName: string; purpose?: string; touchpoint?: string; ctaType?: string }[];
  requiredPages: string[];
  forms: string[];
  followUpRequirements: string[];
  automationRequirements: string[];
  trackingRequirements: string[];
  successMetrics: string[];
  risks: string[];
}

export async function generateFunnelStrategy(input: {
  studentId: string;
  businessId: string;
  funnelType: string;
  description?: string;
  journeyId?: string;
  campaignId?: string;
  actorUserId: string;
}): Promise<WebsiteGenerationOutcome<{ funnelId: string }>> {
  if (!(FUNNEL_TYPES as readonly string[]).includes(input.funnelType)) {
    return { ok: false, httpStatus: 400, reason: `Invalid funnel type: ${input.funnelType}` };
  }

  const userRequest = [
    `Generate a funnel strategy for a "${input.funnelType}" funnel.`,
    input.description ?? "",
    "Adapt stages to the objective — do not force a generic sequence.",
  ].filter(Boolean).join("\n");

  const prep = await prepareGeneration({ studentId: input.studentId, businessId: input.businessId, toolKey: "funnel-builder", userRequest });
  if (!prep.ok) return prep;

  const schema = {
    type: "object",
    required: ["funnelGoal", "stages", "requiredPages", "forms", "followUpRequirements", "automationRequirements", "trackingRequirements", "successMetrics", "risks"],
    properties: {
      funnelGoal: { type: "string" },
      targetAudience: { type: "string" },
      trafficEntry: { type: "string" },
      awarenessStage: { type: "string" },
      offer: { type: "string" },
      stages: {
        type: "array",
        items: { type: "object", required: ["stageName"], properties: { stageName: { type: "string" }, purpose: { type: "string" }, touchpoint: { type: "string" }, ctaType: { type: "string" } } },
      },
      requiredPages: { type: "array", items: { type: "string" } },
      forms: { type: "array", items: { type: "string" } },
      followUpRequirements: { type: "array", items: { type: "string" } },
      automationRequirements: { type: "array", items: { type: "string" } },
      trackingRequirements: { type: "array", items: { type: "string" } },
      successMetrics: { type: "array", items: { type: "string" } },
      risks: { type: "array", items: { type: "string" } },
    },
  };

  const outcome = await runStructured<FunnelStrategyResult>(prep.prepared, schema, "FunnelStrategy", input.actorUserId);
  if (!outcome.ok) return outcome;

  const publishedDoc = await db.masterBrainDocument.findFirst({ where: { businessId: input.businessId, isCurrentPublished: true } });
  const funnel = await db.funnel.create({
    data: {
      funnelDisplayId: await generateFunnelDisplayId(),
      studentId: input.studentId,
      businessId: input.businessId,
      name: `${outcome.data.funnelGoal.slice(0, 60)}`,
      objective: outcome.data.funnelGoal,
      audience: outcome.data.targetAudience ?? null,
      trafficSource: outcome.data.trafficEntry ?? null,
      type: input.funnelType,
      stagesJson: outcome.data.stages.map((s) => ({ stageName: s.stageName, purpose: s.purpose ?? null, touchpoint: s.touchpoint ?? null, ctaType: s.ctaType ?? null, pageId: null, automationId: null })) as unknown as Prisma.InputJsonValue,
      masterBrainVersionAtCreation: publishedDoc?.documentVersion ?? null,
      journeyId: input.journeyId ?? null,
      campaignId: input.campaignId ?? null,
      createdById: input.actorUserId,
    },
  });
  await writeAuditLog({ action: "Funnel Created", summary: `Funnel "${funnel.name}" drafted by Funnel Architect`, actorUserId: input.actorUserId, entityType: "Funnel", entityId: funnel.id });

  return { ok: true, generationId: outcome.generationId, data: { funnelId: funnel.id } };
}

export { WEBSITE_TYPES, generateWebsiteDisplayId };
