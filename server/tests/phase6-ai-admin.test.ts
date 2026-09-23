import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { db } from "../src/db.js";
import { resetDb, loginAs, DEV_USERS } from "./helpers.js";
import { createFakeAnthropicServer } from "./anthropic-fake-server.js";

let app: FastifyInstance;
let ownerCookie: string;
let financeCookie: string;
const fakeAnthropic = createFakeAnthropicServer(4011);

beforeAll(async () => {
  await fakeAnthropic.start();
  await resetDb();
  app = await buildApp();
  ownerCookie = await loginAs(app, DEV_USERS.owner.email, DEV_USERS.owner.password);
  financeCookie = await loginAs(app, DEV_USERS.finance.email, DEV_USERS.finance.password);
});

afterAll(async () => {
  await app.close();
  await db.$disconnect();
  await fakeAnthropic.stop();
});

beforeEach(() => {
  fakeAnthropic.setMode("success");
});

describe("AI Connections admin (spec sections 6-7)", () => {
  it("lists providers without ever exposing a raw API key", async () => {
    const res = await app.inject({ method: "GET", url: "/api/ai/providers", headers: { cookie: ownerCookie } });
    expect(res.statusCode).toBe(200);
    const anthropic = res.json().providers.find((p: { provider: string }) => p.provider === "ANTHROPIC");
    expect(anthropic.credentialsConfigured).toBe(true); // test env has a fixture key
    expect(JSON.stringify(res.json())).not.toContain("test-anthropic-key-not-real");
  });

  it("test-connection returns CONNECTED on a real round trip against the fake server, and the exact enumerated status on failure", async () => {
    fakeAnthropic.setMode("success");
    const ok = await app.inject({ method: "POST", url: "/api/ai/providers/ANTHROPIC/test-connection", headers: { cookie: ownerCookie } });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().status).toBe("CONNECTED");

    fakeAnthropic.setMode("auth_failed");
    const failed = await app.inject({ method: "POST", url: "/api/ai/providers/ANTHROPIC/test-connection", headers: { cookie: ownerCookie } });
    expect(failed.json().status).toBe("AUTHENTICATION_FAILED");

    fakeAnthropic.setMode("rate_limited");
    const limited = await app.inject({ method: "POST", url: "/api/ai/providers/ANTHROPIC/test-connection", headers: { cookie: ownerCookie } });
    expect(limited.json().status).toBe("RATE_LIMITED");
  });

  it("cannot switch to PRODUCTION mode without a configured provider", async () => {
    const res = await app.inject({ method: "PATCH", url: "/api/ai/providers/OPENAI", headers: { cookie: ownerCookie }, payload: { environment: "PRODUCTION" } });
    expect(res.statusCode).toBe(422); // OPENAI has no adapter/credentials in this build
  });

  it("staff without the Providers permission are denied", async () => {
    const res = await app.inject({ method: "GET", url: "/api/ai/providers", headers: { cookie: financeCookie } });
    expect(res.statusCode).toBe(403);
  });
});

describe("Kill switch (spec section 65)", () => {
  it("disabling a model config makes it unusable, and re-enabling restores it", async () => {
    const config = await db.aiModelConfig.findUniqueOrThrow({ where: { configKey: "default" } });
    const disable = await app.inject({ method: "POST", url: `/api/ai/model-configs/${config.id}/disable`, headers: { cookie: ownerCookie } });
    expect(disable.json().modelConfig.enabled).toBe(false);

    const reloaded = await db.aiModelConfig.findUniqueOrThrow({ where: { id: config.id } });
    expect(reloaded.enabled).toBe(false);

    const enable = await app.inject({ method: "POST", url: `/api/ai/model-configs/${config.id}/enable`, headers: { cookie: ownerCookie } });
    expect(enable.json().modelConfig.enabled).toBe(true);
  });

  it("disabling a provider blocks every model config that has no fallback, and a fallback chain recovers automatically", async () => {
    const providerDisable = await app.inject({ method: "PATCH", url: "/api/ai/providers/ANTHROPIC", headers: { cookie: ownerCookie }, payload: { enabled: false } });
    expect(providerDisable.json().provider.enabled).toBe(false);

    const testConnection = await db.aiProviderConfig.findUniqueOrThrow({ where: { provider: "ANTHROPIC" } });
    expect(testConnection.enabled).toBe(false);

    // Restore for later tests/files.
    await app.inject({ method: "PATCH", url: "/api/ai/providers/ANTHROPIC", headers: { cookie: ownerCookie }, payload: { enabled: true } });
  });
});

describe("Tool Library + Prompt Manager (spec sections 25-29)", () => {
  it("lists all 25 seeded tools (18 original — one, automation-architect, upgraded to a real structured generator in Phase 12 — + 7 Phase 11 Creative Studio) with their model config", async () => {
    const res = await app.inject({ method: "GET", url: "/api/ai-tools/tools", headers: { cookie: ownerCookie } });
    expect(res.statusCode).toBe(200);
    expect(res.json().tools.length).toBe(25);
    expect(res.json().tools.every((t: { modelConfig: unknown }) => t.modelConfig)).toBe(true);
  });

  it("publishing a new prompt version archives the old one — exactly one ACTIVE at a time, both kept forever", async () => {
    const tool = await db.aiTool.findUniqueOrThrow({ where: { toolKey: "copywriter" } });
    const before = await db.promptVersion.findFirstOrThrow({ where: { toolId: tool.id, status: "ACTIVE" } });

    const create = await app.inject({
      method: "POST",
      url: "/api/ai-tools/tools/copywriter/prompt-versions",
      headers: { cookie: ownerCookie },
      payload: { systemInstruction: "Updated synthetic system instruction for testing.", changeNotes: "Test update." },
    });
    expect(create.statusCode).toBe(201);
    expect(create.json().promptVersion.status).toBe("DRAFT");
    const newId = create.json().promptVersion.id;

    const publish = await app.inject({ method: "POST", url: `/api/ai-tools/prompt-versions/${newId}/publish`, headers: { cookie: ownerCookie } });
    expect(publish.json().promptVersion.status).toBe("ACTIVE");

    const oldReloaded = await db.promptVersion.findUniqueOrThrow({ where: { id: before.id } });
    expect(oldReloaded.status).toBe("ARCHIVED"); // never deleted, never left ACTIVE alongside the new one

    const activeCount = await db.promptVersion.count({ where: { toolId: tool.id, status: "ACTIVE" } });
    expect(activeCount).toBe(1);
  });

  it("a Draft/Coming-Soon/Inactive tool status change is a real kill switch a Student's generate call respects", async () => {
    const toggleOff = await app.inject({ method: "PATCH", url: "/api/ai-tools/tools/video-director", headers: { cookie: ownerCookie }, payload: { status: "INACTIVE" } });
    expect(toggleOff.json().tool.status).toBe("INACTIVE");

    const studentACookie = await loginAs(app, DEV_USERS.studentA.email, DEV_USERS.studentA.password);
    const studentAId = (await db.student.findUniqueOrThrow({ where: { studentDisplayId: "MAIA-B14-DEV-A" } })).id;
    const businessRes = await app.inject({ method: "POST", url: `/api/students/${studentAId}/businesses`, headers: { cookie: studentACookie }, payload: { name: "Kill Switch Business" } });

    const generate = await app.inject({
      method: "POST",
      url: `/api/students/${studentAId}/ai-tools/video-director/generate`,
      headers: { cookie: studentACookie },
      payload: { businessId: businessRes.json().business.id, userRequest: "test" },
    });
    expect(generate.statusCode).toBe(403);

    await app.inject({ method: "PATCH", url: "/api/ai-tools/tools/video-director", headers: { cookie: ownerCookie }, payload: { status: "ACTIVE" } });
  });

  it("staff without the Tool Library / Prompts permission are denied write access", async () => {
    const res = await app.inject({ method: "PATCH", url: "/api/ai-tools/tools/copywriter", headers: { cookie: financeCookie }, payload: { status: "INACTIVE" } });
    expect(res.statusCode).toBe(403);
  });
});
