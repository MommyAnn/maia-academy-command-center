// M.A.I.A. Video Director — real Google Veo backend (fake-server-driven).
// Exercises the ACTUAL src/ai/veo.ts client, src/modules/video/jobs.ts
// orchestration, and src/modules/video/routes.ts end-to-end against a local
// fake Veo HTTP server (tests/veo-fake-server.ts) — the same rationale as
// tests/anthropic-fake-server.ts: this sandbox's egress proxy blocks
// Google's real domains, so a real live call to generativelanguage.
// googleapis.com cannot be made here. This proves the real code paths
// (submit, poll-until-done, download, store, honest failure categorization)
// without ever fabricating a result — nothing here mocks jobs.ts or
// veo.ts themselves, only the HTTP server they talk to.

import { beforeAll, afterAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { db } from "../src/db.js";
import { resetDb, loginAs, DEV_USERS } from "./helpers.js";
import { createFakeAnthropicServer } from "./anthropic-fake-server.js";
import { createFakeVeoServer, type FakeVeoMode } from "./veo-fake-server.js";
import { env } from "../src/env.js";
import { localDriver, buildStorageKey } from "../src/storage/localDriver.js";

let app: FastifyInstance;
let ownerCookie: string;
let studentACookie: string;
let studentBCookie: string;
let studentAId: string;
let studentBId: string;
let devSeedUserId: string;
const fakeAnthropic = createFakeAnthropicServer(4011);
const fakeVeo = createFakeVeoServer(4012);

beforeAll(async () => {
  await fakeAnthropic.start();
  await fakeVeo.start();
  await resetDb();
  // This suite legitimately creates far more than 10 video jobs across its
  // many success/failure/validation scenarios — same override pattern as
  // Phase 7's migration-upload rate limit override.
  app = await buildApp({ videoJobRateLimitOverride: 1000 });
  ownerCookie = await loginAs(app, DEV_USERS.owner.email, DEV_USERS.owner.password);
  studentACookie = await loginAs(app, DEV_USERS.studentA.email, DEV_USERS.studentA.password);
  studentBCookie = await loginAs(app, DEV_USERS.studentB.email, DEV_USERS.studentB.password);
  studentAId = (await db.student.findUniqueOrThrow({ where: { studentDisplayId: "MAIA-B14-DEV-A" } })).id;
  studentBId = (await db.student.findUniqueOrThrow({ where: { studentDisplayId: "MAIA-B14-DEV-B" } })).id;
  devSeedUserId = (await db.user.findFirstOrThrow({ where: { person: { fullName: "Mommy Ann (Dev Seed)" } } })).id;
});

afterAll(async () => {
  await app.close();
  await db.$disconnect();
  await fakeAnthropic.stop();
  await fakeVeo.stop();
});

async function createBusiness(cookie: string, studentId: string, name: string) {
  const res = await app.inject({ method: "POST", url: `/api/students/${studentId}/businesses`, headers: { cookie }, payload: { name } });
  expect(res.statusCode).toBe(201);
  return res.json().business as { id: string };
}

// A short cinematic prompt matching the unbranded-product-commercial style
// this feature is meant for — no people, no readable text, no real brand.
const VALID_PAYLOAD = {
  aspectRatio: "9:16" as const,
  durationSeconds: 6,
  prompt: "A cinematic close-up product shot of an unbranded glass cosmetic bottle rotating slowly on a marble surface, soft luxury studio lighting, no people, no readable text.",
};

describe("M.A.I.A. Video Director — real Veo backend (spec: technical readiness audit follow-up)", () => {
  it("GET /api/video-generation/status reports honest configuration + real Veo 3.1 constraints, never exposes the credential value", async () => {
    const res = await app.inject({ method: "GET", url: "/api/video-generation/status", headers: { cookie: studentACookie } });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.provider).toBe("GOOGLE");
    expect(body.model).toBe(env.GOOGLE_VEO_MODEL);
    expect(body.configured).toBe(true);
    expect(body.supportedAspectRatios).toEqual(["9:16", "16:9"]);
    expect(body.supportedDurations).toEqual([4, 6, 8]);
    expect(JSON.stringify(body)).not.toContain(env.GOOGLE_AI_API_KEY);
  });

  describe("request validation — never assumes an aspect ratio/duration the model does not support", () => {
    it("rejects an unsupported aspect ratio (e.g. 1:1) with 400, never submits to Google", async () => {
      const business = await createBusiness(studentACookie, studentAId, "Validation Business — Bad Aspect Ratio");
      const beforeSubmitCount = fakeVeo.getSubmitCount();
      const res = await app.inject({ method: "POST", url: `/api/students/${studentAId}/video-jobs`, headers: { cookie: studentACookie }, payload: { ...VALID_PAYLOAD, businessId: business.id, aspectRatio: "1:1" } });
      expect(res.statusCode).toBe(400);
      expect(fakeVeo.getSubmitCount()).toBe(beforeSubmitCount);
    });

    it("rejects an unsupported duration (e.g. 5s) with 400, never submits to Google", async () => {
      const business = await createBusiness(studentACookie, studentAId, "Validation Business — Bad Duration");
      const beforeSubmitCount = fakeVeo.getSubmitCount();
      const res = await app.inject({ method: "POST", url: `/api/students/${studentAId}/video-jobs`, headers: { cookie: studentACookie }, payload: { ...VALID_PAYLOAD, businessId: business.id, durationSeconds: 5 } });
      expect(res.statusCode).toBe(400);
      expect(fakeVeo.getSubmitCount()).toBe(beforeSubmitCount);
    });

    for (const aspectRatio of ["9:16", "16:9"] as const) {
      it(`accepts the real supported aspect ratio ${aspectRatio}`, async () => {
        fakeVeo.setMode("immediate_done");
        const business = await createBusiness(studentACookie, studentAId, `Aspect OK Business ${aspectRatio}`);
        const res = await app.inject({ method: "POST", url: `/api/students/${studentAId}/video-jobs`, headers: { cookie: studentACookie }, payload: { ...VALID_PAYLOAD, businessId: business.id, aspectRatio } });
        expect(res.statusCode).toBe(201);
        expect(res.json().job.status).toBe("SUBMITTED");
      });
    }

    for (const durationSeconds of [4, 6, 8]) {
      it(`accepts the real supported duration ${durationSeconds}s`, async () => {
        fakeVeo.setMode("immediate_done");
        const business = await createBusiness(studentACookie, studentAId, `Duration OK Business ${durationSeconds}`);
        const res = await app.inject({ method: "POST", url: `/api/students/${studentAId}/video-jobs`, headers: { cookie: studentACookie }, payload: { ...VALID_PAYLOAD, businessId: business.id, durationSeconds } });
        expect(res.statusCode).toBe(201);
        expect(res.json().job.status).toBe("SUBMITTED");
      });
    }
  });

  it("full success flow: submit -> Google accepts -> poll RUNNING -> poll COMPLETED -> real bytes downloaded and stored as a real Document -> previewable via the existing signed-download pipeline -> honest audit trail", async () => {
    fakeVeo.setMode("success");
    fakeVeo.setDoneAfterPolls(2);
    const business = await createBusiness(studentACookie, studentAId, "Full Success Business");

    const createRes = await app.inject({ method: "POST", url: `/api/students/${studentAId}/video-jobs`, headers: { cookie: studentACookie }, payload: { ...VALID_PAYLOAD, businessId: business.id } });
    expect(createRes.statusCode).toBe(201);
    const job = createRes.json().job;
    expect(job.status).toBe("SUBMITTED");
    expect(job.operationName).toBeTruthy();
    const submitBody = fakeVeo.getLastSubmitBody();
    expect(submitBody?.instances?.[0]?.prompt).toBe(VALID_PAYLOAD.prompt);
    expect(submitBody?.parameters?.aspectRatio).toBe("9:16");
    expect(submitBody?.parameters?.durationSeconds).toBe(6);

    // Poll #1 — Google's own operation is genuinely still processing.
    const poll1 = await app.inject({ method: "POST", url: `/api/video-jobs/${job.id}/poll`, headers: { cookie: studentACookie } });
    expect(poll1.statusCode).toBe(200);
    expect(poll1.json().status).toBe("RUNNING");
    expect((await db.videoGenerationJob.findUniqueOrThrow({ where: { id: job.id } })).status).toBe("RUNNING");

    // Poll #2 — genuinely done: real bytes are downloaded and stored.
    const poll2 = await app.inject({ method: "POST", url: `/api/video-jobs/${job.id}/poll`, headers: { cookie: studentACookie } });
    expect(poll2.statusCode).toBe(200);
    expect(poll2.json().status).toBe("COMPLETED");
    const resultDocumentId = poll2.json().resultDocumentId as string;
    expect(resultDocumentId).toBeTruthy();

    const document = await db.document.findUniqueOrThrow({ where: { id: resultDocumentId } });
    expect(document.documentType).toBe("AiGeneratedVideo");
    expect(document.mimeType).toBe("video/mp4");
    expect(document.status).toBe("VERIFIED");
    expect(document.ownerStudentId).toBe(studentAId);
    expect(document.ownerBusinessId).toBe(business.id);
    const storedBytes = await localDriver.read(document.storageKey);
    expect(storedBytes.equals(fakeVeo.getVideoBytes())).toBe(true);

    // A completed job is previewable through the EXISTING secure
    // signed-download pipeline (server/src/modules/documents/routes.ts) —
    // no new preview mechanism, zero existing code touched.
    const previewRes = await app.inject({ method: "GET", url: `/api/video-jobs/${job.id}/preview-url`, headers: { cookie: studentACookie } });
    expect(previewRes.statusCode).toBe(200);
    const previewUrl = previewRes.json().url as string;
    expect(previewUrl).toMatch(/^\/api\/documents\/download\?token=/);
    const downloadRes = await app.inject({ method: "GET", url: previewUrl });
    expect(downloadRes.statusCode).toBe(200);
    expect(downloadRes.headers["content-type"]).toBe("video/mp4");
    expect(Buffer.from(downloadRes.rawPayload).equals(fakeVeo.getVideoBytes())).toBe(true);

    const auditActions = (await db.activityLog.findMany({ where: { entityId: job.id, entityType: "VideoGenerationJob" }, orderBy: { occurredAt: "asc" } })).map((l) => l.action);
    expect(auditActions).toEqual(["Video Generation Job Requested", "Video Generation Job Submitted", "Video Generation Job Completed"]);
  });

  describe("submission-time failure modes — a real job row is always created, always honestly FAILED, never fabricated as SUBMITTED", () => {
    const cases: Array<{ mode: FakeVeoMode; expectedCategory: string }> = [
      { mode: "auth_failed", expectedCategory: "NotConfigured" },
      { mode: "content_policy", expectedCategory: "InvalidRequest" },
      { mode: "quota", expectedCategory: "QuotaBilling" },
      { mode: "server_error", expectedCategory: "ProviderError" },
      { mode: "malformed_no_operation_name", expectedCategory: "ProviderError" },
    ];

    for (const { mode, expectedCategory } of cases) {
      it(`Google rejecting the request as "${mode}" -> job FAILED / errorCategory ${expectedCategory}`, async () => {
        fakeVeo.setMode(mode);
        const business = await createBusiness(studentACookie, studentAId, `Submission Failure Business (${mode})`);
        const res = await app.inject({ method: "POST", url: `/api/students/${studentAId}/video-jobs`, headers: { cookie: studentACookie }, payload: { ...VALID_PAYLOAD, businessId: business.id } });
        expect(res.statusCode).toBe(201); // the job row itself is created honestly, just FAILED
        const job = res.json().job;
        expect(job.status).toBe("FAILED");
        expect(job.errorCategory).toBe(expectedCategory);
        expect(job.resultDocumentId).toBeNull();
        expect(job.operationName).toBeNull();
      });
    }
  });

  describe("poll-time failure modes — a video is never fabricated once submitted", () => {
    it("an operation-level error at poll time -> FAILED/ProviderError, no Document is ever created", async () => {
      fakeVeo.setMode("operation_error");
      fakeVeo.setDoneAfterPolls(1);
      const business = await createBusiness(studentACookie, studentAId, "Poll Operation Error Business");
      const createRes = await app.inject({ method: "POST", url: `/api/students/${studentAId}/video-jobs`, headers: { cookie: studentACookie }, payload: { ...VALID_PAYLOAD, businessId: business.id } });
      expect(createRes.json().job.status).toBe("SUBMITTED");
      const jobId = createRes.json().job.id;

      const pollRes = await app.inject({ method: "POST", url: `/api/video-jobs/${jobId}/poll`, headers: { cookie: studentACookie } });
      expect(pollRes.statusCode).toBe(200);
      expect(pollRes.json().status).toBe("FAILED");
      const job = await db.videoGenerationJob.findUniqueOrThrow({ where: { id: jobId } });
      expect(job.errorCategory).toBe("ProviderError");
      expect(job.resultDocumentId).toBeNull();
    });

    it("operation done but Google returns no video sample -> FAILED, never fabricates a video URI", async () => {
      fakeVeo.setMode("done_no_video_uri");
      fakeVeo.setDoneAfterPolls(1);
      const business = await createBusiness(studentACookie, studentAId, "No Video URI Business");
      const createRes = await app.inject({ method: "POST", url: `/api/students/${studentAId}/video-jobs`, headers: { cookie: studentACookie }, payload: { ...VALID_PAYLOAD, businessId: business.id } });
      const jobId = createRes.json().job.id;

      const pollRes = await app.inject({ method: "POST", url: `/api/video-jobs/${jobId}/poll`, headers: { cookie: studentACookie } });
      expect(pollRes.json().status).toBe("FAILED");
      expect((await db.videoGenerationJob.findUniqueOrThrow({ where: { id: jobId } })).resultDocumentId).toBeNull();
    });

    it("a transient poll transport failure -> RUNNING (retryable), never FAILED outright — the operation may still complete", async () => {
      fakeVeo.setMode("success");
      fakeVeo.setDoneAfterPolls(100);
      const business = await createBusiness(studentACookie, studentAId, "Transient Poll Failure Business");
      const createRes = await app.inject({ method: "POST", url: `/api/students/${studentAId}/video-jobs`, headers: { cookie: studentACookie }, payload: { ...VALID_PAYLOAD, businessId: business.id } });
      const jobId = createRes.json().job.id;

      fakeVeo.setMode("provider_error_on_poll");
      const pollRes = await app.inject({ method: "POST", url: `/api/video-jobs/${jobId}/poll`, headers: { cookie: studentACookie } });
      expect(pollRes.statusCode).toBe(200);
      expect(pollRes.json().status).toBe("RUNNING");
      expect((await db.videoGenerationJob.findUniqueOrThrow({ where: { id: jobId } })).status).toBe("RUNNING");
    });

    it("Google's operation completes but the actual video download fails -> FAILED/ProviderError, no Document created", async () => {
      fakeVeo.setMode("download_fails");
      fakeVeo.setDoneAfterPolls(1);
      const business = await createBusiness(studentACookie, studentAId, "Download Failure Business");
      const createRes = await app.inject({ method: "POST", url: `/api/students/${studentAId}/video-jobs`, headers: { cookie: studentACookie }, payload: { ...VALID_PAYLOAD, businessId: business.id } });
      const jobId = createRes.json().job.id;

      const pollRes = await app.inject({ method: "POST", url: `/api/video-jobs/${jobId}/poll`, headers: { cookie: studentACookie } });
      expect(pollRes.json().status).toBe("FAILED");
      const job = await db.videoGenerationJob.findUniqueOrThrow({ where: { id: jobId } });
      expect(job.errorCategory).toBe("ProviderError");
      expect(job.resultDocumentId).toBeNull();
    });
  });

  it("honestly stays NotConfigured (never fabricates a submission) when GOOGLE_AI_API_KEY is unset", async () => {
    // Deliberately, temporarily mutates the shared config singleton in
    // place (env is a plain parsed object, not frozen) to exercise the
    // real isVeoConfigured()===false branch — restored immediately after so
    // no other test in this file is affected.
    const original = env.GOOGLE_AI_API_KEY;
    (env as { GOOGLE_AI_API_KEY?: string }).GOOGLE_AI_API_KEY = undefined;
    try {
      const statusRes = await app.inject({ method: "GET", url: "/api/video-generation/status", headers: { cookie: studentACookie } });
      expect(statusRes.json().configured).toBe(false);

      const business = await createBusiness(studentACookie, studentAId, "NotConfigured Business");
      const beforeSubmitCount = fakeVeo.getSubmitCount();
      const res = await app.inject({ method: "POST", url: `/api/students/${studentAId}/video-jobs`, headers: { cookie: studentACookie }, payload: { ...VALID_PAYLOAD, businessId: business.id } });
      expect(res.statusCode).toBe(201);
      const job = res.json().job;
      expect(job.status).toBe("FAILED");
      expect(job.errorCategory).toBe("NotConfigured");
      // No network call to Google was even attempted.
      expect(fakeVeo.getSubmitCount()).toBe(beforeSubmitCount);
    } finally {
      (env as { GOOGLE_AI_API_KEY?: string }).GOOGLE_AI_API_KEY = original;
    }
  });

  it("image-to-video: a reference image Document's real bytes are base64-encoded and sent to Google; a reference image owned by another student is rejected", async () => {
    fakeVeo.setMode("immediate_done");
    const business = await createBusiness(studentACookie, studentAId, "Reference Image Business");
    const imageBytes = Buffer.from("FAKE-PNG-BYTES-NOT-A-REAL-IMAGE-FOR-TESTING-ONLY");
    const storageKey = buildStorageKey(studentAId, "AiAsset", "reference.png");
    await localDriver.save(storageKey, imageBytes);
    const referenceDoc = await db.document.create({
      data: {
        ownerStudentId: studentAId,
        ownerBusinessId: business.id,
        documentType: "AiAsset",
        originalFilename: "reference.png",
        storageKey,
        mimeType: "image/png",
        sizeBytes: imageBytes.byteLength,
        status: "VERIFIED",
        accessClassification: "PRIVATE_STUDENT",
        uploadedById: devSeedUserId,
      },
    });

    const res = await app.inject({ method: "POST", url: `/api/students/${studentAId}/video-jobs`, headers: { cookie: studentACookie }, payload: { ...VALID_PAYLOAD, businessId: business.id, referenceImageDocumentId: referenceDoc.id } });
    expect(res.statusCode).toBe(201);
    expect(res.json().job.status).toBe("SUBMITTED");
    const submitBody = fakeVeo.getLastSubmitBody();
    expect(submitBody?.instances?.[0]?.image).toEqual({ bytesBase64Encoded: imageBytes.toString("base64"), mimeType: "image/png" });

    const otherBusiness = await createBusiness(studentBCookie, studentBId, "Other Student's Business");
    const rejectRes = await app.inject({ method: "POST", url: `/api/students/${studentBId}/video-jobs`, headers: { cookie: studentBCookie }, payload: { ...VALID_PAYLOAD, businessId: otherBusiness.id, referenceImageDocumentId: referenceDoc.id } });
    expect(rejectRes.statusCode).toBe(403);
  });

  describe("business/student data isolation (spec sections 5, 88 — same standard as every prior Phase's isolation tests)", () => {
    it("Student B cannot view, poll, preview, or list Student A's video job or business", async () => {
      fakeVeo.setMode("immediate_done");
      const business = await createBusiness(studentACookie, studentAId, "Isolation Business A");
      const createRes = await app.inject({ method: "POST", url: `/api/students/${studentAId}/video-jobs`, headers: { cookie: studentACookie }, payload: { ...VALID_PAYLOAD, businessId: business.id } });
      const job = createRes.json().job;

      const getAsB = await app.inject({ method: "GET", url: `/api/video-jobs/${job.id}`, headers: { cookie: studentBCookie } });
      expect(getAsB.statusCode).toBe(403);

      const pollAsB = await app.inject({ method: "POST", url: `/api/video-jobs/${job.id}/poll`, headers: { cookie: studentBCookie } });
      expect(pollAsB.statusCode).toBe(403);

      const previewAsB = await app.inject({ method: "GET", url: `/api/video-jobs/${job.id}/preview-url`, headers: { cookie: studentBCookie } });
      expect(previewAsB.statusCode).toBe(403);

      const listAsB = await app.inject({ method: "GET", url: `/api/businesses/${business.id}/video-jobs`, headers: { cookie: studentBCookie } });
      expect(listAsB.statusCode).toBe(403);

      // Student B cannot create a job against Student A's business either.
      const crossBusinessCreate = await app.inject({ method: "POST", url: `/api/students/${studentBId}/video-jobs`, headers: { cookie: studentBCookie }, payload: { ...VALID_PAYLOAD, businessId: business.id } });
      expect(crossBusinessCreate.statusCode).toBe(403);

      // Student A cannot act through Student B's :studentId route param either.
      const impersonate = await app.inject({ method: "POST", url: `/api/students/${studentBId}/video-jobs`, headers: { cookie: studentACookie }, payload: { ...VALID_PAYLOAD, businessId: business.id } });
      expect(impersonate.statusCode).toBe(403);
    });

    it("a tampered/nonexistent businessId is rejected the same way as someone else's real business", async () => {
      const res = await app.inject({ method: "POST", url: `/api/students/${studentAId}/video-jobs`, headers: { cookie: studentACookie }, payload: { ...VALID_PAYLOAD, businessId: "nonexistent-tampered-business-id" } });
      expect(res.statusCode).toBe(403);
    });
  });

  it("admin oversight: staff holding Creative Studio/VIEW can list jobs across students; a Student session is always forbidden from the admin listing", async () => {
    const ownerRes = await app.inject({ method: "GET", url: "/api/video-generation/jobs", headers: { cookie: ownerCookie } });
    expect(ownerRes.statusCode).toBe(200);
    expect(Array.isArray(ownerRes.json().jobs)).toBe(true);

    const studentRes = await app.inject({ method: "GET", url: "/api/video-generation/jobs", headers: { cookie: studentACookie } });
    expect(studentRes.statusCode).toBe(403);
  });

  it("security: no credential value ever appears in any API response, success or failure", async () => {
    fakeVeo.setMode("success");
    fakeVeo.setDoneAfterPolls(1);
    const business = await createBusiness(studentACookie, studentAId, "Credential Leak Check Business");
    const createRes = await app.inject({ method: "POST", url: `/api/students/${studentAId}/video-jobs`, headers: { cookie: studentACookie }, payload: { ...VALID_PAYLOAD, businessId: business.id } });
    const jobId = createRes.json().job.id;
    const pollRes = await app.inject({ method: "POST", url: `/api/video-jobs/${jobId}/poll`, headers: { cookie: studentACookie } });
    const previewRes = await app.inject({ method: "GET", url: `/api/video-jobs/${jobId}/preview-url`, headers: { cookie: studentACookie } });
    const statusRes = await app.inject({ method: "GET", url: "/api/video-generation/status", headers: { cookie: studentACookie } });

    for (const body of [createRes.body, pollRes.body, previewRes.body, statusRes.body]) {
      expect(body).not.toContain(env.GOOGLE_AI_API_KEY);
    }
  });
});
