// Phase 7 security hardening (spec sections 34-37): a consolidated IDOR
// regression sweep across every cross-student surface that takes a bare
// resource ID (rather than a /api/students/:studentId/... path already
// covered by rbac-isolation.test.ts and the per-phase test files). Also
// verifies the new security-header middleware and the anonymous-denial
// baseline across a representative sample of protected modules.

import { beforeAll, afterAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { db } from "../src/db.js";
import { resetDb, loginAs, DEV_USERS } from "./helpers.js";
import { createFakeAnthropicServer } from "./anthropic-fake-server.js";

let app: FastifyInstance;
let ownerCookie: string;
let studentACookie: string;
let studentBCookie: string;
let studentAId: string;
const fakeAnthropic = createFakeAnthropicServer(4011);

beforeAll(async () => {
  await fakeAnthropic.start();
  await resetDb();
  app = await buildApp();
  ownerCookie = await loginAs(app, DEV_USERS.owner.email, DEV_USERS.owner.password);
  studentACookie = await loginAs(app, DEV_USERS.studentA.email, DEV_USERS.studentA.password);
  studentBCookie = await loginAs(app, DEV_USERS.studentB.email, DEV_USERS.studentB.password);
  studentAId = (await db.student.findUniqueOrThrow({ where: { studentDisplayId: "MAIA-B14-DEV-A" } })).id;
});

afterAll(async () => {
  await app.close();
  await db.$disconnect();
  await fakeAnthropic.stop();
});

describe("Security headers (spec section 34)", () => {
  it("applies helmet security headers to every response, including an unauthenticated one", async () => {
    const res = await app.inject({ method: "GET", url: "/api/health" });
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBeDefined();
    expect(res.headers["content-security-policy"]).toContain("default-src 'none'");
  });
});

describe("Anonymous denial baseline", () => {
  const protectedRoutes: Array<{ method: "GET" | "POST"; url: string }> = [
    { method: "GET", url: "/api/students" },
    { method: "GET", url: "/api/migrations" },
    { method: "GET", url: "/api/master-brain/submissions" },
    { method: "GET", url: "/api/courses/nonexistent-id" },
    { method: "GET", url: `/api/students/${"x"}/ai-tools` },
  ];

  for (const route of protectedRoutes) {
    it(`${route.method} ${route.url} rejects an unauthenticated caller`, async () => {
      const res = await app.inject({ method: route.method, url: route.url });
      expect(res.statusCode).toBe(401);
    });
  }
});

describe("IDOR: AI generation retry/handoff/project-generations by bare ID (spec sections 34, 78)", () => {
  async function createPublishedBusiness(cookie: string, studentId: string, name: string) {
    const businessRes = await app.inject({ method: "POST", url: `/api/students/${studentId}/businesses`, headers: { cookie }, payload: { name } });
    const business = businessRes.json().business;
    await app.inject({ method: "PATCH", url: `/api/businesses/${business.id}/master-brain`, headers: { cookie }, payload: { answers: { x: 1 } } });
    const submission = (await app.inject({ method: "GET", url: `/api/businesses/${business.id}/master-brain`, headers: { cookie } })).json().submission;
    await db.masterBrainSubmission.update({ where: { id: submission.id }, data: { status: "APPROVED_FOR_GENERATION" } });

    fakeAnthropic.setMode("success");
    fakeAnthropic.setResponseText(JSON.stringify({ sections: [{ key: "brandOverview", title: "1. Brand Overview", content: "Synthetic", bullets: [] }] }));
    const document = (await app.inject({ method: "POST", url: `/api/master-brain/submissions/${submission.id}/generate`, headers: { cookie: ownerCookie } })).json().document;
    await app.inject({ method: "POST", url: `/api/master-brain/documents/${document.id}/publish`, headers: { cookie: ownerCookie } });
    return business;
  }

  it("Student B cannot retry Student A's generation, cannot list Student A's project generations, and cannot hand it off", async () => {
    const business = await createPublishedBusiness(studentACookie, studentAId, "IDOR Retry Business");
    fakeAnthropic.setMode("success");
    fakeAnthropic.setResponseText("Synthetic ad copy for the IDOR test.");

    const projectRes = await app.inject({ method: "POST", url: `/api/students/${studentAId}/ai-projects`, headers: { cookie: studentACookie }, payload: { businessId: business.id, name: "IDOR Project", type: "Marketing" } });
    const project = projectRes.json().project;

    const generateRes = await app.inject({
      method: "POST",
      url: `/api/students/${studentAId}/ai-tools/copywriter/generate`,
      headers: { cookie: studentACookie },
      payload: { businessId: business.id, projectId: project.id, userRequest: "Write a short ad." },
    });
    expect(generateRes.statusCode).toBe(201);
    const generation = generateRes.json().generation;

    const retry = await app.inject({ method: "POST", url: `/api/ai-generations/${generation.id}/retry`, headers: { cookie: studentBCookie } });
    expect(retry.statusCode).toBe(403);

    const projectGenerations = await app.inject({ method: "GET", url: `/api/ai-projects/${project.id}/generations`, headers: { cookie: studentBCookie } });
    expect(projectGenerations.statusCode).toBe(403);

    const handoff = await app.inject({
      method: "POST",
      url: `/api/ai-generations/${generation.id}/handoff`,
      headers: { cookie: studentBCookie },
      payload: { destinationToolKey: "copywriter", selectedSections: ["Synthetic ad copy for the IDOR test."], userInstructions: "test" },
    });
    expect(handoff.statusCode).toBe(403);

    // Sanity: Student A (the real owner) CAN retrieve their own project's generations.
    const ownProjectGenerations = await app.inject({ method: "GET", url: `/api/ai-projects/${project.id}/generations`, headers: { cookie: studentACookie } });
    expect(ownProjectGenerations.statusCode).toBe(200);
  });

  it("a nonexistent generation/project ID returns 404, never a 500 or a data leak", async () => {
    const retry = await app.inject({ method: "POST", url: "/api/ai-generations/does-not-exist/retry", headers: { cookie: studentACookie } });
    expect(retry.statusCode).toBe(404);

    const projectGenerations = await app.inject({ method: "GET", url: "/api/ai-projects/does-not-exist/generations", headers: { cookie: studentACookie } });
    expect(projectGenerations.statusCode).toBe(404);
  });
});

describe("IDOR: Master Brain business access by bare businessId (spec sections 11-14)", () => {
  it("Student B cannot read, edit, or submit Student A's business questionnaire", async () => {
    const businessRes = await app.inject({ method: "POST", url: `/api/students/${studentAId}/businesses`, headers: { cookie: studentACookie }, payload: { name: "IDOR MB Business" } });
    const business = businessRes.json().business;

    const read = await app.inject({ method: "GET", url: `/api/businesses/${business.id}/master-brain`, headers: { cookie: studentBCookie } });
    expect(read.statusCode).toBe(403);

    const edit = await app.inject({ method: "PATCH", url: `/api/businesses/${business.id}/master-brain`, headers: { cookie: studentBCookie }, payload: { answers: { hijacked: true } } });
    expect(edit.statusCode).toBe(403);

    const submit = await app.inject({ method: "POST", url: `/api/businesses/${business.id}/master-brain/submit`, headers: { cookie: studentBCookie } });
    expect(submit.statusCode).toBe(403);
  });
});

describe("File security: expired/forged signed URLs (spec section 19)", () => {
  it("a download with no token, a garbage token, and a well-formed-but-unsigned token are all rejected", async () => {
    const noToken = await app.inject({ method: "GET", url: "/api/documents/download" });
    expect(noToken.statusCode).toBe(400);

    const garbage = await app.inject({ method: "GET", url: "/api/documents/download?token=garbage" });
    expect(garbage.statusCode).toBe(403);

    const fakeJwtShaped = await app.inject({ method: "GET", url: `/api/documents/download?token=${Buffer.from(JSON.stringify({ documentId: "forged" })).toString("base64")}.fake-signature` });
    expect(fakeJwtShaped.statusCode).toBe(403);
  });
});

describe("Rate limiting: document upload (spec section 36 — previously ungated)", () => {
  it("the 21st upload within a minute is rejected", async () => {
    const isolatedApp = await buildApp();
    const cookie = await loginAs(isolatedApp, DEV_USERS.studentA.email, DEV_USERS.studentA.password);
    let lastStatus = 0;
    for (let i = 0; i < 21; i++) {
      const res = await isolatedApp.inject({
        method: "POST",
        url: `/api/students/${studentAId}/documents`,
        headers: { cookie },
        payload: { documentType: "ValidId", filename: `rl-${i}.jpg`, mimeType: "image/jpeg", contentBase64: Buffer.from(`rl-${i}`).toString("base64") },
      });
      lastStatus = res.statusCode;
    }
    expect(lastStatus).toBe(429);
    await isolatedApp.close();
  });
});
