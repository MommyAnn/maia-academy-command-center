// AI context engine (spec sections 21-23) — the single place that turns
// (Student, Business, Master Brain, Tool, Request) into what actually gets
// sent to an AI provider. Context minimization is structural here, not a
// policy note: this module never queries PaymentTransaction, Document
// (beyond an explicitly-approved reference asset), Requirement, StudentNote,
// or any other Academy-operational table — there is no code path by which
// a Copywriter request could leak a Valid ID or a payment record.

import { db } from "../../db.js";
import type { MasterBrainDocumentSection } from "./validation.js";

export interface AiRequestContext {
  studentId: string;
  businessId: string;
  businessName: string;
  masterBrainDocumentId: string | null;
  masterBrainVersion: number | null;
  masterBrainSections: MasterBrainDocumentSection[] | null;
  toolId: string;
  toolKey: string;
  toolName: string;
  systemInstruction: string;
  promptVersionId: string;
  modelConfigKey: string | null;
  userRequest: string;
  referenceAssetIds: string[];
}

export type ContextBuildResult =
  | { ok: true; context: AiRequestContext }
  | { ok: false; code: "BUSINESS_NOT_OWNED" | "TOOL_UNAVAILABLE" | "NO_MASTER_BRAIN" | "REFERENCE_NOT_OWNED"; reason: string };

export interface BuildContextInput {
  studentId: string;
  businessId: string;
  toolKey: string;
  userRequest: string;
  referenceDocumentIds?: string[];
  /** Most tools require a published Master Brain (spec section 34); pass false only for tools explicitly designed to run without one. */
  requireMasterBrain?: boolean;
}

/** Applies the tool's own `usageRulesJson.relevantMasterBrainSections` allow-list, when configured, so a tool never receives sections it has no use for (spec section 22's worked example). */
function minimizeSections(sections: MasterBrainDocumentSection[], usageRulesJson: unknown): MasterBrainDocumentSection[] {
  const rules = usageRulesJson as { relevantMasterBrainSections?: string[] } | null;
  const allowList = rules?.relevantMasterBrainSections;
  if (!allowList || allowList.length === 0) return sections;
  return sections.filter((section) => allowList.includes(section.key));
}

export async function buildAiRequestContext(input: BuildContextInput): Promise<ContextBuildResult> {
  const business = await db.business.findUnique({ where: { id: input.businessId } });
  if (!business || business.studentId !== input.studentId) {
    return { ok: false, code: "BUSINESS_NOT_OWNED", reason: "This business does not belong to the requesting student." };
  }

  const tool = await db.aiTool.findUnique({ where: { toolKey: input.toolKey }, include: { promptVersions: true, modelConfig: true } });
  if (!tool || tool.status !== "ACTIVE") {
    return { ok: false, code: "TOOL_UNAVAILABLE", reason: "This AI tool is not currently available." };
  }
  const activePrompt = tool.promptVersions.find((p) => p.status === "ACTIVE");
  if (!activePrompt) {
    return { ok: false, code: "TOOL_UNAVAILABLE", reason: "This AI tool has no published (Active) prompt instructions." };
  }

  const submission = await db.masterBrainSubmission.findUnique({
    where: { businessId: input.businessId },
    include: { documents: { where: { isCurrentPublished: true }, take: 1 } },
  });
  const publishedDoc = submission?.documents[0] ?? null;

  if (!publishedDoc && (input.requireMasterBrain ?? true)) {
    return { ok: false, code: "NO_MASTER_BRAIN", reason: "COMPLETE_YOUR_BRAND_MASTER_BRAIN_FIRST" };
  }

  let referenceAssetIds: string[] = [];
  if (input.referenceDocumentIds && input.referenceDocumentIds.length > 0) {
    const docs = await db.document.findMany({ where: { id: { in: input.referenceDocumentIds } } });
    const allOwned = docs.length === input.referenceDocumentIds.length && docs.every((d) => d.ownerStudentId === input.studentId || d.ownerBusinessId === input.businessId);
    if (!allOwned) {
      return { ok: false, code: "REFERENCE_NOT_OWNED", reason: "One or more reference assets are not owned by this student or business." };
    }
    referenceAssetIds = docs.map((d) => d.id);
  }

  const rawSections = (publishedDoc?.sectionsJson as unknown as MasterBrainDocumentSection[] | undefined) ?? null;

  return {
    ok: true,
    context: {
      studentId: input.studentId,
      businessId: input.businessId,
      businessName: business.name,
      masterBrainDocumentId: publishedDoc?.id ?? null,
      masterBrainVersion: publishedDoc?.documentVersion ?? null,
      masterBrainSections: rawSections ? minimizeSections(rawSections, tool.usageRulesJson) : null,
      toolId: tool.id,
      toolKey: tool.toolKey,
      toolName: tool.name,
      systemInstruction: activePrompt.systemInstruction,
      promptVersionId: activePrompt.id,
      modelConfigKey: tool.modelConfig?.configKey ?? null,
      userRequest: input.userRequest,
      referenceAssetIds,
    },
  };
}

/** Renders the final user-turn message sent to the provider — brand context first, then the Student's own request, kept to exactly what the context carries. */
export function renderUserMessage(context: AiRequestContext): string {
  const parts: string[] = [];
  if (context.masterBrainSections) {
    parts.push(`BRAND CONTEXT (Business: ${context.businessName}):\n${JSON.stringify(context.masterBrainSections, null, 2)}`);
  } else {
    parts.push(`BUSINESS: ${context.businessName} (no published Brand Master Brain — use neutral, general wording only).`);
  }
  parts.push(`\nSTUDENT REQUEST:\n${context.userRequest}`);
  return parts.join("\n");
}
