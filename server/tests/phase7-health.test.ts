import { beforeAll, afterAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { db } from "../src/db.js";
import { resetDb } from "./helpers.js";

let app: FastifyInstance;

beforeAll(async () => {
  await resetDb();
  app = await buildApp();
});

afterAll(async () => {
  await app.close();
  await db.$disconnect();
});

describe("Deep health check (spec section 40)", () => {
  it("is reachable without authentication and reports real, non-fabricated sub-check status", async () => {
    const res = await app.inject({ method: "GET", url: "/api/health" });
    expect(res.statusCode).toBe(200);
    const body = res.json();

    expect(body.status).toBe("ok");
    expect(body.checks.database.status).toBe("ok");
    // Dev/test always run STORAGE_DRIVER=local, so this must honestly report
    // "not_production_ready" rather than a blanket "ok" (spec section 4: no
    // silent demo fallback dressed up as a healthy check).
    expect(body.checks.storage.status).toBe("not_production_ready");
    expect(body.checks.storage.driver).toBe("local");
    // .env.test sets a fixture GHL credential (matching the existing Phase 5
    // fixture pattern) but no real GHL server has ever confirmed a
    // connection, so the honest status is "configured" + "not yet
    // connected" — never a blanket "connected" it never verified.
    expect(body.checks.ghl.status).toBe("configured_but_disconnected");
    expect(Array.isArray(body.checks.ai.providers)).toBe(true);
    const anthropic = body.checks.ai.providers.find((p: { provider: string }) => p.provider === "ANTHROPIC");
    expect(anthropic).toBeDefined();

    // Never leaks a secret value anywhere in the response.
    expect(JSON.stringify(body)).not.toMatch(/sk-ant|Bearer |api[_-]?key.*[:=].{10,}/i);
  });
});
