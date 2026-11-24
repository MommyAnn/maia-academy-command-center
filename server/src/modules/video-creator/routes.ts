// Customer-facing AI Video Creator API. Every route resolves the caller from
// the server-side session (never from a client-supplied id) and only ever
// reads or writes rows owned by that caller's own Student record.

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { VideoGenerationJob } from "@prisma/client";
import { db } from "../../db.js";
import { requireAuth } from "../../rbac/middleware.js";
import { buildStorageKey } from "../../storage/localDriver.js";
import { storage } from "../../storage/driver.js";
import { writeAuditLog } from "../../audit/log.js";
import { hashPassword, validatePasswordStrength, verifyPassword } from "../../auth/password.js";
import { isVeoConfigured } from "../../ai/veo.js";
import { getOrCreateAccount } from "./credits.js";
import { ACTIVE_STATUSES, createVideoJob } from "./jobs.js";
import { normalizeProductPhoto, sniffImageType } from "./media.js";
import { signMediaToken, verifyMediaToken } from "./media-token.js";
import {
  allowedDurationsOf,
  allowedResolutionsOf,
  ASPECT_RATIOS,
  creditCostFor,
  getVideoCreatorSettings,
  VIDEO_LANGUAGES,
  VIDEO_STYLES,
} from "./settings.js";
import { DEFAULT_CTA } from "./prompt.js";

const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

async function requireCustomer(request: FastifyRequest, reply: FastifyReply) {
  const ctx = request.authContext;
  if (!ctx || ctx.kind !== "student" || !ctx.studentId) {
    reply.code(403).send({ error: "This area is for AI Video Creator customers. Staff should use the admin dashboard.", code: "NOT_A_CUSTOMER" });
    return reply;
  }
}

async function requireActiveAccess(request: FastifyRequest, reply: FastifyReply) {
  const account = await getOrCreateAccount(request.authContext!.studentId!);
  if (account.accessStatus !== "ACTIVE") {
    reply.code(403).send({ error: "Your AI Video Creator access is not active. Please contact M.A.I.A. support.", code: "ACCESS_INACTIVE" });
    return reply;
  }
}

const API_MEDIA_PATH = "/api/video-creator/media";

export function mediaUrl(documentId: string | null, jobId: string, disposition: "inline" | "attachment"): string | null {
  return documentId ? `${API_MEDIA_PATH}?token=${signMediaToken(documentId, jobId, disposition)}` : null;
}

/** Customer-safe view of a job. The full AI prompt and raw provider errors are admin-only. */
export function serializeJobForCustomer(job: VideoGenerationJob) {
  const input = (job.inputJson ?? {}) as { product?: Record<string, string>; overlay?: boolean; voiceover?: boolean };
  const playable = job.finalDocumentId ?? job.resultDocumentId;
  return {
    id: job.id,
    displayId: job.jobDisplayId,
    status: job.status,
    statusMessage: job.statusMessage,
    warningMessage: job.warningMessage,
    style: job.style,
    language: job.language,
    aspectRatio: job.aspectRatio,
    durationSeconds: job.durationSeconds,
    resolution: job.resolution,
    product: input.product ?? {},
    overlay: input.overlay ?? false,
    voiceover: input.voiceover ?? false,
    creditsCharged: job.creditsCharged,
    creditStatus: job.creditStatus,
    createdAt: job.createdAt,
    submittedAt: job.submittedAt,
    completedAt: job.completedAt,
    failureCategory: job.status === "FAILED" ? job.errorCategory : null,
    media:
      job.status === "COMPLETED"
        ? {
            videoUrl: mediaUrl(playable, job.id, "inline"),
            downloadUrl: mediaUrl(playable, job.id, "attachment"),
            originalDownloadUrl: job.finalDocumentId ? mediaUrl(job.resultDocumentId, job.id, "attachment") : null,
            thumbnailUrl: mediaUrl(job.thumbnailDocumentId, job.id, "inline"),
            hasTextOverlay: !!job.finalDocumentId,
          }
        : null,
    photoUrl: mediaUrl(job.referenceImageDocumentId, job.id, "inline"),
  };
}

const productSchema = z.object({
  productName: z.string().trim().max(60).optional(),
  description: z.string().trim().max(600).optional(),
  benefits: z.string().trim().max(400).optional(),
  price: z.string().trim().max(24).optional(),
  targetAudience: z.string().trim().max(160).optional(),
  callToAction: z.string().trim().max(60).optional(),
});

const createSchema = z.object({
  productPhotoId: z.string().min(1),
  style: z.enum(VIDEO_STYLES),
  language: z.enum(VIDEO_LANGUAGES).default("ENGLISH"),
  aspectRatio: z.enum(ASPECT_RATIOS).default("9:16"),
  durationSeconds: z.number().int(),
  resolution: z.string().default("720p"),
  product: productSchema.default({}),
  overlay: z.boolean().default(true),
  voiceover: z.boolean().default(true),
  customInstructions: z.string().trim().max(400).optional(),
  idempotencyKey: z.string().min(8).max(100),
});

export async function videoCreatorRoutes(app: FastifyInstance, opts: { createRateLimitPerMinute?: number } = {}) {
  const customer = [requireAuth, requireCustomer];
  const activeCustomer = [requireAuth, requireCustomer, requireActiveAccess];

  // Who am I + what can I do. Works for suspended accounts too, so the UI can explain why.
  app.get("/api/video-creator/me", { preHandler: customer }, async (request, reply) => {
    const ctx = request.authContext!;
    const [account, settings, user, counts] = await Promise.all([
      getOrCreateAccount(ctx.studentId!),
      getVideoCreatorSettings(),
      db.user.findUniqueOrThrow({ where: { id: ctx.userId }, select: { email: true } }),
      db.videoGenerationJob.groupBy({ by: ["status"], where: { studentId: ctx.studentId!, source: "VIDEO_CREATOR", deletedAt: null }, _count: true }),
    ]);
    const byStatus = Object.fromEntries(counts.map((c) => [c.status, c._count]));
    const resolutions = allowedResolutionsOf(settings);
    return reply.send({
      user: { fullName: ctx.fullName, email: user.email },
      account: { accessStatus: account.accessStatus, creditBalance: account.creditBalance },
      stats: { completed: byStatus.COMPLETED ?? 0, inProgress: ACTIVE_STATUSES.reduce((n, s) => n + (byStatus[s] ?? 0), 0), failed: byStatus.FAILED ?? 0 },
      service: { providerConnected: isVeoConfigured(), generationEnabled: settings.generationEnabled },
      options: {
        styles: VIDEO_STYLES,
        languages: VIDEO_LANGUAGES,
        aspectRatios: ASPECT_RATIOS,
        durations: allowedDurationsOf(settings),
        resolutions,
        creditCost: Object.fromEntries(resolutions.map((r) => [r, creditCostFor(settings, r)])),
        defaultCta: DEFAULT_CTA,
      },
    });
  });

  app.get("/api/video-creator/credits/transactions", { preHandler: customer }, async (request, reply) => {
    const account = await getOrCreateAccount(request.authContext!.studentId!);
    const rows = await db.videoCreditTransaction.findMany({ where: { accountId: account.id }, orderBy: { createdAt: "desc" }, take: 200 });
    const jobIds = rows.map((r) => r.jobId).filter((x): x is string => !!x);
    const jobs = await db.videoGenerationJob.findMany({ where: { id: { in: jobIds } }, select: { id: true, jobDisplayId: true } });
    const label = new Map(jobs.map((j) => [j.id, j.jobDisplayId]));
    return reply.send({
      balance: account.creditBalance,
      transactions: rows.map((r) => ({ id: r.id, type: r.type, amount: r.amount, balanceAfter: r.balanceAfter, reason: r.reason, jobId: r.jobId, jobDisplayId: r.jobId ? label.get(r.jobId) ?? null : null, createdAt: r.createdAt })),
    });
  });

  // Product photo upload. JSON+base64 keeps the client simple; the server
  // checks the real bytes (magic numbers), decodes the image, enforces size
  // limits, and re-encodes it (stripping EXIF/GPS) before it's stored.
  app.post(
    "/api/video-creator/photos",
    { preHandler: activeCustomer, bodyLimit: 15 * 1024 * 1024, config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const parsed = z.object({ filename: z.string().min(1).max(200), contentBase64: z.string().min(1) }).safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: "Invalid upload." });
      const bytes = Buffer.from(parsed.data.contentBase64, "base64");
      if (bytes.byteLength === 0) return reply.code(422).send({ error: "The file is empty." });
      if (bytes.byteLength > MAX_PHOTO_BYTES) return reply.code(413).send({ error: "This photo is larger than 10 MB. Please choose a smaller photo." });
      if (!sniffImageType(bytes)) return reply.code(415).send({ error: "Please upload a JPG, PNG or WebP photo." });

      let normalized;
      try {
        normalized = await normalizeProductPhoto(bytes);
      } catch (err) {
        return reply.code(422).send({ error: err instanceof Error ? err.message : "This photo could not be read." });
      }
      const studentId = request.authContext!.studentId!;
      const filename = `${parsed.data.filename.replace(/\.[^.]+$/, "").slice(0, 80) || "product"}.jpg`;
      const key = buildStorageKey(studentId, "ProductPhoto", filename);
      await storage.save(key, normalized.buffer);
      const doc = await db.document.create({
        data: { ownerStudentId: studentId, documentType: "ProductPhoto", originalFilename: filename, storageKey: key, mimeType: "image/jpeg", sizeBytes: normalized.buffer.byteLength, status: "VERIFIED", accessClassification: "PRIVATE_STUDENT", uploadedById: request.authContext!.userId },
      });
      return reply.code(201).send({ photo: { id: doc.id, width: normalized.width, height: normalized.height, previewUrl: mediaUrl(doc.id, "photo", "inline") } });
    },
  );

  app.post(
    "/api/video-creator/videos",
    { preHandler: activeCustomer, config: { rateLimit: { max: opts.createRateLimitPerMinute ?? 10, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const parsed = createSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: "Please check your video settings and try again.", details: parsed.error.flatten() });
      const d = parsed.data;
      const ctx = request.authContext!;
      const outcome = await createVideoJob({
        studentId: ctx.studentId!,
        requestedById: ctx.userId,
        productPhotoDocumentId: d.productPhotoId,
        style: d.style,
        language: d.language,
        aspectRatio: d.aspectRatio,
        durationSeconds: d.durationSeconds,
        resolution: d.resolution,
        product: d.product,
        overlay: d.overlay,
        voiceover: d.voiceover,
        customInstructions: d.customInstructions || undefined,
        idempotencyKey: d.idempotencyKey,
      });
      if (!outcome.ok) return reply.code(outcome.httpStatus).send({ error: outcome.error, code: outcome.code });
      return reply.code(outcome.duplicate ? 200 : 201).send({ video: serializeJobForCustomer(outcome.job), duplicate: outcome.duplicate });
    },
  );

  app.get("/api/video-creator/videos", { preHandler: customer }, async (request, reply) => {
    const q = z
      .object({ search: z.string().max(100).optional(), status: z.enum(["ALL", "COMPLETED", "IN_PROGRESS", "FAILED"]).default("ALL"), style: z.enum(["ALL", ...VIDEO_STYLES]).default("ALL"), limit: z.coerce.number().int().min(1).max(100).default(50) })
      .safeParse(request.query);
    if (!q.success) return reply.code(400).send({ error: "Invalid filter." });
    const { search, status, style, limit } = q.data;
    const rows = await db.videoGenerationJob.findMany({
      where: {
        studentId: request.authContext!.studentId!,
        source: "VIDEO_CREATOR",
        deletedAt: null,
        ...(status === "COMPLETED" ? { status: "COMPLETED" } : status === "FAILED" ? { status: "FAILED" } : status === "IN_PROGRESS" ? { status: { in: [...ACTIVE_STATUSES] } } : {}),
        ...(style !== "ALL" ? { style } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: search ? 1000 : limit,
    });
    // Case-insensitive search on product name / video id (done here because
    // the product name lives inside the JSON input column).
    const needle = search?.trim().toLowerCase();
    const jobs = needle
      ? rows.filter((j) => j.jobDisplayId.toLowerCase().includes(needle) || String((j.inputJson as { product?: { productName?: string } } | null)?.product?.productName ?? "").toLowerCase().includes(needle)).slice(0, limit)
      : rows;
    return reply.send({ videos: jobs.map(serializeJobForCustomer) });
  });

  app.get("/api/video-creator/videos/:id", { preHandler: customer }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const job = await db.videoGenerationJob.findUnique({ where: { id } });
    // 404 (not 403) for someone else's video, so ids can't be probed.
    if (!job || job.studentId !== request.authContext!.studentId || job.source !== "VIDEO_CREATOR" || job.deletedAt) return reply.code(404).send({ error: "Video not found." });
    return reply.send({ video: serializeJobForCustomer(job) });
  });

  app.delete("/api/video-creator/videos/:id", { preHandler: customer }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const ctx = request.authContext!;
    const job = await db.videoGenerationJob.findUnique({ where: { id } });
    if (!job || job.studentId !== ctx.studentId || job.source !== "VIDEO_CREATOR" || job.deletedAt) return reply.code(404).send({ error: "Video not found." });
    if ((ACTIVE_STATUSES as readonly string[]).includes(job.status)) return reply.code(409).send({ error: "This video is still being created. You can delete it once it has finished." });
    await db.videoGenerationJob.update({ where: { id }, data: { deletedAt: new Date() } });
    // Remove the generated files from storage (the product photo is kept only
    // if another video still uses it).
    const docIds = [job.resultDocumentId, job.finalDocumentId, job.thumbnailDocumentId, job.firstFrameDocumentId].filter((x): x is string => !!x);
    const docs = await db.document.findMany({ where: { id: { in: docIds } } });
    for (const doc of docs) await storage.remove(doc.storageKey).catch(() => {});
    if (job.referenceImageDocumentId) {
      const stillUsed = await db.videoGenerationJob.count({ where: { referenceImageDocumentId: job.referenceImageDocumentId, deletedAt: null } });
      if (!stillUsed) {
        const photo = await db.document.findUnique({ where: { id: job.referenceImageDocumentId } });
        if (photo) await storage.remove(photo.storageKey).catch(() => {});
      }
    }
    await writeAuditLog({ action: "Video Creator Video Deleted", summary: `${job.jobDisplayId} deleted by its owner`, actorUserId: ctx.userId, entityType: "VideoGenerationJob", entityId: id });
    return reply.send({ ok: true });
  });

  // Signed media streaming with HTTP Range support (needed for seeking and
  // for iOS Safari, which refuses to play video without range responses).
  app.get(API_MEDIA_PATH, { config: { rateLimit: { max: 600, timeWindow: "1 minute" } } }, async (request, reply) => {
    const { token } = request.query as { token?: string };
    const verified = token ? verifyMediaToken(token) : null;
    if (!verified) return reply.code(403).send({ error: "This link has expired. Please refresh the page." });
    const doc = await db.document.findUnique({ where: { id: verified.documentId } });
    if (!doc) return reply.code(404).send({ error: "File not found." });
    if (verified.jobId !== "photo") {
      const job = await db.videoGenerationJob.findUnique({ where: { id: verified.jobId } });
      const belongs = job && !job.deletedAt && job.studentId === doc.ownerStudentId && [job.resultDocumentId, job.finalDocumentId, job.thumbnailDocumentId, job.referenceImageDocumentId].includes(doc.id);
      if (!belongs) return reply.code(404).send({ error: "File not found." });
    } else if (doc.documentType !== "ProductPhoto") {
      return reply.code(404).send({ error: "File not found." });
    }

    let bytes: Buffer;
    try {
      bytes = await storage.read(doc.storageKey);
    } catch {
      return reply.code(404).send({ error: "File not found." });
    }
    const total = bytes.byteLength;
    const safeName = doc.originalFilename.replace(/[^a-zA-Z0-9._-]/g, "_");
    reply.header("Content-Type", doc.mimeType);
    reply.header("Accept-Ranges", "bytes");
    reply.header("Cache-Control", "private, max-age=3600");
    reply.header("Content-Disposition", `${verified.disposition}; filename="${safeName}"`);
    reply.header("Cross-Origin-Resource-Policy", "cross-origin");

    const range = request.headers.range;
    const m = range ? /^bytes=(\d*)-(\d*)$/.exec(range) : null;
    if (m && (m[1] || m[2])) {
      let start = m[1] ? Number(m[1]) : total - Number(m[2]);
      let end = m[1] && m[2] ? Number(m[2]) : total - 1;
      start = Math.max(0, start);
      end = Math.min(end, total - 1);
      if (start > end || start >= total) {
        reply.header("Content-Range", `bytes */${total}`);
        return reply.code(416).send();
      }
      reply.header("Content-Range", `bytes ${start}-${end}/${total}`);
      reply.header("Content-Length", String(end - start + 1));
      return reply.code(206).send(bytes.subarray(start, end + 1));
    }
    reply.header("Content-Length", String(total));
    return reply.send(bytes);
  });

  // Any logged-in user (customer or staff) can change their own password.
  app.post("/api/video-creator/account/password", { preHandler: [requireAuth], config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (request, reply) => {
    const parsed = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(1) }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid request." });
    const ctx = request.authContext!;
    const user = await db.user.findUniqueOrThrow({ where: { id: ctx.userId } });
    if (!(await verifyPassword(parsed.data.currentPassword, user.passwordHash))) return reply.code(400).send({ error: "Your current password is incorrect." });
    const weak = validatePasswordStrength(parsed.data.newPassword);
    if (weak) return reply.code(400).send({ error: weak });
    await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(parsed.data.newPassword) } });
    // Sign out every OTHER session; keep this one.
    const current = request.cookies["maia_session"];
    const { createHash } = await import("node:crypto");
    const currentHash = current ? createHash("sha256").update(current).digest("hex") : "";
    await db.session.updateMany({ where: { userId: user.id, revokedAt: null, NOT: { tokenHash: currentHash } }, data: { revokedAt: new Date() } });
    await writeAuditLog({ action: "Password Changed", summary: `${ctx.fullName} changed their password`, actorUserId: ctx.userId });
    return reply.send({ ok: true });
  });

  // A fresh client-side idempotency key, for clients that can't make UUIDs.
  app.get("/api/video-creator/idempotency-key", { preHandler: customer }, async (_request, reply) => reply.send({ key: randomUUID() }));
}
