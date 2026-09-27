// M.A.I.A. Video Director — real Veo generation routes. Additive only: does
// not touch the existing text-based "video-director" AI Tool Runner path
// (server/src/modules/ai-tools/*) at all. A future UI phase connects the
// Generate Video button to these routes; this phase is the real backend
// they will call.

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../../db.js";
import { requireAuth, requirePermission, requireStudentSelfOrPermission, assertBusinessOwnedByStudent } from "../../rbac/middleware.js";
import { signDownloadToken } from "../../storage/signedUrl.js";
import { createAndSubmitVideoJob, pollVideoJob, VEO_ASPECT_RATIOS, VEO_DURATIONS_SECONDS } from "./jobs.js";
import { isVeoConfigured } from "../../ai/veo.js";
import { env } from "../../env.js";

function ownedByRequester(request: { authContext?: { kind: string; studentId?: string } }, row: { studentId: string }): boolean {
  const ctx = request.authContext;
  if (!ctx) return false;
  if (ctx.kind === "staff") return true;
  return ctx.kind === "student" && ctx.studentId === row.studentId;
}

export async function videoGenerationRoutes(app: FastifyInstance, opts: { createJobRateLimitPerMinute?: number } = {}) {
  const createJobRateLimitPerMinute = opts.createJobRateLimitPerMinute ?? 10;
  // Honest connection status — never fabricates CONNECTED (mirrors the
  // Phase 14 Ads Command Center pattern). No credential value is ever
  // included in the response.
  app.get("/api/video-generation/status", { preHandler: [requireAuth] }, async (_request, reply) => {
    return reply.send({
      provider: "GOOGLE",
      model: env.GOOGLE_VEO_MODEL,
      configured: isVeoConfigured(),
      supportedAspectRatios: VEO_ASPECT_RATIOS,
      supportedDurations: VEO_DURATIONS_SECONDS,
    });
  });

  const createJobSchema = z.object({
    businessId: z.string().min(1),
    campaignId: z.string().optional(),
    prompt: z.string().min(1).max(2000),
    negativePrompt: z.string().max(1000).optional(),
    aspectRatio: z.enum(VEO_ASPECT_RATIOS),
    durationSeconds: z.number().refine((v): v is (typeof VEO_DURATIONS_SECONDS)[number] => (VEO_DURATIONS_SECONDS as readonly number[]).includes(v), `durationSeconds must be one of ${VEO_DURATIONS_SECONDS.join(", ")}`),
    referenceImageDocumentId: z.string().optional(),
  });

  app.post("/api/students/:studentId/video-jobs", { preHandler: [requireAuth, requireStudentSelfOrPermission("Creative Studio", "CREATE")], config: { rateLimit: { max: createJobRateLimitPerMinute, timeWindow: "1 minute" } } }, async (request, reply) => {
    const { studentId } = request.params as { studentId: string };
    const parsed = createJobSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid request.", details: parsed.error.flatten() });
    if (!(await assertBusinessOwnedByStudent(parsed.data.businessId, studentId))) return reply.code(403).send({ error: "Forbidden: this business does not belong to you." });

    const outcome = await createAndSubmitVideoJob({
      studentId,
      businessId: parsed.data.businessId,
      campaignId: parsed.data.campaignId,
      prompt: parsed.data.prompt,
      negativePrompt: parsed.data.negativePrompt,
      aspectRatio: parsed.data.aspectRatio,
      durationSeconds: parsed.data.durationSeconds as (typeof VEO_DURATIONS_SECONDS)[number],
      referenceImageDocumentId: parsed.data.referenceImageDocumentId,
      requestedById: request.authContext!.userId,
    });
    if (!outcome.ok) return reply.code(outcome.httpStatus).send({ error: outcome.reason });
    const job = await db.videoGenerationJob.findUniqueOrThrow({ where: { id: outcome.jobId } });
    return reply.code(201).send({ job });
  });

  app.get("/api/video-jobs/:id", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const job = await db.videoGenerationJob.findUnique({ where: { id } });
    if (!job) return reply.code(404).send({ error: "Video generation job not found." });
    if (!ownedByRequester(request, job)) return reply.code(403).send({ error: "Forbidden." });
    return reply.send({ job });
  });

  // Real status poll — the frontend calls this repeatedly while a job is
  // SUBMITTED/RUNNING. Only ever advances to COMPLETED after a real video
  // was downloaded and stored (see jobs.ts).
  app.post("/api/video-jobs/:id/poll", { preHandler: [requireAuth], config: { rateLimit: { max: 60, timeWindow: "1 minute" } } }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const job = await db.videoGenerationJob.findUnique({ where: { id } });
    if (!job) return reply.code(404).send({ error: "Video generation job not found." });
    if (!ownedByRequester(request, job)) return reply.code(403).send({ error: "Forbidden." });
    const outcome = await pollVideoJob(id);
    if (!outcome.ok) return reply.code(outcome.httpStatus).send({ error: outcome.reason });
    return reply.send(outcome);
  });

  app.get("/api/businesses/:businessId/video-jobs", { preHandler: [requireAuth] }, async (request, reply) => {
    const { businessId } = request.params as { businessId: string };
    const ctx = request.authContext!;
    const authorized = ctx.kind === "staff" || (ctx.kind === "student" && (await assertBusinessOwnedByStudent(businessId, ctx.studentId!)));
    if (!authorized) return reply.code(403).send({ error: "Forbidden: this business does not belong to you." });
    const jobs = await db.videoGenerationJob.findMany({ where: { businessId }, orderBy: { createdAt: "desc" }, take: 100 });
    return reply.send({ jobs });
  });

  // Reuses the EXISTING secure signed-download pipeline (server/src/modules/documents/routes.ts) — no new preview mechanism needed. Returns a short-lived signed URL for the job's real stored video.
  app.get("/api/video-jobs/:id/preview-url", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const job = await db.videoGenerationJob.findUnique({ where: { id } });
    if (!job) return reply.code(404).send({ error: "Video generation job not found." });
    if (!ownedByRequester(request, job)) return reply.code(403).send({ error: "Forbidden." });
    if (job.status !== "COMPLETED" || !job.resultDocumentId) {
      return reply.code(422).send({ error: `This job is not COMPLETED yet (current status: ${job.status}). There is no real video to preview.` });
    }
    const token = signDownloadToken(job.resultDocumentId);
    return reply.send({ url: `/api/documents/download?token=${token}`, expiresInSeconds: 300 });
  });

  // --- Admin oversight -----------------------------------------------------

  app.get("/api/video-generation/jobs", { preHandler: [requireAuth, requirePermission("Creative Studio", "VIEW")] }, async (request, reply) => {
    const { studentId, businessId, status } = request.query as { studentId?: string; businessId?: string; status?: string };
    const jobs = await db.videoGenerationJob.findMany({ where: { studentId: studentId || undefined, businessId: businessId || undefined, status: status || undefined }, orderBy: { createdAt: "desc" }, take: 200 });
    return reply.send({ jobs });
  });
}
