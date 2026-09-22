// The generic, config-driven AI Tool generation engine (spec sections 8-9,
// 24-25) — every one of the 18 tools runs through this SAME function.
// Nothing here is tool-specific; what differs per tool lives entirely in
// data (AiTool.modelConfigId, its ACTIVE PromptVersion, AiTool.outputSchemaJson)
// read by the context engine.

import type { Prisma } from "@prisma/client";
import { db } from "../../db.js";
import { getProvider, resolveModelConfig } from "../../ai/registry.js";
import { buildAiRequestContext, renderUserMessage } from "../ai/context.js";
import { validateGeneratedOutput } from "../ai/validation.js";
import { checkToolAccess } from "./access.js";
import { checkUsageLimits } from "./usage.js";
import { generateAiGenerationDisplayId } from "../sequence.js";
import { writeAuditLog } from "../../audit/log.js";

export interface RunGenerationInput {
  studentId: string;
  businessId: string;
  toolKey: string;
  userRequest: string;
  projectId?: string;
  referenceDocumentIds?: string[];
  actorUserId: string;
}

export type RunGenerationOutcome = { ok: true; generationId: string } | { ok: false; httpStatus: number; reason: string };

export async function runToolGeneration(input: RunGenerationInput): Promise<RunGenerationOutcome> {
  const access = await checkToolAccess(input.studentId, input.toolKey);
  if (!access.allowed) return { ok: false, httpStatus: 403, reason: access.reason! };

  const tool = await db.aiTool.findUnique({ where: { toolKey: input.toolKey } });
  if (!tool) return { ok: false, httpStatus: 404, reason: "Unknown AI tool." };
  const student = await db.student.findUnique({ where: { id: input.studentId } });
  if (!student) return { ok: false, httpStatus: 404, reason: "Unknown student." };

  const usage = await checkUsageLimits(input.studentId, tool.id, student.packageId);
  if (!usage.allowed) return { ok: false, httpStatus: 429, reason: usage.reason! };

  const contextResult = await buildAiRequestContext({
    studentId: input.studentId,
    businessId: input.businessId,
    toolKey: input.toolKey,
    userRequest: input.userRequest,
    referenceDocumentIds: input.referenceDocumentIds,
  });
  if (!contextResult.ok) {
    const httpStatus = contextResult.code === "BUSINESS_NOT_OWNED" || contextResult.code === "REFERENCE_NOT_OWNED" ? 403 : contextResult.code === "NO_MASTER_BRAIN" ? 422 : 404;
    return { ok: false, httpStatus, reason: contextResult.reason };
  }
  const context = contextResult.context;

  const generationDisplayId = await generateAiGenerationDisplayId();
  const baseData = {
    generationDisplayId,
    studentId: input.studentId,
    businessId: input.businessId,
    projectId: input.projectId ?? null,
    toolId: tool.id,
    promptVersionId: context.promptVersionId,
    masterBrainDocumentId: context.masterBrainDocumentId,
    masterBrainVersion: context.masterBrainVersion,
    userInputJson: { userRequest: input.userRequest, referenceAssetIds: context.referenceAssetIds } as Prisma.InputJsonValue,
    requestedAt: new Date(),
  };

  const resolved = context.modelConfigKey ? await resolveModelConfig(context.modelConfigKey) : ({ ok: false as const, reason: "This tool has no model configuration assigned." });

  if (!resolved.ok) {
    const generation = await db.aiGeneration.create({
      data: { ...baseData, status: "FAILED", failureReason: resolved.reason, errorCategory: "ProviderUnavailable", completedAt: new Date() },
    });
    await writeAuditLog({ action: "AI Generation Failed", summary: `${tool.name} generation failed: no usable model configuration`, actorUserId: input.actorUserId, entityType: "AiGeneration", entityId: generation.id });
    return { ok: true, generationId: generation.id };
  }

  const provider = getProvider(resolved.config.provider);
  const userMessage = renderUserMessage(context);
  const result = await provider.generate({
    model: resolved.config.model,
    systemInstruction: context.systemInstruction,
    userMessage,
    maxOutputTokens: resolved.config.maxOutputTokens,
    temperature: resolved.config.temperature,
  });

  if (!result.ok) {
    const generation = await db.aiGeneration.create({
      data: { ...baseData, provider: resolved.config.provider, model: resolved.config.model, status: "FAILED", failureReason: result.message, errorCategory: result.errorCategory, completedAt: new Date() },
    });
    await writeAuditLog({ action: "AI Generation Failed", summary: `${tool.name} generation failed: ${result.errorCategory}`, actorUserId: input.actorUserId, entityType: "AiGeneration", entityId: generation.id });
    return { ok: true, generationId: generation.id };
  }

  const sourceText = JSON.stringify(context.masterBrainSections ?? {});
  const validation = validateGeneratedOutput(result.data.text, sourceText);

  const generation = await db.aiGeneration.create({
    data: {
      ...baseData,
      provider: resolved.config.provider,
      model: resolved.config.model,
      outputJson: { text: result.data.text, stopReason: result.data.stopReason } as Prisma.InputJsonValue,
      status: "COMPLETED",
      usageJson: result.data.usage as unknown as Prisma.InputJsonValue,
      validationJson: validation as unknown as Prisma.InputJsonValue,
      completedAt: new Date(),
    },
  });

  await writeAuditLog({ action: "AI Tool Used", summary: `${tool.name} used`, actorUserId: input.actorUserId, entityType: "AiGeneration", entityId: generation.id });
  await writeAuditLog({
    action: "AI Generation Completed",
    summary: `${tool.name} generation completed${validation.isClean ? "" : " (validation flags present)"}`,
    actorUserId: input.actorUserId,
    entityType: "AiGeneration",
    entityId: generation.id,
  });

  return { ok: true, generationId: generation.id };
}

/** Retry (spec section 58) — always a NEW AiGeneration row; the original failure record is never overwritten. */
export async function retryGeneration(generationId: string, actorUserId: string): Promise<RunGenerationOutcome> {
  const original = await db.aiGeneration.findUnique({ where: { id: generationId } });
  if (!original) return { ok: false, httpStatus: 404, reason: "Generation not found." };
  if (original.status !== "FAILED") return { ok: false, httpStatus: 409, reason: `Cannot retry a generation with status ${original.status} — only FAILED generations can be retried.` };

  const tool = await db.aiTool.findUniqueOrThrow({ where: { id: original.toolId } });
  const inputJson = original.userInputJson as { userRequest?: string; referenceAssetIds?: string[] } | null;

  const outcome = await runToolGeneration({
    studentId: original.studentId,
    businessId: original.businessId,
    toolKey: tool.toolKey,
    userRequest: inputJson?.userRequest ?? "",
    projectId: original.projectId ?? undefined,
    referenceDocumentIds: inputJson?.referenceAssetIds,
    actorUserId,
  });
  if (outcome.ok) {
    await db.aiGeneration.update({ where: { id: outcome.generationId }, data: { retryOfGenerationId: original.id } });
  }
  return outcome;
}
