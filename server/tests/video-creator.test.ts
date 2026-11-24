// M.A.I.A. AI Video Creator — end-to-end backend tests.
//
// Drives the REAL routes, credit ledger, background worker, Veo client and
// ffmpeg media pipeline against a local fake Google endpoint
// (tests/veo-fake-server.ts) that serves a REAL MP4 file generated with
// ffmpeg. Proves credit safety, data isolation, and every failure/refund
// path. (A live Google run is a separate manual step — see README.)

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildApp } from "../src/app.js";
import { db } from "../src/db.js";
import { resetDb, loginAs, DEV_USERS } from "./helpers.js";
import { createFakeVeoServer } from "./veo-fake-server.js";
import { runVideoWorkerTick } from "../src/modules/video-creator/jobs.js";
import { refundJobCredits } from "../src/modules/video-creator/credits.js";

const fakeVeo = createFakeVeoServer(4012);
let app: FastifyInstance;
let ownerCookie: string;
let financeCookie: string;
let custA: { cookie: string; studentId: string; email: string };
let custB: { cookie: string; studentId: string; email: string };
let photoPng: string; // base64
let realMp4: Buffer;

function makeFixtures() {
  const dir = mkdtempSync(join(tmpdir(), "vc-test-"));
  try {
    execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "color=c=0xf4efe6:s=800x800,drawbox=x=300:y=150:w=200:h=500:color=0x7a3b2e:t=fill", "-frames:v", "1", join(dir, "p.png")]);
    execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=s=360x640:d=4:r=24", "-f", "lavfi", "-i", "sine=f=440:d=4", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", join(dir, "v.mp4")]);
    photoPng = readFileSync(join(dir, "p.png")).toString("base64");
    realMp4 = readFileSync(join(dir, "v.mp4"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function createCustomer(name: string, email: string, credits: number) {
  const res = await app.inject({ method: "POST", url: "/api/video-creator/admin/customers", headers: { cookie: ownerCookie }, payload: { fullName: name, email, initialCredits: credits, purchaseReference: "TEST-RECEIPT" } });
  expect(res.statusCode).toBe(201);
  const body = res.json();
  const cookie = await loginAs(app, email, body.temporaryPassword);
  return { cookie, studentId: body.studentId as string, email };
}

async function uploadPhoto(cookie: string) {
  const res = await app.inject({ method: "POST", url: "/api/video-creator/photos", headers: { cookie }, payload: { filename: "kape.png", contentBase64: photoPng } });
  expect(res.statusCode).toBe(201);
  return res.json().photo.id as string;
}

let keyCounter = 0;
function newKey() {
  return `test-key-${Date.now()}-${keyCounter++}`;
}

async function requestVideo(cookie: string, photoId: string, extra: Record<string, unknown> = {}) {
  return app.inject({
    method: "POST",
    url: "/api/video-creator/videos",
    headers: { cookie },
    payload: { productPhotoId: photoId, style: "PRODUCT_COMMERCIAL", language: "TAGLISH", aspectRatio: "9:16", durationSeconds: 8, resolution: "720p", product: { productName: "Kape Barako", price: "₱299", callToAction: "Order na!", benefits: "Rich aroma\nLocally sourced" }, idempotencyKey: newKey(), ...extra },
  });
}

async function balanceOf(cookie: string) {
  return (await app.inject({ method: "GET", url: "/api/video-creator/me", headers: { cookie } })).json().account.creditBalance as number;
}

/** Runs the worker until the job is terminal, skipping the real-time poll delays. */
async function drive(jobId: string, maxTicks = 15) {
  for (let i = 0; i < maxTicks; i++) {
    await db.videoGenerationJob.update({ where: { id: jobId }, data: { nextAttemptAt: null } });
    await runVideoWorkerTick();
    const job = await db.videoGenerationJob.findUniqueOrThrow({ where: { id: jobId } });
    if (job.status === "COMPLETED" || job.status === "FAILED") return job;
  }
  return db.videoGenerationJob.findUniqueOrThrow({ where: { id: jobId } });
}

beforeAll(async () => {
  makeFixtures();
  fakeVeo.setVideoBytes(realMp4);
  await fakeVeo.start();
  await resetDb();
  app = await buildApp({ videoCreatorRateLimitOverride: 1000 });
  ownerCookie = await loginAs(app, DEV_USERS.owner.email, DEV_USERS.owner.password);
  financeCookie = await loginAs(app, DEV_USERS.finance.email, DEV_USERS.finance.password);
  custA = await createCustomer("Ana Cruz", "ana.vc-test@example.com", 3);
  custB = await createCustomer("Ben Reyes", "ben.vc-test@example.com", 2);
}, 60_000);

afterAll(async () => {
  await app.close();
  await db.$disconnect();
  await fakeVeo.stop();
});

describe("accounts, login and admin authorization", () => {
  it("an admin-created customer can log in and sees their real credit balance", async () => {
    const me = (await app.inject({ method: "GET", url: "/api/video-creator/me", headers: { cookie: custA.cookie } })).json();
    expect(me.account).toEqual({ accessStatus: "ACTIVE", creditBalance: 3 });
    expect(me.service.providerConnected).toBe(true);
    expect(me.options.durations).toEqual([4, 6, 8]);
  });

  it("starting credits are recorded in the ledger as a GRANT", async () => {
    const tx = (await app.inject({ method: "GET", url: "/api/video-creator/credits/transactions", headers: { cookie: custA.cookie } })).json();
    expect(tx.transactions).toHaveLength(1);
    expect(tx.transactions[0]).toMatchObject({ type: "GRANT", amount: 3, balanceAfter: 3 });
  });

  it("customers and staff without the AI Video Creator permission cannot use admin routes", async () => {
    for (const cookie of [custA.cookie, financeCookie]) {
      const res = await app.inject({ method: "GET", url: "/api/video-creator/admin/customers", headers: { cookie } });
      expect(res.statusCode).toBe(403);
    }
    expect((await app.inject({ method: "GET", url: "/api/video-creator/admin/customers" })).statusCode).toBe(401);
  });

  it("staff cannot use the customer studio routes", async () => {
    const res = await app.inject({ method: "GET", url: "/api/video-creator/me", headers: { cookie: ownerCookie } });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe("NOT_A_CUSTOMER");
  });

  it("rejects duplicate customer emails", async () => {
    const res = await app.inject({ method: "POST", url: "/api/video-creator/admin/customers", headers: { cookie: ownerCookie }, payload: { fullName: "Ana Again", email: custA.email } });
    expect(res.statusCode).toBe(409);
  });

  it("admin reset links really reset the customer's password", async () => {
    const link = (await app.inject({ method: "POST", url: `/api/video-creator/admin/customers/${custB.studentId}/reset-link`, headers: { cookie: ownerCookie } })).json();
    const token = new URL(link.url).searchParams.get("token")!;
    const res = await app.inject({ method: "POST", url: "/api/auth/complete-password-reset", payload: { token, newPassword: "NewBenPass2026" } });
    expect(res.statusCode).toBe(200);
    custB.cookie = await loginAs(app, custB.email, "NewBenPass2026");
  });
});

describe("product photo upload validation", () => {
  it("rejects files that are not real images, whatever they claim to be", async () => {
    const res = await app.inject({ method: "POST", url: "/api/video-creator/photos", headers: { cookie: custA.cookie }, payload: { filename: "evil.png", contentBase64: Buffer.from("<script>alert(1)</script>").toString("base64") } });
    expect(res.statusCode).toBe(415);
  });

  it("accepts a PNG, re-encodes it as JPEG, and serves it back only through a signed link", async () => {
    const res = await app.inject({ method: "POST", url: "/api/video-creator/photos", headers: { cookie: custA.cookie }, payload: { filename: "kape.png", contentBase64: photoPng } });
    expect(res.statusCode).toBe(201);
    const { photo } = res.json();
    const img = await app.inject({ method: "GET", url: photo.previewUrl });
    expect(img.statusCode).toBe(200);
    expect(img.headers["content-type"]).toBe("image/jpeg");
    const tampered = await app.inject({ method: "GET", url: photo.previewUrl.slice(0, -3) + "AAA" });
    expect(tampered.statusCode).toBe(403);
  });
});

describe("full generation lifecycle (PRODUCT_COMMERCIAL)", () => {
  let jobId: string;

  it("charges credits once, even when the same request is sent twice", async () => {
    fakeVeo.setMode("success");
    fakeVeo.setDoneAfterPolls(2);
    const photoId = await uploadPhoto(custA.cookie);
    const key = newKey();
    const first = await requestVideo(custA.cookie, photoId, { idempotencyKey: key });
    expect(first.statusCode).toBe(201);
    const again = await requestVideo(custA.cookie, photoId, { idempotencyKey: key });
    expect(again.statusCode).toBe(200);
    expect(again.json().duplicate).toBe(true);
    expect(again.json().video.id).toBe(first.json().video.id);
    jobId = first.json().video.id;
    expect(first.json().video.status).toBe("QUEUED");
    expect(await balanceOf(custA.cookie)).toBe(2);
  });

  it("the worker submits a real image-to-video request, polls, downloads and finishes", async () => {
    const job = await drive(jobId);
    expect(job.status).toBe("COMPLETED");
    const body = fakeVeo.getLastSubmitBody()!;
    expect(body.parameters).toMatchObject({ aspectRatio: "9:16", durationSeconds: 8, resolution: "720p", personGeneration: "allow_adult" });
    const image = body.instances![0]!.image as { bytesBase64Encoded: string; mimeType: string };
    expect(image.mimeType).toBe("image/jpeg");
    expect(Buffer.from(image.bytesBase64Encoded, "base64").subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff]));
    expect(body.instances![0]!.prompt).toContain("Kape Barako");
    expect(body.instances![0]!.prompt).toContain("Taglish");
    expect(job.resultDocumentId).toBeTruthy();
    expect(job.finalDocumentId).toBeTruthy(); // overlay version
    expect(job.thumbnailDocumentId).toBeTruthy();
    expect(job.creditStatus).toBe("CHARGED");
  });

  it("serves a playable MP4 with Range support, a thumbnail, and an attachment download", async () => {
    const { video } = (await app.inject({ method: "GET", url: `/api/video-creator/videos/${jobId}`, headers: { cookie: custA.cookie } })).json();
    expect(video.status).toBe("COMPLETED");
    expect(video.media.hasTextOverlay).toBe(true);
    const full = await app.inject({ method: "GET", url: video.media.videoUrl });
    expect(full.statusCode).toBe(200);
    expect(full.headers["content-type"]).toBe("video/mp4");
    expect(full.rawPayload.subarray(4, 8).toString("ascii")).toBe("ftyp");
    const part = await app.inject({ method: "GET", url: video.media.videoUrl, headers: { range: "bytes=0-99" } });
    expect(part.statusCode).toBe(206);
    expect(part.rawPayload.length).toBe(100);
    const dl = await app.inject({ method: "GET", url: video.media.downloadUrl });
    expect(dl.headers["content-disposition"]).toMatch(/^attachment; filename=".+\.mp4"$/);
    const thumb = await app.inject({ method: "GET", url: video.media.thumbnailUrl });
    expect(thumb.headers["content-type"]).toBe("image/jpeg");
    const orig = await app.inject({ method: "GET", url: video.media.originalDownloadUrl });
    expect(orig.statusCode).toBe(200);
  });

  it("never exposes the internal prompt or provider details to the customer", async () => {
    const { video } = (await app.inject({ method: "GET", url: `/api/video-creator/videos/${jobId}`, headers: { cookie: custA.cookie } })).json();
    expect(video.prompt).toBeUndefined();
    expect(JSON.stringify(video)).not.toContain("test-google-key-not-real");
  });

  it("another customer cannot see, delete or reuse this customer's video or photo", async () => {
    expect((await app.inject({ method: "GET", url: `/api/video-creator/videos/${jobId}`, headers: { cookie: custB.cookie } })).statusCode).toBe(404);
    expect((await app.inject({ method: "DELETE", url: `/api/video-creator/videos/${jobId}`, headers: { cookie: custB.cookie } })).statusCode).toBe(404);
    const list = (await app.inject({ method: "GET", url: "/api/video-creator/videos", headers: { cookie: custB.cookie } })).json();
    expect(list.videos.map((v: { id: string }) => v.id)).not.toContain(jobId);
    const job = await db.videoGenerationJob.findUniqueOrThrow({ where: { id: jobId } });
    const steal = await requestVideo(custB.cookie, job.referenceImageDocumentId!);
    expect(steal.statusCode).toBe(403);
    expect(await balanceOf(custB.cookie)).toBe(2);
  });

  it("appears in My Videos with search and filters", async () => {
    const all = (await app.inject({ method: "GET", url: "/api/video-creator/videos?search=barako&status=COMPLETED", headers: { cookie: custA.cookie } })).json();
    expect(all.videos.map((v: { id: string }) => v.id)).toContain(jobId);
    const none = (await app.inject({ method: "GET", url: "/api/video-creator/videos?status=FAILED", headers: { cookie: custA.cookie } })).json();
    expect(none.videos.map((v: { id: string }) => v.id)).not.toContain(jobId);
  });

  it("the owner can delete it, which also removes the media", async () => {
    const { video } = (await app.inject({ method: "GET", url: `/api/video-creator/videos/${jobId}`, headers: { cookie: custA.cookie } })).json();
    expect((await app.inject({ method: "DELETE", url: `/api/video-creator/videos/${jobId}`, headers: { cookie: custA.cookie } })).statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: `/api/video-creator/videos/${jobId}`, headers: { cookie: custA.cookie } })).statusCode).toBe(404);
    expect((await app.inject({ method: "GET", url: video.media.videoUrl })).statusCode).toBe(404);
  });
});

describe("failures restore credits exactly once", () => {
  async function failingRun(mode: Parameters<typeof fakeVeo.setMode>[0], expectedCategory: string) {
    fakeVeo.setMode(mode);
    const before = await balanceOf(custA.cookie);
    const res = await requestVideo(custA.cookie, await uploadPhoto(custA.cookie));
    expect(res.statusCode).toBe(201);
    expect(await balanceOf(custA.cookie)).toBe(before - 1);
    const job = await drive(res.json().video.id);
    expect(job.status).toBe("FAILED");
    expect(job.errorCategory).toBe(expectedCategory);
    expect(job.creditStatus).toBe("REFUNDED");
    expect(await balanceOf(custA.cookie)).toBe(before);
    const ledger = await db.videoCreditTransaction.findMany({ where: { jobId: job.id } });
    expect(ledger.map((l) => l.type).sort()).toEqual(["GENERATION_CHARGE", "GENERATION_REFUND"]);
    // A second refund attempt (e.g. a racing worker) changes nothing.
    expect(await refundJobCredits(job.id, "again")).toBe(false);
    expect(await balanceOf(custA.cookie)).toBe(before);
    return job;
  }

  it("content-policy rejection at submission", async () => {
    await failingRun("content_policy", "ContentPolicy");
  });
  it("safety-filtered output (raiMediaFilteredCount)", async () => {
    const job = await failingRun("rai_filtered", "ContentPolicy");
    expect(job.statusMessage).toMatch(/safety/i);
  });
  it("operation-level error from Google", async () => {
    await failingRun("operation_error", "ContentPolicy");
  });
  it("invalid API key", async () => {
    await failingRun("auth_failed", "NotConfigured");
  });
  it("Google finished but returned no video", async () => {
    await failingRun("done_no_video_uri", "ProviderError");
  });
  it("downloaded file is not a real video", async () => {
    fakeVeo.setVideoBytes(Buffer.from("NOT-A-VIDEO"));
    await failingRun("success", "ProviderError");
    fakeVeo.setVideoBytes(realMp4);
  });
  it("persistent provider downtime exhausts retries, then refunds", async () => {
    await failingRun("server_error", "ProviderError");
  });

  it("a job Google never finishes times out and is refunded", async () => {
    fakeVeo.setMode("success");
    fakeVeo.setDoneAfterPolls(1000);
    const before = await balanceOf(custA.cookie);
    const res = await requestVideo(custA.cookie, await uploadPhoto(custA.cookie));
    const id = res.json().video.id;
    await drive(id, 2);
    await db.videoGenerationJob.update({ where: { id }, data: { submittedAt: new Date(Date.now() - 31 * 60_000) } });
    const job = await drive(id, 2);
    expect(job.status).toBe("FAILED");
    expect(job.errorCategory).toBe("Timeout");
    expect(await balanceOf(custA.cookie)).toBe(before);
    fakeVeo.setDoneAfterPolls(2);
  });
});

describe("retries and limits", () => {
  it("a temporary 429 is retried automatically and then succeeds", async () => {
    fakeVeo.resetCounts();
    fakeVeo.setMode("quota_then_success");
    const res = await requestVideo(custA.cookie, await uploadPhoto(custA.cookie));
    const id = res.json().video.id;
    await db.videoGenerationJob.update({ where: { id }, data: { nextAttemptAt: null } });
    await runVideoWorkerTick();
    const waiting = await db.videoGenerationJob.findUniqueOrThrow({ where: { id } });
    expect(waiting.status).toBe("QUEUED");
    expect(waiting.statusMessage).toMatch(/retrying/i);
    const job = await drive(id);
    expect(job.status).toBe("COMPLETED");
    expect(job.submitAttempts).toBe(2);
  });

  it("refuses to start a video without enough credits, without creating a job", async () => {
    const balance = await balanceOf(custB.cookie);
    await app.inject({ method: "POST", url: `/api/video-creator/admin/customers/${custB.studentId}/credits`, headers: { cookie: ownerCookie }, payload: { amount: -balance, reason: "test: empty wallet" } });
    const before = await db.videoGenerationJob.count({ where: { studentId: custB.studentId } });
    const res = await requestVideo(custB.cookie, await uploadPhoto(custB.cookie));
    expect(res.statusCode).toBe(402);
    expect(res.json().code).toBe("INSUFFICIENT_CREDITS");
    expect(await db.videoGenerationJob.count({ where: { studentId: custB.studentId } })).toBe(before);
  });

  it("an admin cannot remove more credits than the customer has", async () => {
    const res = await app.inject({ method: "POST", url: `/api/video-creator/admin/customers/${custB.studentId}/credits`, headers: { cookie: ownerCookie }, payload: { amount: -5, reason: "too many" } });
    expect(res.statusCode).toBe(400);
  });

  it("concurrent requests can never overdraw the balance", async () => {
    await app.inject({ method: "POST", url: `/api/video-creator/admin/customers/${custB.studentId}/credits`, headers: { cookie: ownerCookie }, payload: { amount: 2, reason: "test: two credits" } });
    const settings = await app.inject({ method: "GET", url: "/api/video-creator/admin/settings", headers: { cookie: ownerCookie } });
    const s = settings.json().settings;
    await app.inject({ method: "PUT", url: "/api/video-creator/admin/settings", headers: { cookie: ownerCookie }, payload: { ...s, maxActiveJobsPerUser: 20 } });
    const photoId = await uploadPhoto(custB.cookie);
    const results = await Promise.all(Array.from({ length: 6 }, () => requestVideo(custB.cookie, photoId)));
    const created = results.filter((r) => r.statusCode === 201).length;
    expect(created).toBe(2);
    expect(results.filter((r) => r.statusCode === 402).length).toBe(4);
    expect(await balanceOf(custB.cookie)).toBe(0);
  });

  it("a suspended customer cannot generate", async () => {
    await app.inject({ method: "POST", url: `/api/video-creator/admin/customers/${custA.studentId}/suspend`, headers: { cookie: ownerCookie } });
    const res = await app.inject({ method: "POST", url: "/api/video-creator/photos", headers: { cookie: custA.cookie }, payload: { filename: "x.png", contentBase64: photoPng } });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe("ACCESS_INACTIVE");
    await app.inject({ method: "POST", url: `/api/video-creator/admin/customers/${custA.studentId}/activate`, headers: { cookie: ownerCookie } });
  });

  it("admin settings changes (e.g. credit cost) apply immediately and are audited", async () => {
    const s = (await app.inject({ method: "GET", url: "/api/video-creator/admin/settings", headers: { cookie: ownerCookie } })).json().settings;
    const put = await app.inject({ method: "PUT", url: "/api/video-creator/admin/settings", headers: { cookie: ownerCookie }, payload: { ...s, creditsPerVideo: 2, extraCreditsFor1080p: 1 } });
    expect(put.statusCode).toBe(200);
    const me = (await app.inject({ method: "GET", url: "/api/video-creator/me", headers: { cookie: custA.cookie } })).json();
    expect(me.options.creditCost).toEqual({ "720p": 2, "1080p": 3 });
    const audit = (await app.inject({ method: "GET", url: "/api/video-creator/admin/audit", headers: { cookie: ownerCookie } })).json();
    expect(audit.entries.some((e: { action: string }) => e.action === "Video Creator Settings Changed")).toBe(true);
  });

  it("the admin overview reports real usage and estimated cost", async () => {
    const o = (await app.inject({ method: "GET", url: "/api/video-creator/admin/overview", headers: { cookie: ownerCookie } })).json();
    expect(o.jobs.completed).toBeGreaterThanOrEqual(2);
    expect(o.jobs.failed).toBeGreaterThanOrEqual(7);
    expect(o.customers.active).toBe(2);
    expect(o.usage.secondsGeneratedAllTime).toBeGreaterThan(0);
  });
});
