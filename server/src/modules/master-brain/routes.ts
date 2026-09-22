import type { FastifyInstance } from "fastify";
import { MasterBrainStatus, type Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "../../db.js";
import { requireAuth, requirePermission, requireStudentSelfOrPermission, assertBusinessOwnedByStudent } from "../../rbac/middleware.js";
import { writeAuditLog } from "../../audit/log.js";
import { generateMasterBrainDraft } from "./generation.js";
import { MASTER_BRAIN_SECTION_DEFS, type MasterBrainDocumentSection } from "../ai/validation.js";

const businessSchema = z.object({ name: z.string().min(1) });

const questionnaireSaveSchema = z.object({
  answers: z.record(z.string(), z.unknown()),
  currentStep: z.number().int().min(1).max(12).optional(),
  progressPercent: z.number().int().min(0).max(100).optional(),
});

const revisionRequestSchema = z.object({
  requests: z
    .array(z.object({ section: z.string().min(1), question: z.string().optional(), reason: z.string().min(1) }))
    .min(1),
});

const documentEditSchema = z.object({
  sections: z.array(
    z.object({
      key: z.string(),
      title: z.string(),
      content: z.string(),
      bullets: z.array(z.string()),
      approved: z.boolean().optional(),
    }),
  ),
});

/** Every :businessId route needs this — a Business must belong to the requesting Student, or to a permissioned staff member. */
async function assertBusinessAccessible(request: { authContext?: { kind: string; studentId?: string } }, businessId: string): Promise<boolean> {
  const ctx = request.authContext;
  if (!ctx) return false;
  if (ctx.kind === "staff") return true; // staff access is governed by requirePermission at the route level
  if (ctx.kind === "student" && ctx.studentId) return assertBusinessOwnedByStudent(businessId, ctx.studentId);
  return false;
}

export async function masterBrainRoutes(app: FastifyInstance) {
  // --- Businesses (spec sections 11, 33) ------------------------------------

  app.get("/api/students/:studentId/businesses", { preHandler: [requireAuth, requireStudentSelfOrPermission("Master Brain", "VIEW")] }, async (request, reply) => {
    const { studentId } = request.params as { studentId: string };
    const businesses = await db.business.findMany({ where: { studentId }, orderBy: { createdAt: "asc" } });
    return reply.send({ businesses });
  });

  app.post("/api/students/:studentId/businesses", { preHandler: [requireAuth, requireStudentSelfOrPermission("Master Brain", "CREATE")] }, async (request, reply) => {
    const { studentId } = request.params as { studentId: string };
    const parsed = businessSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid business.", details: parsed.error.flatten() });
    const business = await db.business.create({ data: { studentId, name: parsed.data.name } });
    return reply.code(201).send({ business });
  });

  // --- Questionnaire (spec section 12) ---------------------------------------

  app.get("/api/businesses/:businessId/master-brain", { preHandler: [requireAuth] }, async (request, reply) => {
    const { businessId } = request.params as { businessId: string };
    if (!(await assertBusinessAccessible(request, businessId))) return reply.code(403).send({ error: "Forbidden: this business does not belong to you." });

    const business = await db.business.findUnique({ where: { id: businessId } });
    if (!business) return reply.code(404).send({ error: "Business not found." });

    const submission = await db.masterBrainSubmission.findUnique({
      where: { businessId },
      include: { documents: { orderBy: { documentVersion: "desc" } }, revisionRequests: { orderBy: { createdAt: "desc" } } },
    });
    return reply.send({ submission });
  });

  // Auto-creates a NOT_STARTED submission on first save — the questionnaire
  // never requires a separate "start" step the Student has to know about.
  app.patch("/api/businesses/:businessId/master-brain", { preHandler: [requireAuth] }, async (request, reply) => {
    const { businessId } = request.params as { businessId: string };
    if (!(await assertBusinessAccessible(request, businessId))) return reply.code(403).send({ error: "Forbidden: this business does not belong to you." });
    const parsed = questionnaireSaveSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid questionnaire save.", details: parsed.error.flatten() });

    const business = await db.business.findUnique({ where: { id: businessId } });
    if (!business) return reply.code(404).send({ error: "Business not found." });

    const existing = await db.masterBrainSubmission.findUnique({ where: { businessId } });
    if (existing && existing.status !== "NOT_STARTED" && existing.status !== "IN_PROGRESS" && existing.status !== "NEEDS_REVISION") {
      return reply.code(409).send({ error: `Cannot edit the questionnaire while status is ${existing.status}.` });
    }

    const now = new Date();
    const submission = await db.masterBrainSubmission.upsert({
      where: { businessId },
      update: {
        answersJson: parsed.data.answers as Prisma.InputJsonValue,
        currentStep: parsed.data.currentStep,
        progressPercent: parsed.data.progressPercent,
        status: existing?.status === "NOT_STARTED" ? "IN_PROGRESS" : undefined,
        startedAt: existing?.startedAt ?? now,
        lastSavedAt: now,
      },
      create: {
        studentId: business.studentId,
        businessId,
        status: "IN_PROGRESS",
        answersJson: parsed.data.answers as Prisma.InputJsonValue,
        currentStep: parsed.data.currentStep ?? 1,
        progressPercent: parsed.data.progressPercent ?? 0,
        startedAt: now,
        lastSavedAt: now,
      },
    });
    return reply.send({ submission });
  });

  app.post("/api/businesses/:businessId/master-brain/submit", { preHandler: [requireAuth] }, async (request, reply) => {
    const { businessId } = request.params as { businessId: string };
    if (!(await assertBusinessAccessible(request, businessId))) return reply.code(403).send({ error: "Forbidden: this business does not belong to you." });

    const existing = await db.masterBrainSubmission.findUnique({ where: { businessId } });
    if (!existing) return reply.code(404).send({ error: "No questionnaire has been started for this business." });
    if (existing.status !== "IN_PROGRESS" && existing.status !== "NEEDS_REVISION") {
      return reply.code(409).send({ error: `Cannot submit from status ${existing.status}.` });
    }

    const submission = await db.masterBrainSubmission.update({
      where: { businessId },
      data: { status: "SUBMITTED", submittedAt: new Date(), submissionVersion: existing.status === "NEEDS_REVISION" ? existing.submissionVersion + 1 : existing.submissionVersion },
    });
    return reply.send({ submission });
  });

  // --- Admin review workflow (spec sections 13-14, 76) -----------------------

  app.get("/api/master-brain/submissions", { preHandler: [requireAuth, requirePermission("Master Brain", "VIEW")] }, async (request, reply) => {
    const { status } = request.query as { status?: string };
    const statusFilter = status && status in MasterBrainStatus ? (status as MasterBrainStatus) : undefined;
    const submissions = await db.masterBrainSubmission.findMany({
      where: { status: statusFilter },
      include: { business: true },
      orderBy: { updatedAt: "desc" },
    });
    return reply.send({ submissions });
  });

  app.get("/api/master-brain/submissions/:submissionId", { preHandler: [requireAuth, requirePermission("Master Brain", "VIEW")] }, async (request, reply) => {
    const { submissionId } = request.params as { submissionId: string };
    const submission = await db.masterBrainSubmission.findUnique({
      where: { id: submissionId },
      include: { business: true, documents: { orderBy: { documentVersion: "desc" } }, revisionRequests: { orderBy: { createdAt: "desc" } } },
    });
    if (!submission) return reply.code(404).send({ error: "Submission not found." });
    return reply.send({ submission });
  });

  app.post("/api/master-brain/submissions/:submissionId/start-review", { preHandler: [requireAuth, requirePermission("Master Brain", "EDIT")] }, async (request, reply) => {
    const { submissionId } = request.params as { submissionId: string };
    const existing = await db.masterBrainSubmission.findUnique({ where: { id: submissionId } });
    if (!existing) return reply.code(404).send({ error: "Submission not found." });
    if (existing.status !== "SUBMITTED") return reply.code(409).send({ error: `Cannot start review from status ${existing.status}.` });
    const submission = await db.masterBrainSubmission.update({ where: { id: submissionId }, data: { status: "UNDER_REVIEW", reviewedById: request.authContext!.userId } });
    return reply.send({ submission });
  });

  app.post("/api/master-brain/submissions/:submissionId/request-revision", { preHandler: [requireAuth, requirePermission("Master Brain", "EDIT")] }, async (request, reply) => {
    const { submissionId } = request.params as { submissionId: string };
    const parsed = revisionRequestSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid revision request.", details: parsed.error.flatten() });

    const existing = await db.masterBrainSubmission.findUnique({ where: { id: submissionId } });
    if (!existing) return reply.code(404).send({ error: "Submission not found." });
    if (existing.status !== "UNDER_REVIEW") return reply.code(409).send({ error: `Cannot request revision from status ${existing.status}.` });

    await db.$transaction([
      ...parsed.data.requests.map((r) =>
        db.masterBrainRevisionRequest.create({ data: { submissionId, section: r.section, question: r.question, reason: r.reason } }),
      ),
      db.masterBrainSubmission.update({ where: { id: submissionId }, data: { status: "NEEDS_REVISION" } }),
    ]);
    await writeAuditLog({ action: "Master Brain Revision Requested", summary: `Revision requested for submission ${submissionId}`, actorUserId: request.authContext!.userId, entityType: "MasterBrainSubmission", entityId: submissionId });

    const submission = await db.masterBrainSubmission.findUniqueOrThrow({ where: { id: submissionId }, include: { revisionRequests: true } });
    return reply.send({ submission });
  });

  app.post("/api/master-brain/submissions/:submissionId/approve", { preHandler: [requireAuth, requirePermission("Master Brain", "VERIFY")] }, async (request, reply) => {
    const { submissionId } = request.params as { submissionId: string };
    const existing = await db.masterBrainSubmission.findUnique({ where: { id: submissionId } });
    if (!existing) return reply.code(404).send({ error: "Submission not found." });
    if (existing.status !== "UNDER_REVIEW") return reply.code(409).send({ error: `Cannot approve from status ${existing.status}.` });
    const submission = await db.masterBrainSubmission.update({ where: { id: submissionId }, data: { status: "APPROVED_FOR_GENERATION", reviewedById: request.authContext!.userId, reviewedAt: new Date() } });
    return reply.send({ submission });
  });

  // Real AI-assisted generation (spec section 14) — never auto-published.
  app.post("/api/master-brain/submissions/:submissionId/generate", { preHandler: [requireAuth, requirePermission("Master Brain", "EDIT")] }, async (request, reply) => {
    const { submissionId } = request.params as { submissionId: string };
    const outcome = await generateMasterBrainDraft(submissionId, request.authContext!.userId);
    if (!outcome.ok) return reply.code(422).send({ error: outcome.reason });
    const document = await db.masterBrainDocument.findUniqueOrThrow({ where: { id: outcome.documentId } });
    return reply.code(201).send({ document });
  });

  // Admin manual edit of a draft (spec section 14's "Admin Review/Edit") —
  // never touches isCurrentPublished; only an explicit publish does that.
  app.patch("/api/master-brain/documents/:documentId", { preHandler: [requireAuth, requirePermission("Master Brain", "EDIT")] }, async (request, reply) => {
    const { documentId } = request.params as { documentId: string };
    const parsed = documentEditSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid document edit.", details: parsed.error.flatten() });

    const existing = await db.masterBrainDocument.findUnique({ where: { id: documentId } });
    if (!existing) return reply.code(404).send({ error: "Document not found." });
    if (existing.isCurrentPublished) return reply.code(409).send({ error: "This document is already published — create a new version instead of editing it in place." });

    const now = new Date().toISOString();
    const sections: MasterBrainDocumentSection[] = parsed.data.sections.map((s) => ({
      key: s.key,
      title: s.title,
      content: s.content,
      bullets: s.bullets,
      approved: s.approved ?? false,
      lastEditedBy: request.authContext!.userId,
      lastEditedAt: now,
    }));

    const document = await db.masterBrainDocument.update({ where: { id: documentId }, data: { sectionsJson: sections as unknown as Prisma.InputJsonValue } });
    return reply.send({ document });
  });

  // Publish (spec sections 19-20) — the ONLY path that ever sets
  // isCurrentPublished; every prior published version is flipped false but
  // never deleted (real version history, never a silent overwrite).
  app.post("/api/master-brain/documents/:documentId/publish", { preHandler: [requireAuth, requirePermission("Master Brain", "VERIFY")] }, async (request, reply) => {
    const { documentId } = request.params as { documentId: string };
    const document = await db.masterBrainDocument.findUnique({ where: { id: documentId } });
    if (!document) return reply.code(404).send({ error: "Document not found." });

    await db.$transaction([
      db.masterBrainDocument.updateMany({ where: { submissionId: document.submissionId, isCurrentPublished: true }, data: { isCurrentPublished: false } }),
      db.masterBrainDocument.update({ where: { id: documentId }, data: { isCurrentPublished: true, publishedAt: new Date(), publishedById: request.authContext!.userId } }),
      db.masterBrainSubmission.update({ where: { id: document.submissionId }, data: { status: "PUBLISHED" } }),
    ]);
    await writeAuditLog({ action: "Master Brain Published", summary: `Master Brain v${document.documentVersion} published for business ${document.businessId}`, actorUserId: request.authContext!.userId, entityType: "MasterBrainDocument", entityId: documentId });

    const published = await db.masterBrainDocument.findUniqueOrThrow({ where: { id: documentId } });
    return reply.send({ document: published });
  });

  app.get("/api/master-brain/section-defs", { preHandler: [requireAuth] }, async (_request, reply) => {
    return reply.send({ sectionDefs: MASTER_BRAIN_SECTION_DEFS });
  });
}
