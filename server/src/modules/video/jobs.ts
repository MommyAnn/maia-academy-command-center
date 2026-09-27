// Real Veo job orchestration (M.A.I.A. Video Director backend). A job's
// status is only ever advanced after the corresponding real event actually
// happens — created PENDING, SUBMITTED only after Google actually accepts
// the request, COMPLETED only after a real video has been downloaded and
// stored as a real Document. Nothing here ever jumps straight to COMPLETED
// or fabricates a result on failure.

import { db } from "../../db.js";
import { env } from "../../env.js";
import { writeAuditLog } from "../../audit/log.js";
import { generateVideoJobDisplayId } from "../sequence.js";
import { localDriver, buildStorageKey } from "../../storage/localDriver.js";
import { submitVideoGeneration, pollVideoOperation, downloadVideo, isVeoConfigured, VEO_ASPECT_RATIOS, VEO_DURATIONS_SECONDS, type VeoAspectRatio, type VeoDurationSeconds } from "../../ai/veo.js";

export { VEO_ASPECT_RATIOS, VEO_DURATIONS_SECONDS };

export interface CreateJobInput {
  studentId: string;
  businessId: string;
  campaignId?: string;
  prompt: string;
  negativePrompt?: string;
  aspectRatio: VeoAspectRatio;
  durationSeconds: VeoDurationSeconds;
  referenceImageDocumentId?: string;
  requestedById: string;
}

export type CreateJobOutcome = { ok: true; jobId: string; status: string } | { ok: false; httpStatus: number; reason: string };

/** Creates the job row, then attempts a real submission immediately. A submission failure still leaves a real, honest FAILED job row — never silently dropped. */
export async function createAndSubmitVideoJob(input: CreateJobInput): Promise<CreateJobOutcome> {
  let referenceImage: { bytesBase64Encoded: string; mimeType: string } | undefined;
  if (input.referenceImageDocumentId) {
    const doc = await db.document.findUnique({ where: { id: input.referenceImageDocumentId } });
    if (!doc || doc.ownerStudentId !== input.studentId) {
      return { ok: false, httpStatus: 403, reason: "This reference image does not belong to the requesting student." };
    }
    const bytes = await localDriver.read(doc.storageKey);
    referenceImage = { bytesBase64Encoded: bytes.toString("base64"), mimeType: doc.mimeType };
  }

  const job = await db.videoGenerationJob.create({
    data: {
      jobDisplayId: await generateVideoJobDisplayId(),
      studentId: input.studentId,
      businessId: input.businessId,
      campaignId: input.campaignId ?? null,
      provider: "GOOGLE",
      model: env.GOOGLE_VEO_MODEL,
      prompt: input.prompt,
      negativePrompt: input.negativePrompt ?? null,
      aspectRatio: input.aspectRatio,
      durationSeconds: input.durationSeconds,
      referenceImageDocumentId: input.referenceImageDocumentId ?? null,
      status: "PENDING",
      requestedById: input.requestedById,
    },
  });
  await writeAuditLog({ action: "Video Generation Job Requested", summary: `Video generation requested (${input.aspectRatio}, ${input.durationSeconds}s)`, actorUserId: input.requestedById, entityType: "VideoGenerationJob", entityId: job.id });

  if (!isVeoConfigured()) {
    const failed = await db.videoGenerationJob.update({ where: { id: job.id }, data: { status: "FAILED", errorCategory: "NotConfigured", errorMessage: "GOOGLE_AI_API_KEY is not set on this server." } });
    await writeAuditLog({ action: "Video Generation Job Failed", summary: `Video generation job ${job.jobDisplayId} failed: NotConfigured`, actorUserId: input.requestedById, entityType: "VideoGenerationJob", entityId: job.id });
    return { ok: true, jobId: job.id, status: failed.status };
  }

  const submission = await submitVideoGeneration({ prompt: input.prompt, negativePrompt: input.negativePrompt, aspectRatio: input.aspectRatio, durationSeconds: input.durationSeconds, referenceImage });
  if (!submission.ok) {
    const failed = await db.videoGenerationJob.update({ where: { id: job.id }, data: { status: "FAILED", errorCategory: submission.errorCategory, errorMessage: submission.message } });
    await writeAuditLog({ action: "Video Generation Job Failed", summary: `Video generation job ${job.jobDisplayId} failed: ${submission.errorCategory}`, actorUserId: input.requestedById, entityType: "VideoGenerationJob", entityId: job.id });
    return { ok: true, jobId: job.id, status: failed.status };
  }

  const submitted = await db.videoGenerationJob.update({ where: { id: job.id }, data: { status: "SUBMITTED", operationName: submission.data.operationName } });
  await writeAuditLog({ action: "Video Generation Job Submitted", summary: `Video generation job ${job.jobDisplayId} submitted to Google (operation: ${submission.data.operationName})`, actorUserId: input.requestedById, entityType: "VideoGenerationJob", entityId: job.id });
  return { ok: true, jobId: job.id, status: submitted.status };
}

export type PollJobOutcome = { ok: true; status: string; resultDocumentId?: string | null; errorMessage?: string | null } | { ok: false; httpStatus: number; reason: string };

/** Real status check — polls Google, and only on a genuinely completed operation downloads + stores the actual video. Called on demand by the frontend (or a future sweep); never assumes completion. */
export async function pollVideoJob(jobId: string): Promise<PollJobOutcome> {
  const job = await db.videoGenerationJob.findUnique({ where: { id: jobId } });
  if (!job) return { ok: false, httpStatus: 404, reason: "Video generation job not found." };

  if (job.status !== "SUBMITTED" && job.status !== "RUNNING") {
    return { ok: true, status: job.status, resultDocumentId: job.resultDocumentId, errorMessage: job.errorMessage };
  }
  if (!job.operationName) {
    const failed = await db.videoGenerationJob.update({ where: { id: jobId }, data: { status: "FAILED", errorCategory: "ProviderError", errorMessage: "Job has no operation name to poll." } });
    return { ok: true, status: failed.status, errorMessage: failed.errorMessage };
  }

  const poll = await pollVideoOperation(job.operationName);
  if (!poll.ok) {
    // A transient poll failure does not fail the job outright — the operation may still complete; report RUNNING and let the caller retry.
    await db.videoGenerationJob.update({ where: { id: jobId }, data: { status: "RUNNING" } });
    return { ok: true, status: "RUNNING", errorMessage: poll.message };
  }

  if (!poll.data.done) {
    const updated = await db.videoGenerationJob.update({ where: { id: jobId }, data: { status: "RUNNING" } });
    return { ok: true, status: updated.status };
  }

  if (poll.data.errorMessage) {
    const failed = await db.videoGenerationJob.update({ where: { id: jobId }, data: { status: "FAILED", errorCategory: "ProviderError", errorMessage: poll.data.errorMessage, completedAt: new Date() } });
    await writeAuditLog({ action: "Video Generation Job Failed", summary: `Video generation job ${job.jobDisplayId} failed: ${poll.data.errorMessage}`, actorUserId: job.requestedById, entityType: "VideoGenerationJob", entityId: jobId });
    return { ok: true, status: failed.status, errorMessage: failed.errorMessage };
  }

  if (!poll.data.videoUri) {
    const failed = await db.videoGenerationJob.update({ where: { id: jobId }, data: { status: "FAILED", errorCategory: "ProviderError", errorMessage: "Operation completed but no video URI was returned.", completedAt: new Date() } });
    return { ok: true, status: failed.status, errorMessage: failed.errorMessage };
  }

  const download = await downloadVideo(poll.data.videoUri);
  if (!download.ok) {
    const failed = await db.videoGenerationJob.update({ where: { id: jobId }, data: { status: "FAILED", errorCategory: download.errorCategory, errorMessage: download.message, completedAt: new Date() } });
    await writeAuditLog({ action: "Video Generation Job Failed", summary: `Video generation job ${job.jobDisplayId} failed to download: ${download.message}`, actorUserId: job.requestedById, entityType: "VideoGenerationJob", entityId: jobId });
    return { ok: true, status: failed.status, errorMessage: failed.errorMessage };
  }

  // Only now — with real downloaded bytes in hand — is a Document ever created. This reuses the EXACT same secure storage/Document pipeline Phase 1's document upload route already uses, so the existing signed-url/download routes serve this asset for preview with no new code.
  const filename = `${job.jobDisplayId}.mp4`;
  const storageKey = buildStorageKey(job.studentId, "AiGeneratedVideo", filename);
  try {
    await localDriver.save(storageKey, download.data.buffer);
  } catch (err) {
    const failed = await db.videoGenerationJob.update({ where: { id: jobId }, data: { status: "FAILED", errorCategory: "ProviderError", errorMessage: err instanceof Error ? err.message : "Failed to store downloaded video.", completedAt: new Date() } });
    return { ok: true, status: failed.status, errorMessage: failed.errorMessage };
  }

  const document = await db.document.create({
    data: {
      ownerStudentId: job.studentId,
      ownerBusinessId: job.businessId,
      documentType: "AiGeneratedVideo",
      originalFilename: filename,
      storageKey,
      mimeType: download.data.mimeType.split(";")[0] ?? "video/mp4",
      sizeBytes: download.data.buffer.byteLength,
      status: "VERIFIED",
      accessClassification: "PRIVATE_STUDENT" as never,
      uploadedById: job.requestedById,
    },
  });

  const completed = await db.videoGenerationJob.update({ where: { id: jobId }, data: { status: "COMPLETED", resultDocumentId: document.id, completedAt: new Date() } });
  await writeAuditLog({ action: "Video Generation Job Completed", summary: `Video generation job ${job.jobDisplayId} completed — ${download.data.buffer.byteLength} bytes stored`, actorUserId: job.requestedById, entityType: "VideoGenerationJob", entityId: jobId });
  return { ok: true, status: completed.status, resultDocumentId: completed.resultDocumentId };
}
