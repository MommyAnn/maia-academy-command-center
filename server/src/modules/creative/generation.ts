// Structured M.A.I.A. Creative Studio generation (Phase 11 spec sections
// 8-9, 24-33, 82). Reuses the EXACT same access/usage/context/model
// plumbing as the generic AI Tools engine (src/modules/ai-tools/engine.ts)
// — checkToolAccess, checkUsageLimits, buildAiRequestContext (which still
// enforces the published-Master-Brain gate, per the Creative Context
// Engine's "always start from Business + Published Master Brain" rule) and
// resolveModelConfig. The only real difference from runToolGeneration is
// that the provider call ends in generateStructured() instead of
// generate(), and the parsed result is persisted into real domain rows
// (CreativeAngle/Hook/Script/Storyboard+Scene/ScenePrompt) rather than left
// as an opaque AiGeneration.outputJson text blob. Every call here still
// creates a real AiGeneration audit row — full output traceability
// (Business/Campaign/Master Brain Version/Tool/Prompt Version/Provider/
// Model/User/Timestamp) is never lost just because the output is
// structured.

import type { Prisma } from "@prisma/client";
import { db } from "../../db.js";
import { getProvider, resolveModelConfig } from "../../ai/registry.js";
import { buildAiRequestContext, renderUserMessage } from "../ai/context.js";
import { validateGeneratedOutput } from "../ai/validation.js";
import { checkToolAccess } from "../ai-tools/access.js";
import { checkUsageLimits } from "../ai-tools/usage.js";
import { generateAiGenerationDisplayId } from "../sequence.js";
import { writeAuditLog, type AuditAction } from "../../audit/log.js";

export type CreativeGenerationOutcome<T> =
  | { ok: true; generationId: string; data: T }
  | { ok: false; httpStatus: number; reason: string; generationId?: string };

interface PrepareInput {
  studentId: string;
  businessId: string;
  campaignId: string;
  toolKey: string;
  userRequest: string;
}

async function prepareCampaignGeneration(input: PrepareInput) {
  const access = await checkToolAccess(input.studentId, input.toolKey);
  if (!access.allowed) return { ok: false as const, httpStatus: 403, reason: access.reason! };

  const tool = await db.aiTool.findUnique({ where: { toolKey: input.toolKey } });
  if (!tool) return { ok: false as const, httpStatus: 404, reason: "Unknown AI tool." };
  const student = await db.student.findUnique({ where: { id: input.studentId } });
  if (!student) return { ok: false as const, httpStatus: 404, reason: "Unknown student." };

  const usage = await checkUsageLimits(input.studentId, tool.id, student.packageId);
  if (!usage.allowed) return { ok: false as const, httpStatus: 429, reason: usage.reason! };

  const campaign = await db.campaign.findUnique({ where: { id: input.campaignId } });
  if (!campaign || campaign.studentId !== input.studentId || campaign.businessId !== input.businessId) {
    return { ok: false as const, httpStatus: 403, reason: "This campaign does not belong to the requesting student/business." };
  }

  const contextResult = await buildAiRequestContext({
    studentId: input.studentId,
    businessId: input.businessId,
    toolKey: input.toolKey,
    userRequest: input.userRequest,
  });
  if (!contextResult.ok) {
    const httpStatus = contextResult.code === "BUSINESS_NOT_OWNED" || contextResult.code === "REFERENCE_NOT_OWNED" ? 403 : contextResult.code === "NO_MASTER_BRAIN" ? 422 : 404;
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

  return { ok: true as const, prepared: { tool, context, campaign, baseData, resolvedConfig: resolved.config } };
}

/** Runs the structured provider call, creates the AiGeneration audit row (success or failure), and returns the parsed data on success. Domain-row persistence is the caller's job. */
async function runStructured<T>(
  prepared: NonNullable<Awaited<ReturnType<typeof prepareCampaignGeneration>> extends infer R ? (R extends { ok: true; prepared: infer P } ? P : never) : never>,
  schema: Record<string, unknown>,
  schemaName: string,
  actorUserId: string,
): Promise<CreativeGenerationOutcome<T>> {
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
    return { ok: false, httpStatus: 502, reason: result.message, generationId: generation.id };
  }

  const sourceText = JSON.stringify(context.masterBrainSections ?? {});
  const validation = validateGeneratedOutput(JSON.stringify(result.data.data), sourceText);

  const generation = await db.aiGeneration.create({
    data: {
      ...baseData,
      provider: resolvedConfig.provider,
      model: resolvedConfig.model,
      outputJson: result.data.data as unknown as Prisma.InputJsonValue,
      status: "COMPLETED",
      usageJson: result.data.usage as unknown as Prisma.InputJsonValue,
      validationJson: validation as unknown as Prisma.InputJsonValue,
      completedAt: new Date(),
    },
  });
  await writeAuditLog({ action: "AI Tool Used", summary: `${tool.name} used`, actorUserId, entityType: "AiGeneration", entityId: generation.id });
  await writeAuditLog({
    action: "AI Generation Completed",
    summary: `${tool.name} generation completed${validation.isClean ? "" : " (validation flags present)"}`,
    actorUserId,
    entityType: "AiGeneration",
    entityId: generation.id,
  });

  return { ok: true, generationId: generation.id, data: result.data.data };
}

function campaignFactsLine(campaign: { name: string; objective: string; product: string | null; offer: string | null; audience: string | null; platform: string | null; funnelStage: string | null }): string {
  const parts = [`Objective: ${campaign.objective}`];
  if (campaign.product) parts.push(`Product: ${campaign.product}`);
  if (campaign.offer) parts.push(`Offer: ${campaign.offer}`);
  if (campaign.audience) parts.push(`Audience: ${campaign.audience}`);
  if (campaign.platform) parts.push(`Platform: ${campaign.platform}`);
  if (campaign.funnelStage) parts.push(`Funnel Stage: ${campaign.funnelStage}`);
  return `CAMPAIGN "${campaign.name}" — ${parts.join("; ")}`;
}

async function afterSuccess(action: AuditAction, summary: string, actorUserId: string, entityId: string) {
  await writeAuditLog({ action, summary, actorUserId, entityType: "Campaign", entityId });
}

// ---------------------------------------------------------------------------
// 1. Creative Angle Engine (spec: 16 named angle types, grounded in real
//    audience/offer — never a generic viral angle disconnected from this
//    specific business).
// ---------------------------------------------------------------------------

interface AngleDraft {
  angleName: string;
  angleType: string;
  audience?: string;
  awarenessStage?: string;
  coreMessage: string;
  painOrDesire?: string;
  offerConnection?: string;
}
interface AnglesResult {
  angles: AngleDraft[];
}

export async function generateCreativeAngles(input: {
  studentId: string;
  businessId: string;
  campaignId: string;
  angleCount?: number;
  actorUserId: string;
}): Promise<CreativeGenerationOutcome<{ id: string; angleName: string; angleType: string }[]>> {
  const count = input.angleCount && input.angleCount > 0 ? Math.min(input.angleCount, 12) : 5;
  const campaignRow = await db.campaign.findUniqueOrThrow({ where: { id: input.campaignId } });
  const prep = await prepareCampaignGeneration({
    studentId: input.studentId,
    businessId: input.businessId,
    campaignId: input.campaignId,
    toolKey: "creative-angle-engine",
    userRequest: `Generate ${count} distinct creative angles for this campaign.\n${campaignFactsLine(campaignRow)}`,
  });
  if (!prep.ok) return prep;
  const campaign = prep.prepared.campaign;

  const schema = {
    type: "object",
    required: ["angles"],
    properties: {
      angles: {
        type: "array",
        items: {
          type: "object",
          required: ["angleName", "angleType", "coreMessage"],
          properties: {
            angleName: { type: "string" },
            angleType: {
              type: "string",
              enum: ["Pain", "Desire", "Problem", "Transformation", "Education", "Demonstration", "Comparison", "Objection", "Founder Story", "Social Proof", "UGC", "Authority", "Curiosity", "Opportunity", "Lifestyle", "Before/After"],
            },
            audience: { type: "string" },
            awarenessStage: { type: "string" },
            coreMessage: { type: "string" },
            painOrDesire: { type: "string" },
            offerConnection: { type: "string" },
          },
        },
      },
    },
  };

  const outcome = await runStructured<AnglesResult>(prep.prepared, schema, "CreativeAngles", input.actorUserId);
  if (!outcome.ok) return outcome;

  const created = await db.$transaction(
    outcome.data.angles.map((a) =>
      db.creativeAngle.create({
        data: {
          campaignId: campaign.id,
          studentId: input.studentId,
          businessId: input.businessId,
          angleName: a.angleName,
          angleType: a.angleType,
          audience: a.audience ?? null,
          awarenessStage: a.awarenessStage ?? null,
          coreMessage: a.coreMessage,
          painOrDesire: a.painOrDesire ?? null,
          offerConnection: a.offerConnection ?? null,
          sourceGenerationId: outcome.generationId,
        },
      }),
    ),
  );

  await afterSuccess("Creative Angle Generated", `${created.length} creative angle(s) generated for campaign ${campaign.name}`, input.actorUserId, campaign.id);
  return { ok: true, generationId: outcome.generationId, data: created.map((c) => ({ id: c.id, angleName: c.angleName, angleType: c.angleType })) };
}

// ---------------------------------------------------------------------------
// 2. Hook Lab (spec: 10 named hook categories, grounded in real audience/
//    offer — never random viral hooks).
// ---------------------------------------------------------------------------

interface HookDraft {
  category: string;
  text: string;
}
interface HooksResult {
  hooks: HookDraft[];
}

export async function generateHooks(input: {
  studentId: string;
  businessId: string;
  campaignId: string;
  angleId?: string;
  hookCount?: number;
  actorUserId: string;
}): Promise<CreativeGenerationOutcome<{ id: string; category: string; text: string }[]>> {
  const count = input.hookCount && input.hookCount > 0 ? Math.min(input.hookCount, 20) : 10;

  let angle: { id: string; angleName: string; coreMessage: string } | null = null;
  if (input.angleId) {
    const found = await db.creativeAngle.findUnique({ where: { id: input.angleId } });
    if (!found || found.campaignId !== input.campaignId || found.businessId !== input.businessId) {
      return { ok: false, httpStatus: 403, reason: "This creative angle does not belong to the requesting campaign/business." };
    }
    angle = found;
  }

  const campaignRow = await db.campaign.findUniqueOrThrow({ where: { id: input.campaignId } });
  const prep = await prepareCampaignGeneration({
    studentId: input.studentId,
    businessId: input.businessId,
    campaignId: input.campaignId,
    toolKey: "hook-lab",
    userRequest: `Generate ${count} hook variations for this campaign${angle ? ` built on the angle "${angle.angleName}" (core message: ${angle.coreMessage})` : ""}.\n${campaignFactsLine(campaignRow)}`,
  });
  if (!prep.ok) return prep;
  const campaign = prep.prepared.campaign;

  const schema = {
    type: "object",
    required: ["hooks"],
    properties: {
      hooks: {
        type: "array",
        items: {
          type: "object",
          required: ["category", "text"],
          properties: {
            category: { type: "string", enum: ["PAIN", "QUESTION", "CURIOSITY", "PROBLEM", "DESIRE", "CONTRARIAN", "STORY", "DEMONSTRATION", "OBJECTION", "PATTERN_INTERRUPT"] },
            text: { type: "string" },
          },
        },
      },
    },
  };

  const outcome = await runStructured<HooksResult>(prep.prepared, schema, "CreativeHooks", input.actorUserId);
  if (!outcome.ok) return outcome;

  const created = await db.$transaction(
    outcome.data.hooks.map((h) =>
      db.hook.create({
        data: {
          campaignId: campaign.id,
          angleId: angle?.id ?? null,
          studentId: input.studentId,
          businessId: input.businessId,
          category: h.category,
          text: h.text,
          sourceGenerationId: outcome.generationId,
        },
      }),
    ),
  );

  await afterSuccess("Hook Generated", `${created.length} hook(s) generated for campaign ${campaign.name}`, input.actorUserId, campaign.id);
  return { ok: true, generationId: outcome.generationId, data: created.map((h) => ({ id: h.id, category: h.category, text: h.text })) };
}

// ---------------------------------------------------------------------------
// 3. Script Studio (spec: adaptable section structure; mandatory fact-check
//    — must never invent awards, testimonials, certifications, results, or
//    guarantees).
// ---------------------------------------------------------------------------

interface ScriptSectionDraft {
  type: string;
  content: string;
}
interface ScriptResult {
  scriptType: string;
  platform?: string;
  durationSeconds?: number;
  presenterType?: string;
  cta?: string;
  sections: ScriptSectionDraft[];
}

export async function generateScript(input: {
  studentId: string;
  businessId: string;
  campaignId: string;
  angleId?: string;
  hookId?: string;
  scriptType?: string;
  durationSeconds?: number;
  actorUserId: string;
}): Promise<CreativeGenerationOutcome<{ id: string; scriptType: string; status: string }>> {
  let angle: { id: string; angleName: string; coreMessage: string } | null = null;
  if (input.angleId) {
    const found = await db.creativeAngle.findUnique({ where: { id: input.angleId } });
    if (!found || found.campaignId !== input.campaignId || found.businessId !== input.businessId) {
      return { ok: false, httpStatus: 403, reason: "This creative angle does not belong to the requesting campaign/business." };
    }
    angle = found;
  }
  let hook: { id: string; category: string; text: string } | null = null;
  if (input.hookId) {
    const found = await db.hook.findUnique({ where: { id: input.hookId } });
    if (!found || found.campaignId !== input.campaignId || found.businessId !== input.businessId) {
      return { ok: false, httpStatus: 403, reason: "This hook does not belong to the requesting campaign/business." };
    }
    hook = found;
  }

  const campaignRow = await db.campaign.findUniqueOrThrow({ where: { id: input.campaignId } });
  const requestParts = [
    `Write a script${input.scriptType ? ` of type "${input.scriptType}"` : ""}${input.durationSeconds ? ` targeting ~${input.durationSeconds} seconds` : ""}.`,
    campaignFactsLine(campaignRow),
  ];
  if (angle) requestParts.push(`ANGLE: ${angle.angleName} — ${angle.coreMessage}`);
  if (hook) requestParts.push(`HOOK (${hook.category}): ${hook.text}`);

  const prep = await prepareCampaignGeneration({
    studentId: input.studentId,
    businessId: input.businessId,
    campaignId: input.campaignId,
    toolKey: "script-studio",
    userRequest: requestParts.join("\n"),
  });
  if (!prep.ok) return prep;
  const campaign = prep.prepared.campaign;

  const schema = {
    type: "object",
    required: ["scriptType", "sections"],
    properties: {
      scriptType: { type: "string" },
      platform: { type: "string" },
      durationSeconds: { type: "number" },
      presenterType: { type: "string" },
      cta: { type: "string" },
      sections: {
        type: "array",
        items: {
          type: "object",
          required: ["type", "content"],
          properties: {
            type: { type: "string", enum: ["HOOK", "PROBLEM", "AGITATION", "INSIGHT", "SOLUTION", "OFFER", "PROOF", "OBJECTION_HANDLING", "CTA"] },
            content: { type: "string" },
          },
        },
      },
    },
  };

  const outcome = await runStructured<ScriptResult>(prep.prepared, schema, "CreativeScript", input.actorUserId);
  if (!outcome.ok) return outcome;

  const outputText = outcome.data.sections.map((s) => s.content).join("\n");
  const sourceText = JSON.stringify(prep.prepared.context.masterBrainSections ?? {});
  const validation = validateGeneratedOutput(outputText, sourceText);

  const script = await db.script.create({
    data: {
      campaignId: campaign.id,
      angleId: angle?.id ?? null,
      hookId: hook?.id ?? null,
      studentId: input.studentId,
      businessId: input.businessId,
      scriptType: outcome.data.scriptType,
      platform: outcome.data.platform ?? null,
      durationSeconds: outcome.data.durationSeconds ?? input.durationSeconds ?? null,
      presenterType: outcome.data.presenterType ?? null,
      cta: outcome.data.cta ?? null,
      sectionsJson: outcome.data.sections as unknown as Prisma.InputJsonValue,
      status: "Draft",
      version: 1,
      validationJson: validation as unknown as Prisma.InputJsonValue,
      sourceGenerationId: outcome.generationId,
      createdById: input.actorUserId,
    },
  });

  await afterSuccess("Script Generated", `Script generated for campaign ${campaign.name}${validation.isClean ? "" : " (claim-safety flags present — review required)"}`, input.actorUserId, script.id);
  return { ok: true, generationId: outcome.generationId, data: { id: script.id, scriptType: script.scriptType, status: script.status } };
}

// ---------------------------------------------------------------------------
// 4. Storyboard Studio (spec: breaks an APPROVED script into scenes; full
//    per-scene field list).
// ---------------------------------------------------------------------------

interface SceneDraft {
  sceneNumber: number;
  durationSeconds?: number;
  dialogue?: string;
  character?: string;
  characterAction?: string;
  facialExpression?: string;
  location?: string;
  cameraShot?: string;
  cameraMovement?: string;
  composition?: string;
  lighting?: string;
  props?: string;
  bRoll?: string;
  onScreenText?: string;
  graphicElements?: string;
  transition?: string;
  soundDirection?: string;
  continuityNotes?: string;
}
interface StoryboardResult {
  visualStyle?: string;
  scenes: SceneDraft[];
}

export async function generateStoryboard(input: {
  studentId: string;
  businessId: string;
  campaignId: string;
  scriptId: string;
  visualStyle?: string;
  actorUserId: string;
}): Promise<CreativeGenerationOutcome<{ id: string; sceneCount: number }>> {
  const script = await db.script.findUnique({ where: { id: input.scriptId } });
  if (!script || script.campaignId !== input.campaignId || script.businessId !== input.businessId) {
    return { ok: false, httpStatus: 403, reason: "This script does not belong to the requesting campaign/business." };
  }
  if (script.status !== "Approved") {
    return { ok: false, httpStatus: 409, reason: `Cannot storyboard a script with status "${script.status}" — the script must be Approved first (spec: storyboard is built from an approved script).` };
  }

  const campaignRow = await db.campaign.findUniqueOrThrow({ where: { id: input.campaignId } });
  const sections = script.sectionsJson as unknown as ScriptSectionDraft[];
  const requestParts = [
    `Break this approved script into a scene-by-scene storyboard${input.visualStyle ? ` in a "${input.visualStyle}" visual style` : ""}.`,
    campaignFactsLine(campaignRow),
    `SCRIPT (${script.scriptType}${script.durationSeconds ? `, ~${script.durationSeconds}s` : ""}):\n${sections.map((s) => `[${s.type}] ${s.content}`).join("\n")}`,
  ];

  const prep = await prepareCampaignGeneration({
    studentId: input.studentId,
    businessId: input.businessId,
    campaignId: input.campaignId,
    toolKey: "storyboard-studio",
    userRequest: requestParts.join("\n\n"),
  });
  if (!prep.ok) return prep;
  const campaign = prep.prepared.campaign;

  const schema = {
    type: "object",
    required: ["scenes"],
    properties: {
      visualStyle: { type: "string" },
      scenes: {
        type: "array",
        items: {
          type: "object",
          required: ["sceneNumber"],
          properties: {
            sceneNumber: { type: "number" },
            durationSeconds: { type: "number" },
            dialogue: { type: "string" },
            character: { type: "string" },
            characterAction: { type: "string" },
            facialExpression: { type: "string" },
            location: { type: "string" },
            cameraShot: { type: "string" },
            cameraMovement: { type: "string" },
            composition: { type: "string" },
            lighting: { type: "string" },
            props: { type: "string" },
            bRoll: { type: "string" },
            onScreenText: { type: "string" },
            graphicElements: { type: "string" },
            transition: { type: "string" },
            soundDirection: { type: "string" },
            continuityNotes: { type: "string" },
          },
        },
      },
    },
  };

  const outcome = await runStructured<StoryboardResult>(prep.prepared, schema, "CreativeStoryboard", input.actorUserId);
  if (!outcome.ok) return outcome;

  const storyboard = await db.storyboard.create({
    data: {
      scriptId: script.id,
      campaignId: campaign.id,
      studentId: input.studentId,
      businessId: input.businessId,
      visualStyle: outcome.data.visualStyle ?? input.visualStyle ?? null,
      status: "Draft",
      version: 1,
    },
  });
  await db.storyboardScene.createMany({
    data: outcome.data.scenes.map((s) => ({
      storyboardId: storyboard.id,
      sceneNumber: s.sceneNumber,
      durationSeconds: s.durationSeconds ?? null,
      dialogue: s.dialogue ?? null,
      character: s.character ?? null,
      characterAction: s.characterAction ?? null,
      facialExpression: s.facialExpression ?? null,
      location: s.location ?? null,
      cameraShot: s.cameraShot ?? null,
      cameraMovement: s.cameraMovement ?? null,
      composition: s.composition ?? null,
      lighting: s.lighting ?? null,
      props: s.props ?? null,
      bRoll: s.bRoll ?? null,
      onScreenText: s.onScreenText ?? null,
      graphicElements: s.graphicElements ?? null,
      transition: s.transition ?? null,
      soundDirection: s.soundDirection ?? null,
      continuityNotes: s.continuityNotes ?? null,
    })),
  });

  await afterSuccess("Storyboard Generated", `Storyboard (${outcome.data.scenes.length} scenes) generated for campaign ${campaign.name}`, input.actorUserId, storyboard.id);
  return { ok: true, generationId: outcome.generationId, data: { id: storyboard.id, sceneCount: outcome.data.scenes.length } };
}

// ---------------------------------------------------------------------------
// 5. Scene Prompt Studio (image + video prompt, combined — spec sections
//    30-33: character continuity is auto-injected, never left for the model
//    to infer; spec section 40-44: PROMPT TEXT ONLY, no real media
//    generation exists in this build).
// ---------------------------------------------------------------------------

interface ScenePromptResult {
  imagePromptText: string;
  imagePromptStructured: { subject?: string; environment?: string; composition?: string; lighting?: string; colorPalette?: string; cameraAngle?: string; style?: string; mood?: string };
  videoPromptText: string;
  videoPromptStructured: { subject?: string; environment?: string; action?: string; cameraMovement?: string; duration?: string; transition?: string; style?: string; mood?: string };
}

const DEFAULT_CONTINUITY_INSTRUCTIONS =
  "Use the provided character reference as the same main character, and maintain consistent face, facial features, skin tone, hair, body proportions, age appearance, and identity.";

export async function generateScenePrompt(input: {
  studentId: string;
  businessId: string;
  campaignId: string;
  sceneId: string;
  characterProfileId?: string;
  actorUserId: string;
}): Promise<CreativeGenerationOutcome<{ id: string; imagePromptText: string; videoPromptText: string }>> {
  const scene = await db.storyboardScene.findUnique({ where: { id: input.sceneId }, include: { storyboard: true } });
  if (!scene || scene.storyboard.studentId !== input.studentId || scene.storyboard.businessId !== input.businessId || scene.storyboard.campaignId !== input.campaignId) {
    return { ok: false, httpStatus: 403, reason: "This storyboard scene does not belong to the requesting campaign/business." };
  }

  let character: { id: string; name: string; appearanceNotes: string | null; defaultWardrobe: string | null; continuityInstructions: string | null } | null = null;
  if (input.characterProfileId) {
    const found = await db.characterProfile.findUnique({ where: { id: input.characterProfileId } });
    if (!found || found.businessId !== input.businessId) {
      return { ok: false, httpStatus: 403, reason: "This character profile does not belong to the requesting business." };
    }
    character = found;
  }

  const campaignRow = await db.campaign.findUniqueOrThrow({ where: { id: input.campaignId } });
  const requestParts = [
    `Generate a production-ready IMAGE prompt and VIDEO prompt for this single storyboard scene. No real generation provider is connected — produce PROMPT TEXT only.`,
    campaignFactsLine(campaignRow),
    `SCENE ${scene.sceneNumber}: ${JSON.stringify({
      dialogue: scene.dialogue,
      character: scene.character,
      characterAction: scene.characterAction,
      facialExpression: scene.facialExpression,
      location: scene.location,
      cameraShot: scene.cameraShot,
      cameraMovement: scene.cameraMovement,
      composition: scene.composition,
      lighting: scene.lighting,
      props: scene.props,
      bRoll: scene.bRoll,
      onScreenText: scene.onScreenText,
      graphicElements: scene.graphicElements,
      continuityNotes: scene.continuityNotes,
    })}`,
  ];
  if (character) {
    requestParts.push(
      `CHARACTER REFERENCE (must be reflected in both prompts): Name: ${character.name}; Appearance: ${character.appearanceNotes ?? "not specified"}; Default Wardrobe: ${character.defaultWardrobe ?? "not specified"}. Continuity instruction to embed verbatim in each prompt: "${character.continuityInstructions ?? DEFAULT_CONTINUITY_INSTRUCTIONS}"`,
    );
  }

  const prep = await prepareCampaignGeneration({
    studentId: input.studentId,
    businessId: input.businessId,
    campaignId: input.campaignId,
    toolKey: "scene-prompt-studio",
    userRequest: requestParts.join("\n\n"),
  });
  if (!prep.ok) return prep;

  const schema = {
    type: "object",
    required: ["imagePromptText", "imagePromptStructured", "videoPromptText", "videoPromptStructured"],
    properties: {
      imagePromptText: { type: "string" },
      imagePromptStructured: {
        type: "object",
        properties: {
          subject: { type: "string" },
          environment: { type: "string" },
          composition: { type: "string" },
          lighting: { type: "string" },
          colorPalette: { type: "string" },
          cameraAngle: { type: "string" },
          style: { type: "string" },
          mood: { type: "string" },
        },
      },
      videoPromptText: { type: "string" },
      videoPromptStructured: {
        type: "object",
        properties: {
          subject: { type: "string" },
          environment: { type: "string" },
          action: { type: "string" },
          cameraMovement: { type: "string" },
          duration: { type: "string" },
          transition: { type: "string" },
          style: { type: "string" },
          mood: { type: "string" },
        },
      },
    },
  };

  const outcome = await runStructured<ScenePromptResult>(prep.prepared, schema, "ScenePrompt", input.actorUserId);
  if (!outcome.ok) return outcome;

  const scenePrompt = await db.scenePrompt.create({
    data: {
      sceneId: scene.id,
      characterProfileId: character?.id ?? null,
      studentId: input.studentId,
      businessId: input.businessId,
      targetProvider: "GENERIC",
      imagePromptText: outcome.data.imagePromptText,
      imagePromptStructuredJson: outcome.data.imagePromptStructured as unknown as Prisma.InputJsonValue,
      videoPromptText: outcome.data.videoPromptText,
      videoPromptStructuredJson: outcome.data.videoPromptStructured as unknown as Prisma.InputJsonValue,
      status: "PROMPT_READY",
      sourceGenerationId: outcome.generationId,
    },
  });

  await afterSuccess("Scene Prompt Generated", `Scene ${scene.sceneNumber} prompt generated${character ? ` (character reference: ${character.name})` : ""}`, input.actorUserId, scenePrompt.id);
  return { ok: true, generationId: outcome.generationId, data: { id: scenePrompt.id, imagePromptText: scenePrompt.imagePromptText, videoPromptText: scenePrompt.videoPromptText } };
}
