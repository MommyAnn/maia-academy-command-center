// Copy Studio (spec sections 19-21) — connects the EXISTING M.A.I.A.
// Copywriter AiTool via the unchanged generic free-text engine, never a
// parallel copy system (same reuse decision Phase 11's Copy Studio made
// for Campaign copy). Every call is traceable: Business/Page/Section/
// Master Brain Version/Prompt Version/Provider/Model/Created By/Timestamp
// all live on the resulting AiGeneration row, referenced by a
// PageCopyVariant join row — never overwritten, always a new version.

import { db } from "../../db.js";
import { runToolGeneration } from "../ai-tools/engine.js";
import { writeAuditLog } from "../../audit/log.js";
import type { PageSection } from "./sections.js";

export type CopyAction = "Generate" | "Regenerate" | "Shorten" | "Expand" | "ChangeTone" | "Variation";

export interface SectionCopyOutcome {
  ok: boolean;
  httpStatus?: number;
  reason?: string;
  generationId?: string;
  variantId?: string;
  text?: string;
}

export async function generateSectionCopy(input: {
  studentId: string;
  businessId: string;
  pageId: string;
  sectionId: string;
  action: CopyAction;
  tone?: string;
  instructions?: string;
  actorUserId: string;
}): Promise<SectionCopyOutcome> {
  const page = await db.websitePage.findUnique({ where: { id: input.pageId }, include: { websiteProject: true } });
  if (!page || page.websiteProject.studentId !== input.studentId || page.websiteProject.businessId !== input.businessId) {
    return { ok: false, httpStatus: 403, reason: "This page does not belong to the requesting student/business." };
  }
  const sections = (page.sectionsJson as PageSection[]) ?? [];
  const section = sections.find((s) => s.id === input.sectionId);
  if (!section) return { ok: false, httpStatus: 404, reason: "Section not found on this page." };

  const currentCopy = (section.config as { copy?: string }).copy ?? "";
  const parts: string[] = [`PAGE SECTION: ${section.type}${section.label ? ` (${section.label})` : ""}.`];

  switch (input.action) {
    case "Generate":
      parts.push("Write copy for this section from scratch.");
      break;
    case "Regenerate":
      parts.push(`Rewrite this section's copy with a fresh approach. Current copy:\n${currentCopy}`);
      break;
    case "Shorten":
      parts.push(`Shorten this copy while keeping the core message. Current copy:\n${currentCopy}`);
      break;
    case "Expand":
      parts.push(`Expand this copy with more detail. Current copy:\n${currentCopy}`);
      break;
    case "ChangeTone":
      parts.push(`Rewrite this copy in a ${input.tone ?? "different"} tone. Current copy:\n${currentCopy}`);
      break;
    case "Variation":
      parts.push(`Write an alternative variation of this copy (different angle, same message). Current copy:\n${currentCopy}`);
      break;
  }
  if (input.instructions) parts.push(`Additional instructions: ${input.instructions}`);

  const outcome = await runToolGeneration({
    studentId: input.studentId,
    businessId: input.businessId,
    toolKey: "copywriter",
    userRequest: parts.join("\n\n"),
    actorUserId: input.actorUserId,
  });
  if (!outcome.ok) return { ok: false, httpStatus: outcome.httpStatus, reason: outcome.reason };

  const generation = await db.aiGeneration.findUniqueOrThrow({ where: { id: outcome.generationId } });
  if (generation.status !== "COMPLETED") {
    return { ok: false, httpStatus: 502, reason: (generation.failureReason as string | null) ?? "Copy generation failed.", generationId: outcome.generationId };
  }

  const variant = await db.pageCopyVariant.create({
    data: {
      pageId: page.id,
      sectionId: input.sectionId,
      generationId: outcome.generationId,
      action: input.action,
      createdById: input.actorUserId,
    },
  });

  const text = (generation.outputJson as { text?: string } | null)?.text ?? "";
  return { ok: true, generationId: outcome.generationId, variantId: variant.id, text };
}

/** Applies a previously generated variant's text into the section's config — never silently loses the prior copy, since PageCopyVariant history is never deleted (spec section 21). */
export async function applySectionCopyVariant(input: { studentId: string; businessId: string; pageId: string; variantId: string; actorUserId: string }): Promise<SectionCopyOutcome> {
  const page = await db.websitePage.findUnique({ where: { id: input.pageId }, include: { websiteProject: true } });
  if (!page || page.websiteProject.studentId !== input.studentId || page.websiteProject.businessId !== input.businessId) {
    return { ok: false, httpStatus: 403, reason: "This page does not belong to the requesting student/business." };
  }
  const variant = await db.pageCopyVariant.findUnique({ where: { id: input.variantId } });
  if (!variant || variant.pageId !== page.id) return { ok: false, httpStatus: 404, reason: "Variant not found on this page." };

  const generation = await db.aiGeneration.findUniqueOrThrow({ where: { id: variant.generationId } });
  const text = (generation.outputJson as { text?: string } | null)?.text ?? "";

  const sections = (page.sectionsJson as PageSection[]) ?? [];
  const updatedSections = sections.map((s) => (s.id === variant.sectionId ? { ...s, config: { ...s.config, copy: text } } : s));

  await db.websitePage.update({ where: { id: page.id }, data: { sectionsJson: updatedSections as never } });
  await db.pageCopyVariant.updateMany({ where: { pageId: page.id, sectionId: variant.sectionId }, data: { isApplied: false } });
  await db.pageCopyVariant.update({ where: { id: variant.id }, data: { isApplied: true } });
  await writeAuditLog({ action: "Website Page Status Changed", summary: `Copy variant applied to section ${variant.sectionId}`, actorUserId: input.actorUserId, entityType: "WebsitePage", entityId: page.id });

  return { ok: true, variantId: variant.id, text };
}
