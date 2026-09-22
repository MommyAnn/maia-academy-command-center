// Real AI-assisted Master Brain draft generation (spec section 14). Never
// called directly by a route without the APPROVED_FOR_GENERATION gate —
// see routes.ts. A draft is never auto-published; PUBLISHED only happens
// through a separate, explicit human action (spec section 14, 19-20).

import type { Prisma } from "@prisma/client";
import { db } from "../../db.js";
import { getProvider, resolveModelConfig } from "../../ai/registry.js";
import { MASTER_BRAIN_SECTION_DEFS, REQUIRED_MASTER_BRAIN_SECTIONS, validateGeneratedOutput, type MasterBrainDocumentSection } from "../ai/validation.js";
import { writeAuditLog } from "../../audit/log.js";

const MODEL_CONFIG_KEY = "master-brain-generation";

interface StructuredDraft {
  sections: { key: string; title: string; content: string; bullets: string[] }[];
}

export type GenerationOutcome = { ok: true; documentId: string } | { ok: false; reason: string };

export async function generateMasterBrainDraft(submissionId: string, actorUserId: string): Promise<GenerationOutcome> {
  const submission = await db.masterBrainSubmission.findUnique({ where: { id: submissionId }, include: { business: true } });
  if (!submission) return { ok: false, reason: "Submission not found." };
  if (submission.status !== "APPROVED_FOR_GENERATION") {
    return { ok: false, reason: `Cannot generate: submission status is ${submission.status}, expected APPROVED_FOR_GENERATION.` };
  }

  await db.masterBrainSubmission.update({ where: { id: submissionId }, data: { status: "GENERATING" } });

  const resolved = await resolveModelConfig(MODEL_CONFIG_KEY);
  if (!resolved.ok) {
    await db.masterBrainSubmission.update({ where: { id: submissionId }, data: { status: "APPROVED_FOR_GENERATION" } });
    return { ok: false, reason: resolved.reason };
  }

  const schema = {
    type: "object",
    required: ["sections"],
    properties: {
      sections: {
        type: "array",
        items: {
          type: "object",
          required: ["key", "title", "content", "bullets"],
          properties: {
            key: { type: "string" },
            title: { type: "string" },
            content: { type: "string" },
            bullets: { type: "array", items: { type: "string" } },
          },
        },
      },
    },
  };

  const systemInstruction = [
    "You are the M.A.I.A. Academy Brand Master Brain generator.",
    "Base every statement strictly on the provided questionnaire answers — never invent business history, founder credentials, sales numbers, awards, certifications, medical claims, customer results, testimonials, prices, guarantees, locations, or supplier relationships.",
    "Where information is missing from the answers, use neutral general wording or write \"Not yet provided\" rather than inventing a fact.",
    `Produce exactly these ${REQUIRED_MASTER_BRAIN_SECTIONS.length} sections, in this order, each with its exact key: ${MASTER_BRAIN_SECTION_DEFS.map((s) => `${s.key} (${s.title})`).join(", ")}.`,
  ].join(" ");

  const userMessage = `BUSINESS NAME: ${submission.business.name}\n\nQUESTIONNAIRE ANSWERS (JSON):\n${JSON.stringify(submission.answersJson)}`;

  const provider = getProvider(resolved.config.provider);
  const result = await provider.generateStructured<StructuredDraft>({
    model: resolved.config.model,
    systemInstruction,
    userMessage,
    maxOutputTokens: resolved.config.maxOutputTokens,
    temperature: resolved.config.temperature,
    schema,
    schemaName: "MasterBrainDraft",
  });

  if (!result.ok) {
    await db.masterBrainSubmission.update({ where: { id: submissionId }, data: { status: "APPROVED_FOR_GENERATION" } });
    return { ok: false, reason: result.message };
  }

  const sections: MasterBrainDocumentSection[] = result.data.data.sections.map((s) => ({
    key: s.key,
    title: s.title,
    content: s.content,
    bullets: s.bullets,
    approved: false,
    lastEditedBy: null,
    lastEditedAt: null,
  }));

  const sourceText = JSON.stringify(submission.answersJson);
  const outputText = sections.map((s) => `${s.content} ${s.bullets.join(" ")}`).join("\n");
  const validation = validateGeneratedOutput(outputText, sourceText, sections);

  const latest = await db.masterBrainDocument.findFirst({ where: { submissionId }, orderBy: { documentVersion: "desc" } });
  const nextVersion = (latest?.documentVersion ?? 0) + 1;

  const document = await db.masterBrainDocument.create({
    data: {
      submissionId,
      businessId: submission.businessId,
      documentVersion: nextVersion,
      generatedFromSubmissionVersion: submission.submissionVersion,
      sectionsJson: sections as unknown as Prisma.InputJsonValue,
      generationMethod: "AI_ASSISTED",
      aiProvider: resolved.config.provider,
      aiModel: resolved.config.model,
      validationJson: validation as unknown as Prisma.InputJsonValue,
      generatedById: actorUserId,
    },
  });

  await db.masterBrainSubmission.update({ where: { id: submissionId }, data: { status: "DRAFT_READY" } });
  await writeAuditLog({
    action: "Master Brain Generated",
    summary: `Master Brain draft v${nextVersion} generated for business ${submission.businessId}${validation.isClean ? "" : " (validation flags present)"}`,
    actorUserId,
    entityType: "MasterBrainDocument",
    entityId: document.id,
  });

  return { ok: true, documentId: document.id };
}
