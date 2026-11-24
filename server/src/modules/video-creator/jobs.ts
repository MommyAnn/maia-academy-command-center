// AI Video Creator job lifecycle + background worker.
//
//   QUEUED      credits reserved, waiting for the worker to submit to Google
//   SUBMITTED   Google accepted the request (operationName saved)
//   RUNNING     Google reports the operation is still generating
//   PROCESSING  Google finished; downloading, verifying, thumbnail + overlays
//   COMPLETED   a real MP4 downloaded from Google is stored and playable
//   FAILED      terminal failure — credits restored exactly once
//
// The worker is DB-driven: jobs are claimed with SELECT ... FOR UPDATE SKIP
// LOCKED plus a lease (lockedUntil), so several server instances can run it
// safely, and a crashed worker's job is simply picked up again when its
// lease expires. No browser needs to stay open for a video to finish.

import { Prisma, type VideoGenerationJob } from "@prisma/client";
import { db } from "../../db.js";
import { env } from "../../env.js";
import { writeAuditLog } from "../../audit/log.js";
import { generateVideoJobDisplayId } from "../sequence.js";
import { buildStorageKey } from "../../storage/localDriver.js";
import { storage } from "../../storage/driver.js";
import { submitVideoGeneration, pollVideoOperation, downloadVideo, isVeoConfigured, type VeoErrorCategory } from "../../ai/veo.js";
import { applyCreditChange, getOrCreateAccount, InsufficientCreditsError, refundJobCredits } from "./credits.js";
import { buildVideoPrompt, DEFAULT_CTA, type ProductDetails } from "./prompt.js";
import { buildFirstFrame, burnOverlays, faststart, inspectVideo, makeThumbnail } from "./media.js";
import {
  activeModelOf,
  allowedDurationsOf,
  allowedResolutionsOf,
  creditCostFor,
  estimateProviderCostUsd,
  getVideoCreatorSettings,
  type AspectRatio,
  type VideoLanguage,
  type VideoStyle,
} from "./settings.js";

export const ACTIVE_STATUSES = ["QUEUED", "SUBMITTED", "RUNNING", "PROCESSING"] as const;
const SOURCE = "VIDEO_CREATOR";
const MAX_SUBMIT_ATTEMPTS = 4;
const MAX_CONSECUTIVE_POLL_FAILURES = 30;
const POLL_INTERVAL_MS = 10_000;
const LEASE_MS = 10 * 60_000;

export interface JobInput {
  product: ProductDetails;
  overlay: boolean;
  voiceover: boolean;
  customInstructions?: string;
  spokenLine?: string | null;
}

export interface CreateVideoInput {
  studentId: string;
  requestedById: string;
  productPhotoDocumentId: string;
  style: VideoStyle;
  language: VideoLanguage;
  aspectRatio: AspectRatio;
  durationSeconds: number;
  resolution: string;
  product: ProductDetails;
  overlay: boolean;
  voiceover: boolean;
  customInstructions?: string;
  idempotencyKey: string;
}

export type CreateVideoOutcome = { ok: true; job: VideoGenerationJob; duplicate: boolean } | { ok: false; httpStatus: number; code: string; error: string };

async function ensureBusiness(studentId: string): Promise<string> {
  const existing = await db.business.findFirst({ where: { studentId }, orderBy: { createdAt: "asc" } });
  if (existing) return existing.id;
  const student = await db.student.findUniqueOrThrow({ where: { id: studentId }, include: { person: true } });
  const created = await db.business.create({ data: { studentId, name: `${student.person.fullName}'s Business` } });
  return created.id;
}

/** Validates, reserves credits and creates a QUEUED job — all or nothing. Never charges twice for the same idempotencyKey. */
export async function createVideoJob(input: CreateVideoInput): Promise<CreateVideoOutcome> {
  const existing = await db.videoGenerationJob.findUnique({ where: { studentId_idempotencyKey: { studentId: input.studentId, idempotencyKey: input.idempotencyKey } } });
  if (existing) return { ok: true, job: existing, duplicate: true };

  const settings = await getVideoCreatorSettings();
  if (!settings.generationEnabled) return { ok: false, httpStatus: 503, code: "GENERATION_PAUSED", error: "Video generation is temporarily paused by the administrator. Please try again later." };
  if (!isVeoConfigured()) return { ok: false, httpStatus: 503, code: "PROVIDER_NOT_CONNECTED", error: "The AI video service is not connected yet. Please contact support." };
  if (!allowedDurationsOf(settings).includes(input.durationSeconds)) return { ok: false, httpStatus: 400, code: "INVALID_DURATION", error: "That video length is not available." };
  if (!allowedResolutionsOf(settings).includes(input.resolution)) return { ok: false, httpStatus: 400, code: "INVALID_RESOLUTION", error: "That video quality is not available." };

  const photo = await db.document.findUnique({ where: { id: input.productPhotoDocumentId } });
  if (!photo || photo.ownerStudentId !== input.studentId || photo.documentType !== "ProductPhoto") {
    return { ok: false, httpStatus: 403, code: "PHOTO_NOT_FOUND", error: "Please upload your product photo again." };
  }

  const account = await getOrCreateAccount(input.studentId);
  if (account.accessStatus !== "ACTIVE") return { ok: false, httpStatus: 403, code: "ACCESS_INACTIVE", error: "Your AI Video Creator access is not active. Please contact M.A.I.A. support." };

  const activeCount = await db.videoGenerationJob.count({ where: { studentId: input.studentId, source: SOURCE, status: { in: [...ACTIVE_STATUSES] } } });
  if (activeCount >= settings.maxActiveJobsPerUser) {
    return { ok: false, httpStatus: 429, code: "TOO_MANY_ACTIVE", error: `You already have ${activeCount} video(s) being created. Please wait for one to finish.` };
  }

  const cost = creditCostFor(settings, input.resolution);
  if (account.creditBalance < cost) {
    return { ok: false, httpStatus: 402, code: "INSUFFICIENT_CREDITS", error: `Not enough video credits. This video needs ${cost} credit(s); you have ${account.creditBalance}.` };
  }

  const model = activeModelOf(settings);
  const built = buildVideoPrompt({
    style: input.style,
    language: input.language,
    aspectRatio: input.aspectRatio,
    durationSeconds: input.durationSeconds,
    product: input.product,
    voiceover: input.voiceover,
    customInstructions: input.customInstructions,
  });
  const businessId = await ensureBusiness(input.studentId);
  const jobInput: JobInput = { product: input.product, overlay: input.overlay, voiceover: input.voiceover, customInstructions: input.customInstructions, spokenLine: built.spokenLine };
  const estimate = estimateProviderCostUsd(settings, model, input.resolution, input.durationSeconds);
  const jobDisplayId = await generateVideoJobDisplayId();

  try {
    const job = await db.$transaction(async (tx) => {
      const created = await tx.videoGenerationJob.create({
        data: {
          jobDisplayId,
          studentId: input.studentId,
          businessId,
          source: SOURCE,
          provider: "GOOGLE",
          model,
          prompt: built.prompt,
          negativePrompt: built.negativePrompt,
          aspectRatio: input.aspectRatio,
          durationSeconds: input.durationSeconds,
          resolution: input.resolution,
          style: input.style,
          language: input.language,
          inputJson: jobInput as unknown as Prisma.InputJsonValue,
          referenceImageDocumentId: photo.id,
          idempotencyKey: input.idempotencyKey,
          status: "QUEUED",
          statusMessage: "Waiting to start…",
          requestedById: input.requestedById,
          estimatedCostUsd: estimate ?? undefined,
        },
      });
      await applyCreditChange(tx, {
        accountId: account.id,
        amount: -cost,
        type: "GENERATION_CHARGE",
        idempotencyKey: `charge:${created.id}`,
        reason: `Video ${jobDisplayId}`,
        actorUserId: input.requestedById,
        jobId: created.id,
      });
      return tx.videoGenerationJob.update({ where: { id: created.id }, data: { creditsCharged: cost, creditStatus: "CHARGED" } });
    });
    await writeAuditLog({ action: "Video Generation Job Requested", summary: `${jobDisplayId} requested (${input.style}, ${input.aspectRatio}, ${input.durationSeconds}s, ${input.resolution}, ${cost} credit(s))`, actorUserId: input.requestedById, entityType: "VideoGenerationJob", entityId: job.id });
    kickWorker();
    return { ok: true, job, duplicate: false };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const dup = await db.videoGenerationJob.findUnique({ where: { studentId_idempotencyKey: { studentId: input.studentId, idempotencyKey: input.idempotencyKey } } });
      if (dup) return { ok: true, job: dup, duplicate: true };
    }
    if (err instanceof InsufficientCreditsError) return { ok: false, httpStatus: 402, code: "INSUFFICIENT_CREDITS", error: err.message };
    throw err;
  }
}

// --------------------------------------------------------------------------
// Failure handling
// --------------------------------------------------------------------------

const FRIENDLY_FAILURE: Record<string, string> = {
  ContentPolicy: "Google's safety filters declined this video. Try a different photo or description. Your credits were returned.",
  InvalidRequest: "Google could not accept these video settings. Your credits were returned.",
  NotConfigured: "The AI video service is not connected correctly. Your credits were returned; support has been notified.",
  QuotaBilling: "The AI video service is at its usage limit right now. Your credits were returned — please try again later.",
  Timeout: "Google took too long to create this video. Your credits were returned — please try again.",
  ProviderError: "Google's video service had a problem creating this video. Your credits were returned — please try again.",
  StorageError: "Your video was created but could not be saved. Your credits were returned — please try again.",
};

async function failJob(job: VideoGenerationJob, category: VeoErrorCategory | "StorageError", message: string) {
  await db.videoGenerationJob.update({
    where: { id: job.id },
    data: { status: "FAILED", errorCategory: category, errorMessage: message.slice(0, 2000), statusMessage: FRIENDLY_FAILURE[category] ?? FRIENDLY_FAILURE.ProviderError, completedAt: new Date(), lockedUntil: null, nextAttemptAt: null },
  });
  const refunded = await refundJobCredits(job.id, `Automatic refund: ${category}`);
  await writeAuditLog({ action: "Video Generation Job Failed", summary: `${job.jobDisplayId} failed (${category}): ${message.slice(0, 300)}${refunded ? ` — ${job.creditsCharged} credit(s) refunded` : ""}`, actorUserId: job.requestedById, entityType: "VideoGenerationJob", entityId: job.id });
}

const RETRIABLE_SUBMIT: VeoErrorCategory[] = ["QuotaBilling", "ProviderError", "Timeout"];

function backoffMs(attempt: number): number {
  return Math.min(5 * 60_000, 20_000 * 2 ** (attempt - 1));
}

// --------------------------------------------------------------------------
// Worker steps
// --------------------------------------------------------------------------

async function submitStep(job: VideoGenerationJob) {
  const settings = await getVideoCreatorSettings();
  const inFlight = await db.videoGenerationJob.count({ where: { source: SOURCE, status: { in: ["SUBMITTED", "RUNNING", "PROCESSING"] } } });
  if (inFlight >= settings.maxActiveJobsGlobal) {
    await db.videoGenerationJob.update({ where: { id: job.id }, data: { lockedUntil: null, nextAttemptAt: new Date(Date.now() + 15_000), statusMessage: "In line — other videos are being created. Starting shortly…" } });
    return;
  }

  // Prepare the first frame once (product photo fitted to the frame).
  let frameDocId = job.firstFrameDocumentId;
  let frameBytes: Buffer;
  try {
    if (frameDocId) {
      const doc = await db.document.findUniqueOrThrow({ where: { id: frameDocId } });
      frameBytes = await storage.read(doc.storageKey);
    } else {
      const photoDoc = await db.document.findUniqueOrThrow({ where: { id: job.referenceImageDocumentId! } });
      const photo = await storage.read(photoDoc.storageKey);
      frameBytes = await buildFirstFrame(photo, job.aspectRatio as AspectRatio);
      const key = buildStorageKey(job.studentId, "VideoFirstFrame", `${job.jobDisplayId}-frame.jpg`);
      await storage.save(key, frameBytes);
      const doc = await db.document.create({
        data: { ownerStudentId: job.studentId, ownerBusinessId: job.businessId, documentType: "VideoFirstFrame", originalFilename: `${job.jobDisplayId}-frame.jpg`, storageKey: key, mimeType: "image/jpeg", sizeBytes: frameBytes.byteLength, status: "VERIFIED", accessClassification: "PRIVATE_STUDENT", uploadedById: job.requestedById },
      });
      frameDocId = doc.id;
      await db.videoGenerationJob.update({ where: { id: job.id }, data: { firstFrameDocumentId: doc.id } });
    }
  } catch (err) {
    await failJob(job, "StorageError", `Could not prepare the product photo: ${err instanceof Error ? err.message : String(err)}`);
    return;
  }

  const attempts = job.submitAttempts + 1;
  await db.videoGenerationJob.update({ where: { id: job.id }, data: { submitAttempts: attempts, statusMessage: "Sending your video request to Google…" } });
  const result = await submitVideoGeneration({
    model: job.model,
    prompt: job.prompt,
    negativePrompt: job.negativePrompt ?? undefined,
    aspectRatio: job.aspectRatio as AspectRatio,
    durationSeconds: job.durationSeconds as 4 | 6 | 8,
    resolution: job.resolution ?? undefined,
    referenceImage: { bytesBase64Encoded: frameBytes.toString("base64"), mimeType: "image/jpeg" },
  });

  if (result.ok) {
    await db.videoGenerationJob.update({
      where: { id: job.id },
      data: { status: "SUBMITTED", operationName: result.data.operationName, submittedAt: new Date(), lockedUntil: null, nextAttemptAt: new Date(Date.now() + POLL_INTERVAL_MS), statusMessage: "Google accepted your request. Creating your video…" },
    });
    await writeAuditLog({ action: "Video Generation Job Submitted", summary: `${job.jobDisplayId} submitted to Google (${job.model})`, actorUserId: job.requestedById, entityType: "VideoGenerationJob", entityId: job.id });
    return;
  }

  if (RETRIABLE_SUBMIT.includes(result.errorCategory) && attempts < MAX_SUBMIT_ATTEMPTS) {
    await db.videoGenerationJob.update({
      where: { id: job.id },
      data: { lockedUntil: null, nextAttemptAt: new Date(Date.now() + backoffMs(attempts)), errorCategory: result.errorCategory, errorMessage: result.message.slice(0, 2000), statusMessage: `Google is busy right now — retrying automatically (attempt ${attempts + 1} of ${MAX_SUBMIT_ATTEMPTS})…` },
    });
    return;
  }
  await failJob(job, result.errorCategory, result.message);
}

async function pollStep(job: VideoGenerationJob) {
  if (!job.operationName) {
    await failJob(job, "ProviderError", "Job has no Google operation to check.");
    return;
  }
  const startedAt = job.submittedAt ?? job.createdAt;
  if (Date.now() - startedAt.getTime() > env.VIDEO_JOB_TIMEOUT_MINUTES * 60_000) {
    await failJob(job, "Timeout", `Google did not finish within ${env.VIDEO_JOB_TIMEOUT_MINUTES} minutes.`);
    return;
  }

  const poll = await pollVideoOperation(job.operationName);
  if (!poll.ok) {
    const failures = job.pollFailures + 1;
    if (failures >= MAX_CONSECUTIVE_POLL_FAILURES || poll.errorCategory === "NotConfigured") {
      await failJob(job, poll.errorCategory, `Status checks kept failing: ${poll.message}`);
      return;
    }
    await db.videoGenerationJob.update({ where: { id: job.id }, data: { pollFailures: failures, lockedUntil: null, nextAttemptAt: new Date(Date.now() + POLL_INTERVAL_MS * Math.min(failures, 6)), statusMessage: "Still creating — reconnecting to Google…" } });
    return;
  }

  if (!poll.data.done) {
    const elapsed = Math.round((Date.now() - startedAt.getTime()) / 1000);
    await db.videoGenerationJob.update({ where: { id: job.id }, data: { status: "RUNNING", pollFailures: 0, lockedUntil: null, nextAttemptAt: new Date(Date.now() + POLL_INTERVAL_MS), statusMessage: `Google is creating your video… (${Math.floor(elapsed / 60)}m ${elapsed % 60}s so far)` } });
    return;
  }

  if (poll.data.errorMessage || !poll.data.videoUri) {
    await failJob(job, poll.data.safetyFiltered ? "ContentPolicy" : "ProviderError", poll.data.errorMessage ?? "Google finished without returning a video.");
    return;
  }

  await db.videoGenerationJob.update({ where: { id: job.id }, data: { status: "PROCESSING", statusMessage: "Video ready at Google — downloading and finishing touches…" } });
  const download = await downloadVideo(poll.data.videoUri);
  if (!download.ok) {
    const failures = job.pollFailures + 1;
    if (failures >= 5) {
      await failJob(job, download.errorCategory, download.message);
      return;
    }
    await db.videoGenerationJob.update({ where: { id: job.id }, data: { pollFailures: failures, lockedUntil: null, nextAttemptAt: new Date(Date.now() + 15_000), statusMessage: "Downloading your video — retrying…" } });
    return;
  }

  await finishJob(job, download.data.buffer);
}

async function saveDoc(job: VideoGenerationJob, type: string, filename: string, mimeType: string, bytes: Buffer) {
  const key = buildStorageKey(job.studentId, type, filename);
  await storage.save(key, bytes);
  return db.document.create({
    data: { ownerStudentId: job.studentId, ownerBusinessId: job.businessId, documentType: type, originalFilename: filename, storageKey: key, mimeType, sizeBytes: bytes.byteLength, status: "VERIFIED", accessClassification: "PRIVATE_STUDENT", uploadedById: job.requestedById },
  });
}

/** Only reached with real bytes from Google in hand. Verifies they are a playable video before anything is marked COMPLETED. */
async function finishJob(job: VideoGenerationJob, raw: Buffer) {
  let info;
  try {
    info = await inspectVideo(raw);
  } catch (err) {
    await failJob(job, "ProviderError", err instanceof Error ? err.message : "Downloaded file is not a valid video.");
    return;
  }

  const warnings: string[] = [];
  let original = raw;
  try {
    original = await faststart(raw);
  } catch {
    // Keep Google's bytes untouched if remuxing fails — still a valid video.
  }

  let originalDoc;
  try {
    originalDoc = await saveDoc(job, "AiGeneratedVideo", `${job.jobDisplayId}-original.mp4`, "video/mp4", original);
  } catch (err) {
    await failJob(job, "StorageError", err instanceof Error ? err.message : "Could not store the video.");
    return;
  }

  let thumbDocId: string | null = null;
  try {
    const thumb = await makeThumbnail(original, Math.min(1.5, info.durationSeconds / 2));
    thumbDocId = (await saveDoc(job, "VideoThumbnail", `${job.jobDisplayId}-thumb.jpg`, "image/jpeg", thumb)).id;
  } catch (err) {
    warnings.push(`Thumbnail could not be created: ${err instanceof Error ? err.message : String(err)}`);
  }

  let finalDocId: string | null = null;
  const input = (job.inputJson ?? {}) as unknown as JobInput;
  if (input.overlay) {
    try {
      const lang = (job.language ?? "ENGLISH") as VideoLanguage;
      const withText = await burnOverlays(original, info, {
        productName: input.product?.productName,
        price: input.product?.price,
        callToAction: input.product?.callToAction || DEFAULT_CTA[lang],
      });
      if (withText) finalDocId = (await saveDoc(job, "AiGeneratedVideo", `${job.jobDisplayId}.mp4`, "video/mp4", withText)).id;
    } catch (err) {
      warnings.push(`Text overlay could not be added; the original video is provided instead. (${err instanceof Error ? err.message.slice(0, 200) : String(err)})`);
    }
  }

  await db.videoGenerationJob.update({
    where: { id: job.id },
    data: {
      status: "COMPLETED",
      resultDocumentId: originalDoc.id,
      finalDocumentId: finalDocId,
      thumbnailDocumentId: thumbDocId,
      completedAt: new Date(),
      lockedUntil: null,
      nextAttemptAt: null,
      errorCategory: null,
      errorMessage: null,
      warningMessage: warnings.length ? warnings.join(" ") : null,
      statusMessage: "Your video is ready!",
    },
  });
  await writeAuditLog({ action: "Video Generation Job Completed", summary: `${job.jobDisplayId} completed — ${original.byteLength} bytes, ${info.width}x${info.height}, ${info.durationSeconds.toFixed(1)}s`, actorUserId: job.requestedById, entityType: "VideoGenerationJob", entityId: job.id });
}

// --------------------------------------------------------------------------
// Claiming + loop
// --------------------------------------------------------------------------

async function claimNextJob(): Promise<VideoGenerationJob | null> {
  const rows = await db.$queryRaw<{ id: string }[]>`
    UPDATE "VideoGenerationJob" SET "lockedUntil" = ${new Date(Date.now() + LEASE_MS)}
    WHERE "id" = (
      SELECT "id" FROM "VideoGenerationJob"
      WHERE "source" = ${SOURCE}
        AND "status" IN ('QUEUED', 'SUBMITTED', 'RUNNING', 'PROCESSING')
        AND ("lockedUntil" IS NULL OR "lockedUntil" < NOW())
        AND ("nextAttemptAt" IS NULL OR "nextAttemptAt" <= NOW())
        AND "deletedAt" IS NULL
      ORDER BY "createdAt" ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING "id"`;
  if (!rows.length) return null;
  return db.videoGenerationJob.findUnique({ where: { id: rows[0]!.id } });
}

async function processJob(job: VideoGenerationJob) {
  try {
    if (job.status === "QUEUED") await submitStep(job);
    else await pollStep(job);
  } catch (err) {
    // Unexpected bug/DB error: release the lease and retry later rather than
    // leaving the job stuck. The overall timeout still guarantees a refund.
    console.error(`[video-worker] ${job.jobDisplayId} step failed`, err);
    await db.videoGenerationJob.update({ where: { id: job.id }, data: { lockedUntil: null, nextAttemptAt: new Date(Date.now() + 30_000) } }).catch(() => {});
    if (job.status === "QUEUED" && Date.now() - job.createdAt.getTime() > env.VIDEO_JOB_TIMEOUT_MINUTES * 60_000) {
      await failJob(job, "ProviderError", err instanceof Error ? err.message : String(err)).catch(() => {});
    }
  }
}

/** One worker pass: processes every job that is due right now. Exported for tests and for a standalone worker process. */
export async function runVideoWorkerTick(maxJobs = 20): Promise<number> {
  let processed = 0;
  const running: Promise<void>[] = [];
  for (let i = 0; i < maxJobs; i++) {
    const job = await claimNextJob();
    if (!job) break;
    processed++;
    running.push(processJob(job));
  }
  await Promise.all(running);
  return processed;
}

let timer: NodeJS.Timeout | null = null;
let ticking = false;

async function guardedTick() {
  if (ticking) return;
  ticking = true;
  try {
    await runVideoWorkerTick();
  } catch (err) {
    console.error("[video-worker] tick failed", err);
  } finally {
    ticking = false;
  }
}

export function startVideoWorker() {
  if (timer) return;
  timer = setInterval(guardedTick, env.VIDEO_WORKER_INTERVAL_MS);
  timer.unref?.();
}

export function stopVideoWorker() {
  if (timer) clearInterval(timer);
  timer = null;
}

/** Nudges the worker right away (instead of waiting for the next interval) when a job is created. */
function kickWorker() {
  if (timer) setTimeout(guardedTick, 50).unref?.();
}
