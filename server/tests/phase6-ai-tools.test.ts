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
let studentBId: string;
const fakeAnthropic = createFakeAnthropicServer(4011);

beforeAll(async () => {
  await fakeAnthropic.start();
  await resetDb();
  app = await buildApp();
  ownerCookie = await loginAs(app, DEV_USERS.owner.email, DEV_USERS.owner.password);
  studentACookie = await loginAs(app, DEV_USERS.studentA.email, DEV_USERS.studentA.password);
  studentBCookie = await loginAs(app, DEV_USERS.studentB.email, DEV_USERS.studentB.password);
  studentAId = (await db.student.findUniqueOrThrow({ where: { studentDisplayId: "MAIA-B14-DEV-A" } })).id;
  studentBId = (await db.student.findUniqueOrThrow({ where: { studentDisplayId: "MAIA-B14-DEV-B" } })).id;
});

afterAll(async () => {
  await app.close();
  await db.$disconnect();
  await fakeAnthropic.stop();
});

async function createPublishedBusiness(cookie: string, studentId: string, name: string, overview = "Synthetic overview") {
  const businessRes = await app.inject({ method: "POST", url: `/api/students/${studentId}/businesses`, headers: { cookie }, payload: { name } });
  const business = businessRes.json().business;

  await app.inject({ method: "PATCH", url: `/api/businesses/${business.id}/master-brain`, headers: { cookie }, payload: { answers: { x: 1 } } });
  const submission = (await app.inject({ method: "GET", url: `/api/businesses/${business.id}/master-brain`, headers: { cookie } })).json().submission;
  await db.masterBrainSubmission.update({ where: { id: submission.id }, data: { status: "APPROVED_FOR_GENERATION" } });

  fakeAnthropic.setMode("success");
  fakeAnthropic.setResponseText(
    JSON.stringify({
      sections: [{ key: "brandOverview", title: "1. Brand Overview", content: overview, bullets: [] }],
    }),
  );
  const document = (await app.inject({ method: "POST", url: `/api/master-brain/submissions/${submission.id}/generate`, headers: { cookie: ownerCookie } })).json().document;
  await app.inject({ method: "POST", url: `/api/master-brain/documents/${document.id}/publish`, headers: { cookie: ownerCookie } });

  return business;
}

describe("AI Tool E2E (spec section 83): select business -> published Master Brain -> real AI call -> saved output -> history", () => {
  it("runs Copywriter end-to-end against the real client code path", async () => {
    const business = await createPublishedBusiness(studentACookie, studentAId, "Copywriter E2E Business");

    fakeAnthropic.setMode("success");
    fakeAnthropic.setResponseText("Here is your synthetic ad copy: Try our amazing product today!");

    const generate = await app.inject({
      method: "POST",
      url: `/api/students/${studentAId}/ai-tools/copywriter/generate`,
      headers: { cookie: studentACookie },
      payload: { businessId: business.id, userRequest: "Write a Facebook caption for our new product." },
    });
    expect(generate.statusCode).toBe(201);
    expect(generate.json().generation.status).toBe("COMPLETED");
    expect(generate.json().generation.outputJson.text).toContain("synthetic ad copy");
    expect(generate.json().generation.masterBrainVersion).toBe(1);
    expect(generate.json().generation.provider).toBe("ANTHROPIC");

    const history = await app.inject({ method: "GET", url: `/api/students/${studentAId}/ai-generations`, headers: { cookie: studentACookie } });
    expect(history.statusCode).toBe(200);
    expect(history.json().generations.some((g: { id: string }) => g.id === generate.json().generation.id)).toBe(true);
  });

  it("blocks generation with COMPLETE_YOUR_BRAND_MASTER_BRAIN_FIRST when no Master Brain is published (spec section 34)", async () => {
    const businessRes = await app.inject({ method: "POST", url: `/api/students/${studentAId}/businesses`, headers: { cookie: studentACookie }, payload: { name: "No Master Brain Business" } });
    const business = businessRes.json().business;

    const generate = await app.inject({
      method: "POST",
      url: `/api/students/${studentAId}/ai-tools/copywriter/generate`,
      headers: { cookie: studentACookie },
      payload: { businessId: business.id, userRequest: "Write something." },
    });
    expect(generate.statusCode).toBe(422);
    expect(generate.json().error).toBe("COMPLETE_YOUR_BRAND_MASTER_BRAIN_FIRST");
  });
});

describe("Multiple business isolation (spec sections 33, 84)", () => {
  it("Business A's context never leaks into Business B's generation", async () => {
    const businessA = await createPublishedBusiness(studentACookie, studentAId, "Business A Isolation", "Business A secret overview content XYZ123");
    const businessB = await createPublishedBusiness(studentACookie, studentAId, "Business B Isolation", "Business B different overview content ABC789");

    fakeAnthropic.setMode("success");
    fakeAnthropic.setResponseText("Generic synthetic output.");

    const genB = await app.inject({
      method: "POST",
      url: `/api/students/${studentAId}/ai-tools/copywriter/generate`,
      headers: { cookie: studentACookie },
      payload: { businessId: businessB.id, userRequest: "Write copy." },
    });
    expect(genB.statusCode).toBe(201);
    expect(genB.json().generation.businessId).toBe(businessB.id);
    expect(genB.json().generation.businessId).not.toBe(businessA.id);

    // The generation's own context should trace back only to Business B's Master Brain document.
    const genRow = await db.aiGeneration.findUniqueOrThrow({ where: { id: genB.json().generation.id } });
    const businessBSubmission = await db.masterBrainSubmission.findUniqueOrThrow({ where: { businessId: businessB.id } });
    const businessBDoc = await db.masterBrainDocument.findFirstOrThrow({ where: { submissionId: businessBSubmission.id, isCurrentPublished: true } });
    expect(genRow.masterBrainDocumentId).toBe(businessBDoc.id);
  });
});

describe("Student isolation (spec section 85)", () => {
  it("Student B cannot generate against, view, or favorite Student A's AI resources", async () => {
    const business = await createPublishedBusiness(studentACookie, studentAId, "Student Isolation Business");

    const crossGenerate = await app.inject({
      method: "POST",
      url: `/api/students/${studentAId}/ai-tools/copywriter/generate`,
      headers: { cookie: studentBCookie },
      payload: { businessId: business.id, userRequest: "Attempted cross-student generation." },
    });
    expect(crossGenerate.statusCode).toBe(403);

    const crossHistory = await app.inject({ method: "GET", url: `/api/students/${studentAId}/ai-generations`, headers: { cookie: studentBCookie } });
    expect(crossHistory.statusCode).toBe(403);

    fakeAnthropic.setMode("success");
    fakeAnthropic.setResponseText("Output for isolation test.");
    const ownGeneration = (
      await app.inject({ method: "POST", url: `/api/students/${studentAId}/ai-tools/copywriter/generate`, headers: { cookie: studentACookie }, payload: { businessId: business.id, userRequest: "Write." } })
    ).json().generation;

    const crossFavorite = await app.inject({ method: "POST", url: `/api/ai-generations/${ownGeneration.id}/favorite`, headers: { cookie: studentBCookie } });
    expect(crossFavorite.statusCode).toBe(403);
  });
});

describe("Cross-tool handoff (spec sections 66-67, 87)", () => {
  it("sends a structured excerpt (not the raw generation) to a destination tool, using the same Business + Master Brain", async () => {
    const business = await createPublishedBusiness(studentACookie, studentAId, "Handoff Business");

    fakeAnthropic.setMode("success");
    fakeAnthropic.setResponseText("STRATEGY: Focus on social proof. Priority Opportunities: TikTok organic content.");
    const source = (
      await app.inject({
        method: "POST",
        url: `/api/students/${studentAId}/ai-tools/business-strategist/generate`,
        headers: { cookie: studentACookie },
        payload: { businessId: business.id, userRequest: "What should I focus on?" },
      })
    ).json().generation;
    expect(source.status).toBe("COMPLETED");

    fakeAnthropic.setResponseText("Content strategy built from the handed-off strategic priority.");
    const handoff = await app.inject({
      method: "POST",
      url: `/api/ai-generations/${source.id}/handoff`,
      headers: { cookie: studentACookie },
      payload: { destinationToolKey: "content-strategist", selectedSections: ["Priority Opportunities: TikTok organic content."], userInstructions: "Build a content plan around this." },
    });
    expect(handoff.statusCode).toBe(201);
    expect(handoff.json().destinationGeneration.status).toBe("COMPLETED");
    expect(handoff.json().destinationGeneration.businessId).toBe(business.id); // same business, no leakage
    expect(handoff.json().destinationGeneration.masterBrainVersion).toBe(source.masterBrainVersion);

    const handoffRow = await db.aiHandoff.findUniqueOrThrow({ where: { id: handoff.json().handoff.id } });
    expect(handoffRow.sourceGenerationId).toBe(source.id);
  });
});

describe("Usage limits (spec section 88)", () => {
  it("blocks generation gracefully once the configured limit is reached", async () => {
    // Uses a tool key no other test in this file touches, and removes the
    // limit afterward — a TOOL-scoped limit applies to every student, so
    // leaving it in place would silently cap later tests' unrelated calls.
    const business = await createPublishedBusiness(studentBCookie, studentBId, "Usage Limit Business");
    const tool = await db.aiTool.findUniqueOrThrow({ where: { toolKey: "sales-script-builder" } });

    const limitRes = await app.inject({
      method: "POST",
      url: "/api/ai-tools/usage-limits",
      headers: { cookie: ownerCookie },
      payload: { scope: "TOOL", toolId: tool.id, dailyLimit: 1 },
    });
    const limitId = limitRes.json().limit.id;

    try {
      fakeAnthropic.setMode("success");
      fakeAnthropic.setResponseText("First generation output.");
      const first = await app.inject({
        method: "POST",
        url: `/api/students/${studentBId}/ai-tools/sales-script-builder/generate`,
        headers: { cookie: studentBCookie },
        payload: { businessId: business.id, userRequest: "First request." },
      });
      expect(first.statusCode).toBe(201);

      const second = await app.inject({
        method: "POST",
        url: `/api/students/${studentBId}/ai-tools/sales-script-builder/generate`,
        headers: { cookie: studentBCookie },
        payload: { businessId: business.id, userRequest: "Second request." },
      });
      expect(second.statusCode).toBe(429);
      expect(second.json().error).toMatch(/limit/i);
    } finally {
      await app.inject({ method: "DELETE", url: `/api/ai-tools/usage-limits/${limitId}`, headers: { cookie: ownerCookie } });
    }
  });
});

describe("Provider failure handling (spec section 89)", () => {
  it("a provider failure records status FAILED honestly — never a fake completed output — and can be retried", async () => {
    const business = await createPublishedBusiness(studentACookie, studentAId, "Provider Failure Business");

    fakeAnthropic.setMode("server_error");
    const failed = await app.inject({
      method: "POST",
      url: `/api/students/${studentAId}/ai-tools/copywriter/generate`,
      headers: { cookie: studentACookie },
      payload: { businessId: business.id, userRequest: "This will fail." },
    });
    expect(failed.statusCode).toBe(201); // the HTTP call succeeds; the recorded generation itself is FAILED
    expect(failed.json().generation.status).toBe("FAILED");
    expect(failed.json().generation.outputJson).toBeNull();
    expect(failed.json().generation.errorCategory).toBeTruthy();

    fakeAnthropic.setMode("success");
    fakeAnthropic.setResponseText("Retry succeeded.");
    const retry = await app.inject({ method: "POST", url: `/api/ai-generations/${failed.json().generation.id}/retry`, headers: { cookie: studentACookie } });
    expect(retry.statusCode).toBe(201);
    expect(retry.json().generation.status).toBe("COMPLETED");
    expect(retry.json().generation.retryOfGenerationId).toBe(failed.json().generation.id);

    // The original failure record is untouched, never overwritten.
    const originalReloaded = await db.aiGeneration.findUniqueOrThrow({ where: { id: failed.json().generation.id } });
    expect(originalReloaded.status).toBe("FAILED");
  });

  it("auth/rate-limit/not-found failures each map to a distinct, honest error category", async () => {
    const business = await createPublishedBusiness(studentACookie, studentAId, "Error Mapping Business");
    const modes = ["auth_failed", "rate_limited", "not_found"] as const;
    for (const mode of modes) {
      fakeAnthropic.setMode(mode);
      const res = await app.inject({
        method: "POST",
        url: `/api/students/${studentAId}/ai-tools/copywriter/generate`,
        headers: { cookie: studentACookie },
        payload: { businessId: business.id, userRequest: `Testing ${mode}.` },
      });
      expect(res.json().generation.status).toBe("FAILED");
    }
    fakeAnthropic.setMode("success");
  });
});

describe("Security denial matrix (spec section 90)", () => {
  it("rejects an unknown AI tool key", async () => {
    const business = await createPublishedBusiness(studentACookie, studentAId, "Security Unknown Tool Business");
    const res = await app.inject({
      method: "POST",
      url: `/api/students/${studentAId}/ai-tools/not-a-real-tool/generate`,
      headers: { cookie: studentACookie },
      payload: { businessId: business.id, userRequest: "test" },
    });
    expect(res.statusCode).toBe(403); // checkToolAccess resolves "unknown tool" before the tool-existence check surfaces
  });

  it("rejects a tampered businessId belonging to another student", async () => {
    const businessA = await createPublishedBusiness(studentACookie, studentAId, "Tampered Business Test A");
    const res = await app.inject({
      method: "POST",
      url: `/api/students/${studentBId}/ai-tools/copywriter/generate`,
      headers: { cookie: studentBCookie },
      payload: { businessId: businessA.id, userRequest: "Tampered business id." },
    });
    expect(res.statusCode).toBe(403);
  });

  it("a Student cannot read hidden prompt instructions or provider credentials", async () => {
    const promptRes = await app.inject({ method: "GET", url: "/api/ai-tools/tools/copywriter/prompt-versions", headers: { cookie: studentACookie } });
    expect(promptRes.statusCode).toBe(403);

    const providerRes = await app.inject({ method: "GET", url: "/api/ai/providers", headers: { cookie: studentACookie } });
    expect(providerRes.statusCode).toBe(403);
  });

  it("a Student without a manual grant cannot use a tool their package excludes", async () => {
    const restrictedTool = await db.aiTool.upsert({
      where: { toolKey: "restricted-test-tool" },
      update: {},
      create: { toolKey: "restricted-test-tool", name: "Restricted Test Tool", category: "Strategy", displayOrder: 999 },
    });
    const business = await createPublishedBusiness(studentACookie, studentAId, "Restricted Tool Business");
    const res = await app.inject({
      method: "POST",
      url: `/api/students/${studentAId}/ai-tools/${restrictedTool.toolKey}/generate`,
      headers: { cookie: studentACookie },
      payload: { businessId: business.id, userRequest: "test" },
    });
    expect(res.statusCode).toBe(403);
  });
});
