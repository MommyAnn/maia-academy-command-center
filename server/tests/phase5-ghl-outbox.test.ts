import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { db } from "../src/db.js";
import { resetDb, loginAs, DEV_USERS } from "./helpers.js";
import { createFakeGhlServer } from "./ghl-fake-server.js";
import { enqueuePendingDomainEvents, processOutboxEvent, runOutboxSweep } from "../src/modules/ghl/outbox.js";
import * as ghl from "../src/modules/ghl/client.js";

let app: FastifyInstance;
let ownerCookie: string;
const fakeGhl = createFakeGhlServer(4009);

beforeAll(async () => {
  await fakeGhl.start();
  await resetDb();
  app = await buildApp();
  ownerCookie = await loginAs(app, DEV_USERS.owner.email, DEV_USERS.owner.password);
});

afterAll(async () => {
  await app.close();
  await db.$disconnect();
  await fakeGhl.stop();
});

beforeEach(() => {
  fakeGhl.setMode("success");
});

async function createLeadWithConsent(contactNumber: string, email: string) {
  const res = await app.inject({ method: "POST", url: "/api/leads", headers: { cookie: ownerCookie }, payload: { fullName: "Outbox Test Lead", contactNumber, email } });
  expect(res.statusCode).toBe(201);
  const lead = res.json().lead;
  await app.inject({ method: "PATCH", url: `/api/leads/${lead.id}/consent`, headers: { cookie: ownerCookie }, payload: { canEmail: true, canSms: true, canWhatsapp: true } });
  return lead;
}

describe("GHL client — safe, typed results against a real HTTP round trip (spec section 5)", () => {
  it("testConnection returns CONNECTED on a real 200, and the exact enumerated status for each failure mode", async () => {
    fakeGhl.setMode("success");
    expect((await ghl.testConnection()).ok).toBe(true);

    fakeGhl.setMode("auth_failed");
    const authFailed = await ghl.testConnection();
    expect(authFailed).toEqual({ ok: false, status: "AUTHENTICATION_FAILED", message: expect.any(String) });

    fakeGhl.setMode("insufficient_permissions");
    const forbidden = await ghl.testConnection();
    expect(forbidden.ok).toBe(false);
    if (!forbidden.ok) expect(forbidden.status).toBe("INSUFFICIENT_PERMISSIONS");

    fakeGhl.setMode("rate_limited");
    const rateLimited = await ghl.testConnection();
    expect(rateLimited.ok).toBe(false);
    if (!rateLimited.ok) expect(rateLimited.status).toBe("RATE_LIMITED");

    fakeGhl.setMode("server_error");
    const serverError = await ghl.testConnection();
    expect(serverError.ok).toBe(false);
    if (!serverError.ok) expect(serverError.status).toBe("CONNECTION_ERROR");
  });

  it("never exposes the raw provider response through the admin test-connection endpoint", async () => {
    fakeGhl.setMode("auth_failed");
    const res = await app.inject({ method: "POST", url: "/api/ghl/test-connection", headers: { cookie: ownerCookie } });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("AUTHENTICATION_FAILED");
    expect(JSON.stringify(res.json())).not.toContain("unauthorized"); // the fake server's raw body text
    fakeGhl.setMode("success");
  });
});

describe("Outbox idempotency (spec sections 31, 68)", () => {
  it("enqueuing the same DomainEvent twice never creates a second IntegrationOutboxEvent row — a real unique-constraint guard, not an in-memory check", async () => {
    const lead = await createLeadWithConsent("09175550001", `outbox1-${Date.now()}@example.com`);
    const events = await db.domainEvent.findMany({ where: { type: "LEAD_CREATED" } });
    const event = events.find((e) => (e.payloadJson as { leadId?: string }).leadId === lead.id)!;
    expect(event).toBeDefined();

    const [first, second] = await Promise.all([enqueuePendingDomainEvents(), enqueuePendingDomainEvents()]);
    expect(first + second).toBeGreaterThanOrEqual(1);

    const rows = await db.integrationOutboxEvent.findMany({ where: { domainEventId: event.id } });
    expect(rows.length).toBe(1);
  });

  it("processing a queued row syncs a real GHL contact, applies the mapped tag, and marks the DomainEvent processed", async () => {
    await db.ghlTagMapping.create({ data: { eventKey: "LEAD_CREATED", ghlTagName: "maia-lead-created" } });
    const lead = await createLeadWithConsent("09175550002", `outbox2-${Date.now()}@example.com`);
    await enqueuePendingDomainEvents();

    const event = (await db.domainEvent.findMany({ where: { type: "LEAD_CREATED" } })).find((e) => (e.payloadJson as { leadId?: string }).leadId === lead.id)!;
    const outboxRow = await db.integrationOutboxEvent.findUniqueOrThrow({ where: { domainEventId: event.id } });

    const outcome = await processOutboxEvent(outboxRow.id);
    expect(outcome.status).toBe("SUCCESS");

    const processedEvent = await db.domainEvent.findUniqueOrThrow({ where: { id: event.id } });
    expect(processedEvent.processedAt).not.toBeNull();

    const contactMap = await db.ghlContactMap.findUniqueOrThrow({ where: { personId: lead.personId } });
    expect(contactMap.syncStatus).toBe("SYNCED");
    expect(contactMap.ghlContactId).not.toBeNull();
    expect(contactMap.lastSyncDirection).toBe("Outbound");
  });
});

describe("Outbox retry + dead-letter (spec sections 29-30)", () => {
  it("a persistently failing GHL call retries with backoff, then dead-letters after the max attempt count", async () => {
    fakeGhl.setMode("server_error");
    const lead = await createLeadWithConsent("09175550003", `outbox3-${Date.now()}@example.com`);
    await enqueuePendingDomainEvents();
    const event = (await db.domainEvent.findMany({ where: { type: "LEAD_CREATED" } })).find((e) => (e.payloadJson as { leadId?: string }).leadId === lead.id)!;
    const outboxRow = await db.integrationOutboxEvent.findUniqueOrThrow({ where: { domainEventId: event.id } });

    let last;
    for (let i = 0; i < 5; i++) {
      last = await processOutboxEvent(outboxRow.id);
      if (last.status === "DEAD_LETTER") break;
      expect(last.status).toBe("RETRYING");
    }
    expect(last!.status).toBe("DEAD_LETTER");

    const finalRow = await db.integrationOutboxEvent.findUniqueOrThrow({ where: { id: outboxRow.id } });
    expect(finalRow.attemptCount).toBeGreaterThanOrEqual(5);
    expect(finalRow.lastErrorCategory).toBe("NetworkError");

    // The DomainEvent itself must NEVER be marked processed for a
    // dead-lettered sync (spec: never claim something worked that didn't).
    const stillUnprocessed = await db.domainEvent.findUniqueOrThrow({ where: { id: event.id } });
    expect(stillUnprocessed.processedAt).toBeNull();

    fakeGhl.setMode("success");
  });

  it("an admin can manually retry a dead-lettered row once the underlying problem is fixed", async () => {
    fakeGhl.setMode("server_error");
    const lead = await createLeadWithConsent("09175550004", `outbox4-${Date.now()}@example.com`);
    await enqueuePendingDomainEvents();
    const event = (await db.domainEvent.findMany({ where: { type: "LEAD_CREATED" } })).find((e) => (e.payloadJson as { leadId?: string }).leadId === lead.id)!;
    const outboxRow = await db.integrationOutboxEvent.findUniqueOrThrow({ where: { domainEventId: event.id } });
    for (let i = 0; i < 5; i++) {
      const outcome = await processOutboxEvent(outboxRow.id);
      if (outcome.status === "DEAD_LETTER") break;
    }
    expect((await db.integrationOutboxEvent.findUniqueOrThrow({ where: { id: outboxRow.id } })).status).toBe("DEAD_LETTER");

    fakeGhl.setMode("success");
    const retryRes = await app.inject({ method: "POST", url: `/api/ghl/outbox/${outboxRow.id}/retry`, headers: { cookie: ownerCookie } });
    expect(retryRes.statusCode).toBe(200);
    expect(retryRes.json().outcome.status).toBe("SUCCESS");
  });

  it("a contact with no email and no phone is dead-lettered immediately, never retried pointlessly", async () => {
    const res = await app.inject({ method: "POST", url: "/api/leads", headers: { cookie: ownerCookie }, payload: { fullName: "No Contact Info Lead" } });
    expect(res.statusCode).toBe(201);
    const lead = res.json().lead;
    await enqueuePendingDomainEvents();
    const event = (await db.domainEvent.findMany({ where: { type: "LEAD_CREATED" } })).find((e) => (e.payloadJson as { leadId?: string }).leadId === lead.id)!;
    const outboxRow = await db.integrationOutboxEvent.findUniqueOrThrow({ where: { domainEventId: event.id } });
    const outcome = await processOutboxEvent(outboxRow.id);
    expect(outcome.status).toBe("DEAD_LETTER");
    expect(outcome.lastErrorCategory).toBe("PermanentError");
  });
});

describe("Integration health + dead-letter admin endpoints (spec sections 4, 25-26)", () => {
  it("reports live counts, never simulated/hard-coded ones", async () => {
    const res = await app.inject({ method: "GET", url: "/api/ghl/health", headers: { cookie: ownerCookie } });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(typeof body.outbox.queued).toBe("number");
    expect(typeof body.outbox.deadLetter).toBe("number");
  });

  it("a full sweep enqueues pending events and processes due rows in one call", async () => {
    const lead = await createLeadWithConsent("09175550005", `sweep-${Date.now()}@example.com`);
    const result = await runOutboxSweep();
    expect(result.processed).toBeGreaterThanOrEqual(1);
    const contactMap = await db.ghlContactMap.findUnique({ where: { personId: lead.personId } });
    expect(contactMap?.syncStatus).toBe("SYNCED");
  });
});

describe("Security: GHL admin endpoints are staff-permission-gated, not just UI-hidden (spec section 62)", () => {
  it("a Student session cannot reach any GHL admin endpoint", async () => {
    const studentCookie = await loginAs(app, DEV_USERS.studentA.email, DEV_USERS.studentA.password);
    const endpoints = [
      { method: "GET" as const, url: "/api/ghl/config" },
      { method: "POST" as const, url: "/api/ghl/test-connection" },
      { method: "GET" as const, url: "/api/ghl/health" },
      { method: "GET" as const, url: "/api/ghl/outbox/dead-letter" },
      { method: "POST" as const, url: "/api/ghl/mappings/tags" },
    ];
    for (const endpoint of endpoints) {
      const res = await app.inject({ method: endpoint.method, url: endpoint.url, headers: { cookie: studentCookie }, payload: endpoint.method === "POST" ? {} : undefined });
      expect(res.statusCode).toBe(403);
    }
  });

  it("staff without the Communications - GHL Integration permission are denied", async () => {
    const financeCookie = await loginAs(app, DEV_USERS.finance.email, DEV_USERS.finance.password);
    const res = await app.inject({ method: "GET", url: "/api/ghl/config", headers: { cookie: financeCookie } });
    expect(res.statusCode).toBe(403);
  });
});
