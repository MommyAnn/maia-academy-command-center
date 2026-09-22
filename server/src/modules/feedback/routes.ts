import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../../db.js";
import { requireAuth, requirePermission, requireStudentSelf, requireStudentSelfOrPermission } from "../../rbac/middleware.js";
import { writeAuditLog } from "../../audit/log.js";
import { recordDomainEvent } from "../events.js";
import { generateFeedbackRequestDisplayId, generateFeedbackSubmissionDisplayId } from "../sequence.js";

const createRequestSchema = z.object({
  title: z.string().min(1),
  sourceType: z.string().min(1),
  sourceId: z.string().optional(),
  sourceLabel: z.string().optional(),
  batchId: z.string().optional(),
  audience: z.enum(["All Eligible Students", "Individual Student"]).default("All Eligible Students"),
  audienceStudentId: z.string().optional(),
  message: z.string().optional(),
  questions: z.array(z.object({ id: z.string(), text: z.string() })).default([]),
  allowWritten: z.boolean().default(true),
  allowVideo: z.boolean().default(true),
  incentiveId: z.string().optional(),
  closeDate: z.string().datetime().optional(),
});

const updateRequestSchema = z.object({
  status: z.enum(["Draft", "Open", "Closed"]).optional(),
  message: z.string().optional(),
  closeDate: z.string().datetime().optional(),
});

const submitFeedbackSchema = z.object({
  requestId: z.string().optional(),
  sourceType: z.string().min(1),
  sourceId: z.string().optional(),
  sourceLabel: z.string().optional(),
  batchId: z.string().optional(),
  rating: z.number().int().min(1).max(5).optional(),
  writtenText: z.string().optional(),
  videoDocumentId: z.string().optional(),
  answers: z.array(z.object({ questionId: z.string(), questionText: z.string(), answer: z.string() })).default([]),
});

const reviewSchema = z.object({
  status: z.enum(["Reviewed", "Kept Private", "Featured", "Archived"]).optional(),
  internalNotes: z.string().optional(),
  marketingTags: z.array(z.string()).optional(),
});

const consentSchema = z.object({
  status: z.enum(["Granted", "Withdrawn"]),
  permittedAssets: z.array(z.string()),
  consentVersion: z.string().default("v1.0"),
});

export async function feedbackRoutes(app: FastifyInstance) {
  // ---------------------------------------------------------------------
  // Admin: Feedback Requests
  // ---------------------------------------------------------------------
  app.get("/api/feedback/requests", { preHandler: [requireAuth, requirePermission("Feedback", "VIEW")] }, async (_request, reply) => {
    const requests = await db.feedbackRequest.findMany({ orderBy: { createdAt: "desc" } });
    return reply.send({ requests });
  });

  app.post("/api/feedback/requests", { preHandler: [requireAuth, requirePermission("Feedback", "CREATE")] }, async (request, reply) => {
    const parsed = createRequestSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid feedback request.", details: parsed.error.flatten() });

    const requestDisplayId = await generateFeedbackRequestDisplayId();
    const created = await db.feedbackRequest.create({
      data: {
        requestDisplayId,
        title: parsed.data.title,
        sourceType: parsed.data.sourceType,
        sourceId: parsed.data.sourceId ?? null,
        sourceLabel: parsed.data.sourceLabel ?? null,
        batchId: parsed.data.batchId ?? null,
        audience: parsed.data.audience,
        audienceStudentId: parsed.data.audienceStudentId ?? null,
        message: parsed.data.message ?? null,
        questionsJson: parsed.data.questions,
        allowWritten: parsed.data.allowWritten,
        allowVideo: parsed.data.allowVideo,
        incentiveId: parsed.data.incentiveId ?? null,
        closeDate: parsed.data.closeDate ? new Date(parsed.data.closeDate) : null,
        createdById: request.authContext!.userId,
      },
    });
    return reply.code(201).send({ request: created });
  });

  app.patch("/api/feedback/requests/:requestId", { preHandler: [requireAuth, requirePermission("Feedback", "EDIT")] }, async (request, reply) => {
    const { requestId } = request.params as { requestId: string };
    const parsed = updateRequestSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid update.", details: parsed.error.flatten() });

    const updated = await db.feedbackRequest
      .update({ where: { id: requestId }, data: { ...parsed.data, closeDate: parsed.data.closeDate ? new Date(parsed.data.closeDate) : undefined } })
      .catch(() => null);
    if (!updated) return reply.code(404).send({ error: "Feedback request not found." });
    return reply.send({ request: updated });
  });

  // ---------------------------------------------------------------------
  // Admin: All Feedback (written + video)
  // ---------------------------------------------------------------------
  app.get("/api/feedback/submissions", { preHandler: [requireAuth, requirePermission("Feedback", "VIEW")] }, async (request, reply) => {
    const { status, sourceType } = request.query as { status?: string; sourceType?: string };
    const submissions = await db.feedbackSubmission.findMany({
      where: { status: status || undefined, sourceType: sourceType || undefined },
      include: { student: { include: { person: true } }, marketingConsent: true },
      orderBy: { createdAt: "desc" },
    });
    return reply.send({ submissions });
  });

  app.patch("/api/feedback/submissions/:submissionId", { preHandler: [requireAuth, requirePermission("Feedback", "EDIT")] }, async (request, reply) => {
    const { submissionId } = request.params as { submissionId: string };
    const parsed = reviewSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid review.", details: parsed.error.flatten() });

    const existing = await db.feedbackSubmission.findUnique({ where: { id: submissionId } });
    if (!existing) return reply.code(404).send({ error: "Feedback submission not found." });

    const updated = await db.feedbackSubmission.update({
      where: { id: submissionId },
      data: {
        status: parsed.data.status ?? existing.status,
        internalNotes: parsed.data.internalNotes ?? existing.internalNotes,
        marketingTagsJson: parsed.data.marketingTags ?? existing.marketingTagsJson ?? undefined,
        reviewedById: request.authContext!.userId,
        reviewedAt: new Date(),
      },
    });
    return reply.send({ submission: updated });
  });

  // ---------------------------------------------------------------------
  // Marketing Testimonial Library (spec section 43) — only content with
  // BOTH valid marketing consent AND admin approval is ever listed here.
  // ---------------------------------------------------------------------
  app.get("/api/marketing/testimonials", { preHandler: [requireAuth, requirePermission("Feedback - Marketing", "VIEW")] }, async (_request, reply) => {
    const testimonials = await db.feedbackSubmission.findMany({
      where: {
        status: { in: ["Approved for Marketing", "Featured"] },
        marketingConsent: { status: "Granted" },
      },
      include: { student: { include: { person: true } }, marketingConsent: true },
      orderBy: { createdAt: "desc" },
    });
    return reply.send({ testimonials });
  });

  app.post(
    "/api/feedback/submissions/:submissionId/approve-testimonial",
    { preHandler: [requireAuth, requirePermission("Feedback - Marketing", "EDIT")] },
    async (request, reply) => {
      const { submissionId } = request.params as { submissionId: string };
      const submission = await db.feedbackSubmission.findUnique({ where: { id: submissionId }, include: { marketingConsent: true } });
      if (!submission) return reply.code(404).send({ error: "Feedback submission not found." });
      if (submission.marketingConsent?.status !== "Granted") {
        return reply.code(409).send({ error: "This submission has no active marketing consent — it cannot be approved for the testimonial library." });
      }

      const updated = await db.feedbackSubmission.update({
        where: { id: submissionId },
        data: { status: "Approved for Marketing", reviewedById: request.authContext!.userId, reviewedAt: new Date() },
      });

      await writeAuditLog({ action: "Testimonial Approved", summary: `Feedback ${submission.feedbackDisplayId} approved for the marketing library`, actorUserId: request.authContext!.userId, entityType: "FeedbackSubmission", entityId: submissionId });
      return reply.send({ submission: updated });
    },
  );

  // ---------------------------------------------------------------------
  // Student self-service
  // ---------------------------------------------------------------------
  app.get(
    "/api/students/:studentId/feedback",
    { preHandler: [requireAuth, requireStudentSelfOrPermission("Feedback", "VIEW")] },
    async (request, reply) => {
      const { studentId } = request.params as { studentId: string };
      const submissions = await db.feedbackSubmission.findMany({ where: { studentId }, include: { marketingConsent: true }, orderBy: { createdAt: "desc" } });
      return reply.send({ submissions });
    },
  );

  app.get(
    "/api/students/:studentId/feedback-requests",
    { preHandler: [requireAuth, requireStudentSelf("studentId")] },
    async (request, reply) => {
      const { studentId } = request.params as { studentId: string };
      const alreadySubmitted = await db.feedbackSubmission.findMany({ where: { studentId, requestId: { not: null } }, select: { requestId: true } });
      const submittedIds = new Set(alreadySubmitted.map((s) => s.requestId));
      const open = await db.feedbackRequest.findMany({
        where: { status: "Open", OR: [{ audience: "All Eligible Students" }, { audienceStudentId: studentId }] },
        orderBy: { openDate: "desc" },
      });
      return reply.send({ requests: open.filter((r) => !submittedIds.has(r.id)) });
    },
  );

  // Genuine feedback is REWARDED for being submitted, never for sentiment
  // (spec section 46) — nothing below reads `rating` or inspects
  // `writtenText` before unlocking an incentive. A duplicate submission
  // against the same request is rejected (409), matching the same
  // "same reservation cannot be linked twice" duplicate-prevention pattern
  // used throughout Phase 2.
  app.post(
    "/api/students/:studentId/feedback",
    { preHandler: [requireAuth, requireStudentSelf("studentId")] },
    async (request, reply) => {
      const { studentId } = request.params as { studentId: string };
      const parsed = submitFeedbackSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: "Invalid feedback submission.", details: parsed.error.flatten() });

      if (parsed.data.requestId) {
        const duplicate = await db.feedbackSubmission.findFirst({ where: { studentId, requestId: parsed.data.requestId } });
        if (duplicate) return reply.code(409).send({ error: "You have already submitted feedback for this request." });
      }

      if (parsed.data.videoDocumentId) {
        const doc = await db.document.findUnique({ where: { id: parsed.data.videoDocumentId } });
        if (!doc || doc.ownerStudentId !== studentId) return reply.code(403).send({ error: "That video does not belong to you." });
      }

      const feedbackDisplayId = await generateFeedbackSubmissionDisplayId();
      const submission = await db.feedbackSubmission.create({
        data: {
          feedbackDisplayId,
          requestId: parsed.data.requestId ?? null,
          studentId,
          sourceType: parsed.data.sourceType,
          sourceId: parsed.data.sourceId ?? null,
          sourceLabel: parsed.data.sourceLabel ?? null,
          batchId: parsed.data.batchId ?? null,
          rating: parsed.data.rating ?? null,
          writtenText: parsed.data.writtenText ?? null,
          videoDocumentId: parsed.data.videoDocumentId ?? null,
          answersJson: parsed.data.answers,
        },
      });

      await writeAuditLog({ action: "Feedback Submitted", summary: `Feedback ${feedbackDisplayId} submitted`, actorStudentId: studentId, entityType: "FeedbackSubmission", entityId: submission.id });
      if (parsed.data.videoDocumentId) {
        await writeAuditLog({ action: "Video Feedback Uploaded", summary: `Video feedback attached to ${feedbackDisplayId}`, actorStudentId: studentId, entityType: "FeedbackSubmission", entityId: submission.id });
      }

      // Incentive eligibility: submitting satisfies the requirement outright
      // — no sentiment/rating check anywhere in this branch (spec section 46).
      let incentiveGranted = false;
      const feedbackRequest = parsed.data.requestId ? await db.feedbackRequest.findUnique({ where: { id: parsed.data.requestId } }) : null;
      const incentive = feedbackRequest?.incentiveId ? await db.incentive.findUnique({ where: { id: feedbackRequest.incentiveId } }) : null;
      if (incentive && incentive.status === "Active") {
        const redemption = await db.incentiveRedemption.create({
          data: { incentiveId: incentive.id, studentId, feedbackSubmissionId: submission.id, status: "Unlocked" },
        });
        incentiveGranted = true;
        await writeAuditLog({ action: "Incentive Granted", summary: `Incentive "${incentive.name}" granted for feedback ${feedbackDisplayId}`, actorStudentId: studentId, entityType: "IncentiveRedemption", entityId: redemption.id });

        // Bonus Course incentives reuse the SAME course-access mechanism
        // (spec section 48) — never a separate, parallel grant path.
        if (incentive.deliveryType === "Bonus Course" && incentive.bonusCourseId) {
          await db.courseAccessGrant.upsert({
            where: { studentId_courseId: { studentId, courseId: incentive.bonusCourseId } },
            update: { status: "Active", source: "Feedback Incentive", sourceReference: redemption.id, revokedAt: null, revokedById: null },
            create: { studentId, courseId: incentive.bonusCourseId, source: "Feedback Incentive", sourceReference: redemption.id, grantedById: null },
          });
          await recordDomainEvent("COURSE_ACCESS_GRANTED", { studentId, courseId: incentive.bonusCourseId, source: "Feedback Incentive" });
          await writeAuditLog({ action: "Course Access Granted", summary: `Bonus course access granted via feedback incentive "${incentive.name}"`, actorStudentId: studentId, entityType: "CourseAccessGrant", entityId: incentive.bonusCourseId });
        }
      }

      return reply.code(201).send({ submission, incentiveGranted });
    },
  );

  // ---------------------------------------------------------------------
  // Marketing Consent — ALWAYS a separate call from feedback submission
  // itself (spec sections 40-42): a student can submit genuine feedback
  // and never call this route at all, and nothing above requires it.
  // ---------------------------------------------------------------------
  app.get(
    "/api/students/:studentId/feedback/:submissionId/consent",
    { preHandler: [requireAuth, requireStudentSelfOrPermission("Feedback", "VIEW")] },
    async (request, reply) => {
      const { submissionId } = request.params as { submissionId: string };
      const consent = await db.marketingConsent.findUnique({ where: { feedbackSubmissionId: submissionId }, include: { events: { orderBy: { occurredAt: "asc" } } } });
      return reply.send({ consent });
    },
  );

  app.post(
    "/api/students/:studentId/feedback/:submissionId/consent",
    { preHandler: [requireAuth, requireStudentSelf("studentId")] },
    async (request, reply) => {
      const { studentId, submissionId } = request.params as { studentId: string; submissionId: string };
      const parsed = consentSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: "Invalid consent.", details: parsed.error.flatten() });

      const submission = await db.feedbackSubmission.findUnique({ where: { id: submissionId } });
      if (!submission || submission.studentId !== studentId) return reply.code(404).send({ error: "Feedback submission not found." });

      const existing = await db.marketingConsent.findUnique({ where: { feedbackSubmissionId: submissionId } });
      const isFirstEvent = !existing;

      const consent = await db.marketingConsent.upsert({
        where: { feedbackSubmissionId: submissionId },
        update: { status: parsed.data.status, consentVersion: parsed.data.consentVersion, permittedAssetsJson: parsed.data.permittedAssets },
        create: { feedbackSubmissionId: submissionId, status: parsed.data.status, consentVersion: parsed.data.consentVersion, permittedAssetsJson: parsed.data.permittedAssets },
      });

      // Append-only — this row is NEVER updated or deleted, so a later
      // withdrawal can never erase the historical fact that consent was
      // once granted (spec section 41).
      await db.consentEvent.create({
        data: { consentId: consent.id, status: parsed.data.status, permittedAssetsJson: parsed.data.permittedAssets, source: "Student Portal" },
      });

      const action =
        parsed.data.status === "Withdrawn" ? "Marketing Consent Revoked" : isFirstEvent ? "Marketing Consent Granted" : "Marketing Consent Updated";
      await writeAuditLog({ action, summary: `Marketing consent ${parsed.data.status.toLowerCase()} for feedback ${submission.feedbackDisplayId}`, actorStudentId: studentId, entityType: "MarketingConsent", entityId: consent.id });

      return reply.send({ consent });
    },
  );
}
