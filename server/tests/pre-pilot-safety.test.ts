// M.A.I.A. Pre-Pilot Safety Hardening — Emergency Control Center.
// Covers every scenario the task explicitly asked for: unauthorized/
// student toggle attempts, each control's real enforcement point,
// resume behavior, audit logging, and concurrent state changes.

import { beforeAll, afterAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { db } from "../src/db.js";
import { resetDb, loginAs, DEV_USERS } from "./helpers.js";
import { hashPassword } from "../src/auth/password.js";
import { runOutboxSweep } from "../src/modules/ghl/outbox.js";
import { syncAdAccount } from "../src/modules/ads/sync.js";
import { runDispatcherSweep } from "../src/modules/automation/dispatcher.js";

let app: FastifyInstance;
let ownerCookie: string;
let financeCookie: string;
let studentACookie: string;
let ownerUserId: string;
let studentAId: string;

async function toggle(cookie: string, path: string, body: Record<string, unknown>) {
  return app.inject({ method: "POST", url: `/api/admin/safety/${path}`, headers: { cookie }, payload: body });
}

beforeAll(async () => {
  await resetDb();
  app = await buildApp();
  ownerCookie = await loginAs(app, DEV_USERS.owner.email, DEV_USERS.owner.password);
  financeCookie = await loginAs(app, DEV_USERS.finance.email, DEV_USERS.finance.password);
  studentACookie = await loginAs(app, DEV_USERS.studentA.email, DEV_USERS.studentA.password);
  ownerUserId = (await db.user.findFirstOrThrow({ where: { email: DEV_USERS.owner.email } })).id;
  studentAId = (await db.student.findUniqueOrThrow({ where: { studentDisplayId: "MAIA-B14-DEV-A" } })).id;
});

afterAll(async () => {
  await app.close();
  await db.$disconnect();
});

describe("Safe pre-pilot defaults (spec Task 9)", () => {
  it("reports every control at its safe default with no manual action taken", async () => {
    const res = await app.inject({ method: "GET", url: "/api/admin/safety/status", headers: { cookie: ownerCookie } });
    expect(res.statusCode).toBe(200);
    const byKey = Object.fromEntries(res.json().controls.map((c: { key: string; state: string }) => [c.key, c.state]));
    expect(byKey.CHECKOUT).toBe("DISABLED");
    expect(byKey.GHL_SYNC).toBe("PAUSED");
    expect(byKey.ADS_SYNC).toBe("PAUSED");
    expect(byKey.AUTOMATIONS_GLOBAL).toBe("ACTIVE");
    expect(byKey.MAINTENANCE_MODE).toBe("OFF");
  });
});

describe("RBAC — Emergency Controls access (spec Task 7)", () => {
  it("rejects a Student session (403) from the status view and every toggle", async () => {
    const statusRes = await app.inject({ method: "GET", url: "/api/admin/safety/status", headers: { cookie: studentACookie } });
    expect(statusRes.statusCode).toBe(403);

    for (const path of ["checkout", "ghl-sync", "ads-sync", "automations-global", "maintenance-mode"]) {
      const res = await toggle(studentACookie, path, { state: "ENABLED", confirm: true, reason: "student attempt" });
      expect(res.statusCode).toBe(403);
    }
  });

  it("rejects ordinary staff (Finance Officer) who was never granted Emergency Controls (403)", async () => {
    const statusRes = await app.inject({ method: "GET", url: "/api/admin/safety/status", headers: { cookie: financeCookie } });
    expect(statusRes.statusCode).toBe(403);

    const res = await toggle(financeCookie, "checkout", { state: "ENABLED", confirm: true, reason: "finance attempt" });
    expect(res.statusCode).toBe(403);
  });

  it("no SafetyControl row is ever changed by a rejected attempt", async () => {
    const before = await db.safetyControl.findUnique({ where: { key: "CHECKOUT" } });
    await toggle(studentACookie, "checkout", { state: "ENABLED", confirm: true, reason: "student attempt" });
    await toggle(financeCookie, "checkout", { state: "ENABLED", confirm: true, reason: "finance attempt" });
    const after = await db.safetyControl.findUnique({ where: { key: "CHECKOUT" } });
    expect(after?.state ?? "DISABLED").toBe(before?.state ?? "DISABLED");
  });

  it("Owner can view status", async () => {
    const res = await app.inject({ method: "GET", url: "/api/admin/safety/status", headers: { cookie: ownerCookie } });
    expect(res.statusCode).toBe(200);
    expect(res.json().controls).toHaveLength(5);
  });
});

describe("Safety confirmations (spec Task 6)", () => {
  it("rejects a toggle without confirm:true", async () => {
    const res = await toggle(ownerCookie, "checkout", { state: "ENABLED", reason: "no confirm flag" });
    expect(res.statusCode).toBe(400);
  });

  it("rejects a toggle without a reason", async () => {
    const res = await toggle(ownerCookie, "checkout", { state: "ENABLED", confirm: true });
    expect(res.statusCode).toBe(400);
  });

  it("rejects an invalid state literal for the given control", async () => {
    const res = await toggle(ownerCookie, "checkout", { state: "MAYBE", confirm: true, reason: "invalid state" });
    expect(res.statusCode).toBe(400);
  });
});

describe("Checkout kill switch enforcement (Task 1)", () => {
  const SYNTHETIC_PASSWORD = "PrePilotSafetySynthetic123!";

  async function provisionSyntheticStudent(suffix: string) {
    const premium = await db.package.findFirstOrThrow({ where: { name: "Premium" } });
    const batch14 = await db.batch.findFirstOrThrow({ where: { code: "14" } });
    const studentRole = await db.role.findUniqueOrThrow({ where: { name: "Student" } });
    const email = `pre-pilot-safety-${suffix}@maiaacademy.local`;
    const person = await db.person.create({ data: { fullName: `Pre-Pilot Safety Student ${suffix}`, email } });
    const student = await db.student.create({ data: { studentDisplayId: `MAIA-B14-PPS-${suffix}`, personId: person.id, batchId: batch14.id, packageId: premium.id, enrollmentStatus: "Active Student" } });
    await db.user.create({ data: { personId: person.id, email, passwordHash: await hashPassword(SYNTHETIC_PASSWORD), roleId: studentRole.id, status: "ACTIVE" } });
    const cookie = await loginAs(app, email, SYNTHETIC_PASSWORD);
    return { cookie, studentId: student.id };
  }

  async function createTestProduct(suffix: string) {
    return db.commerceProduct.create({
      data: { productDisplayId: `PRODUCT-PPS-${suffix}`, name: `Pre-Pilot Test Product ${suffix}`, type: "PACKAGE", basePrice: 10000, status: "ACTIVE", visibility: "PUBLIC", entitlementsJson: [{ featureKey: "CREATIVE_STUDIO" }], createdById: ownerUserId },
    });
  }

  it("blocks new checkout session creation while DISABLED (the pre-pilot default) — 503, no session row created", async () => {
    const { cookie, studentId } = await provisionSyntheticStudent("blocked");
    const product = await createTestProduct("blocked");
    const beforeCount = await db.checkoutSession.count();

    const res = await app.inject({ method: "POST", url: `/api/students/${studentId}/checkout-sessions`, headers: { cookie }, payload: { productId: product.id } });
    expect(res.statusCode).toBe(503);

    const afterCount = await db.checkoutSession.count();
    expect(afterCount).toBe(beforeCount);
  });

  it("existing financial history (Finance module) remains fully accessible while CHECKOUT is DISABLED", async () => {
    const res = await app.inject({ method: "GET", url: `/api/students/${studentAId}/payments`, headers: { cookie: ownerCookie } });
    expect(res.statusCode).not.toBe(503);
  });

  it("allows checkout session creation once an Owner explicitly enables it, with confirmation and a reason, and audits the change", async () => {
    const enableRes = await toggle(ownerCookie, "checkout", { state: "ENABLED", confirm: true, reason: "Pilot smoke test — temporarily enabling checkout" });
    expect(enableRes.statusCode).toBe(200);
    expect(enableRes.json().control.state).toBe("ENABLED");

    const auditRow = await db.activityLog.findFirst({ where: { action: "Checkout Control Changed" }, orderBy: { occurredAt: "desc" } });
    expect(auditRow).not.toBeNull();
    expect(auditRow!.actorUserId).toBe(ownerUserId);
    expect(auditRow!.summary).toContain("DISABLED");
    expect(auditRow!.summary).toContain("ENABLED");
    expect(auditRow!.summary).toContain("Pilot smoke test");

    const { cookie, studentId } = await provisionSyntheticStudent("enabled");
    const product = await createTestProduct("enabled");
    const res = await app.inject({ method: "POST", url: `/api/students/${studentId}/checkout-sessions`, headers: { cookie }, payload: { productId: product.id } });
    expect(res.statusCode).toBe(201);

    // Restore the safe default so later describe blocks in this file are unaffected.
    const disableRes = await toggle(ownerCookie, "checkout", { state: "DISABLED", confirm: true, reason: "Restoring pre-pilot safe default after test" });
    expect(disableRes.statusCode).toBe(200);
  });
});

describe("External sync pause enforcement — GHL (Task 2)", () => {
  it("does not send outbound sync jobs while GHL_SYNC is PAUSED (the pre-pilot default) — queued row is preserved, not destroyed", async () => {
    const leadRes = await app.inject({ method: "POST", url: "/api/leads", headers: { cookie: ownerCookie }, payload: { fullName: "Pre-Pilot Safety GHL Lead", email: "pre-pilot-ghl-lead@example.com" } });
    expect(leadRes.statusCode).toBe(201);

    const sweep = await runOutboxSweep();
    expect(sweep.enqueued).toBeGreaterThanOrEqual(1);
    expect(sweep.processed).toBe(0);

    const rows = await db.integrationOutboxEvent.findMany({ where: { status: "QUEUED" } });
    expect(rows.length).toBeGreaterThanOrEqual(1);
  });

  it("resumes sending once an Owner sets GHL_SYNC back to ENABLED, and audits the change", async () => {
    const enableRes = await toggle(ownerCookie, "ghl-sync", { state: "ENABLED", confirm: true, reason: "Resuming GHL sync for test" });
    expect(enableRes.statusCode).toBe(200);

    const auditRow = await db.activityLog.findFirst({ where: { action: "GHL Sync Control Changed" }, orderBy: { occurredAt: "desc" } });
    expect(auditRow).not.toBeNull();
    expect(auditRow!.summary).toContain("PAUSED");
    expect(auditRow!.summary).toContain("ENABLED");

    const before = await db.integrationOutboxEvent.findFirst({ where: { status: "QUEUED" } });
    expect(before).not.toBeNull();

    const sweep = await runOutboxSweep();
    expect(sweep.processed).toBeGreaterThanOrEqual(1);

    const after = await db.integrationOutboxEvent.findUnique({ where: { id: before!.id } });
    expect(after!.status).not.toBe("QUEUED");
    expect(after!.attemptCount).toBeGreaterThan(0);

    const pauseRes = await toggle(ownerCookie, "ghl-sync", { state: "PAUSED", confirm: true, reason: "Restoring pre-pilot safe default after test" });
    expect(pauseRes.statusCode).toBe(200);
  });
});

describe("External sync pause enforcement — Ads (Task 2)", () => {
  it("blocks live Ads API sync while ADS_SYNC is PAUSED (the pre-pilot default) — gate fires before any account lookup", async () => {
    const result = await syncAdAccount("does-not-exist", ownerUserId, new Date("2026-01-01"), new Date("2026-01-31"));
    expect(result.status).toBe("FAILED");
    expect(result.errors[0]).toMatch(/paused/i);
  });

  it("proceeds past the pause gate once ADS_SYNC is ENABLED (reaches the next real check instead)", async () => {
    const enableRes = await toggle(ownerCookie, "ads-sync", { state: "ENABLED", confirm: true, reason: "Resuming Ads sync for test" });
    expect(enableRes.statusCode).toBe(200);

    const result = await syncAdAccount("does-not-exist", ownerUserId, new Date("2026-01-01"), new Date("2026-01-31"));
    expect(result.status).toBe("FAILED");
    expect(result.errors[0]).toMatch(/not found/i);

    const pauseRes = await toggle(ownerCookie, "ads-sync", { state: "PAUSED", confirm: true, reason: "Restoring pre-pilot safe default after test" });
    expect(pauseRes.statusCode).toBe(200);
  });

  it("CSV import / manual Ads data entry stays entirely unaffected by ADS_SYNC being PAUSED (Owner decision: allowed)", async () => {
    // No code path in modules/ads/import.ts consults the safety module at
    // all — the pause gate lives exclusively inside syncAdAccount
    // (sync.ts), so this is proven structurally (the source file never
    // imports safety/control.ts), not by re-exercising the whole CSV
    // upload flow again (already covered by the existing Phase 14 suite).
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const fileContents = await fs.readFile(path.join(process.cwd(), "src/modules/ads/import.ts"), "utf-8");
    expect(fileContents).not.toContain("safety/control");
  });
});

describe("Global automation pause enforcement + resume (Task 4)", () => {
  let automationId: string;

  it("sets up a real ACTIVE automation triggered by LEAD_CREATED", async () => {
    const business = await db.business.create({ data: { studentId: studentAId, name: "Pre-Pilot Safety Test Business" } });
    const automation = await db.automation.create({
      data: { automationDisplayId: "AUTO-PPS-000001", studentId: studentAId, businessId: business.id, name: "Pre-Pilot Safety Test Automation", status: "ACTIVE", createdById: ownerUserId },
    });
    const version = await db.automationVersion.create({
      data: { automationId: automation.id, versionNumber: 1, flowJson: { nodes: [{ id: "start", type: "START" }], edges: [] }, triggerType: "LEAD_CREATED", status: "ACTIVE", createdById: ownerUserId },
    });
    await db.automation.update({ where: { id: automation.id }, data: { currentVersionId: version.id } });
    automationId = automation.id;
  });

  it("while AUTOMATIONS_GLOBAL is ACTIVE (default), a new LEAD_CREATED event starts a run", async () => {
    await app.inject({ method: "POST", url: "/api/leads", headers: { cookie: ownerCookie }, payload: { fullName: "Pre-Pilot Safety Automation Lead 1", email: "pre-pilot-auto-lead-1@example.com" } });
    const sweep = await runDispatcherSweep();
    expect(sweep.matched).toBeGreaterThanOrEqual(1);
    const runs = await db.automationRun.findMany({ where: { automationId } });
    expect(runs.length).toBeGreaterThanOrEqual(1);
  });

  it("once globally PAUSED, no new run is started AND no queued run is advanced — nothing is deleted", async () => {
    const pauseRes = await toggle(ownerCookie, "automations-global", { state: "PAUSED", confirm: true, reason: "Testing global automation pause" });
    expect(pauseRes.statusCode).toBe(200);

    const auditRow = await db.activityLog.findFirst({ where: { action: "Automation Global Pause Changed" }, orderBy: { occurredAt: "desc" } });
    expect(auditRow).not.toBeNull();
    expect(auditRow!.summary).toContain("ACTIVE");
    expect(auditRow!.summary).toContain("PAUSED");

    const runsBefore = await db.automationRun.count({ where: { automationId } });
    const automationDefBefore = await db.automation.findUnique({ where: { id: automationId } });
    expect(automationDefBefore).not.toBeNull(); // definition still exists

    await app.inject({ method: "POST", url: "/api/leads", headers: { cookie: ownerCookie }, payload: { fullName: "Pre-Pilot Safety Automation Lead 2", email: "pre-pilot-auto-lead-2@example.com" } });
    const sweep = await runDispatcherSweep();
    expect(sweep).toEqual({ matched: 0, advanced: 0 });

    const runsAfter = await db.automationRun.count({ where: { automationId } });
    expect(runsAfter).toBe(runsBefore); // no new run created while paused
  });

  it("resumes cleanly once set back to ACTIVE — the lead created during the pause is now picked up", async () => {
    const resumeRes = await toggle(ownerCookie, "automations-global", { state: "ACTIVE", confirm: true, reason: "Resuming automations after test" });
    expect(resumeRes.statusCode).toBe(200);

    const runsBefore = await db.automationRun.count({ where: { automationId } });
    const sweep = await runDispatcherSweep();
    expect(sweep.matched).toBeGreaterThanOrEqual(1);
    const runsAfter = await db.automationRun.count({ where: { automationId } });
    expect(runsAfter).toBeGreaterThan(runsBefore);
  });
});

describe("Backend Maintenance Mode enforcement (Task 3)", () => {
  it("blocks a normal protected route (503) while ON, but the allowlist keeps working", async () => {
    const onRes = await toggle(ownerCookie, "maintenance-mode", { state: "ON", confirm: true, reason: "Testing maintenance mode" });
    expect(onRes.statusCode).toBe(200);

    const auditRow = await db.activityLog.findFirst({ where: { action: "Maintenance Mode Changed" }, orderBy: { occurredAt: "desc" } });
    expect(auditRow).not.toBeNull();
    expect(auditRow!.summary).toContain("OFF");
    expect(auditRow!.summary).toContain("ON");

    // Blocked: an ordinary protected route.
    const blockedRes = await app.inject({ method: "GET", url: "/api/students", headers: { cookie: ownerCookie } });
    expect(blockedRes.statusCode).toBe(503);

    // Allowed: health check.
    const healthRes = await app.inject({ method: "GET", url: "/api/health" });
    expect(healthRes.statusCode).toBe(200);

    // Allowed: auth/me for an already-authenticated admin.
    const meRes = await app.inject({ method: "GET", url: "/api/auth/me", headers: { cookie: ownerCookie } });
    expect(meRes.statusCode).toBe(200);

    // Allowed: login itself, so an Owner/Admin can authenticate during an incident.
    const loginRes = await app.inject({ method: "POST", url: "/api/auth/login", payload: { email: DEV_USERS.owner.email, password: DEV_USERS.owner.password } });
    expect(loginRes.statusCode).toBe(200);

    // Allowed: the Emergency Control Center itself — otherwise nobody could ever turn maintenance back off.
    const statusRes = await app.inject({ method: "GET", url: "/api/admin/safety/status", headers: { cookie: ownerCookie } });
    expect(statusRes.statusCode).toBe(200);
  });

  it("a Student session hitting the (allowlisted) safety status route during maintenance is still rejected by RBAC, not let through", async () => {
    const res = await app.inject({ method: "GET", url: "/api/admin/safety/status", headers: { cookie: studentACookie } });
    expect(res.statusCode).toBe(403); // maintenance allowlist only decides whether the route RUNS, never whether the caller is authorized
  });

  it("turning maintenance OFF restores normal operation immediately", async () => {
    const offRes = await toggle(ownerCookie, "maintenance-mode", { state: "OFF", confirm: true, reason: "Restoring normal operation after test" });
    expect(offRes.statusCode).toBe(200);

    const res = await app.inject({ method: "GET", url: "/api/students", headers: { cookie: ownerCookie } });
    expect(res.statusCode).not.toBe(503);
  });
});

describe("Concurrent state changes (Task 10)", () => {
  it("two simultaneous toggles never corrupt state — the final state is exactly one of the two, and both are audited", async () => {
    const before = await db.activityLog.count({ where: { action: "Checkout Control Changed" } });

    const [resA, resB] = await Promise.all([
      toggle(ownerCookie, "checkout", { state: "ENABLED", confirm: true, reason: "Concurrent test A" }),
      toggle(ownerCookie, "checkout", { state: "DISABLED", confirm: true, reason: "Concurrent test B" }),
    ]);
    expect(resA.statusCode).toBe(200);
    expect(resB.statusCode).toBe(200);

    const final = await db.safetyControl.findUniqueOrThrow({ where: { key: "CHECKOUT" } });
    expect(["ENABLED", "DISABLED"]).toContain(final.state);

    const after = await db.activityLog.count({ where: { action: "Checkout Control Changed" } });
    expect(after - before).toBe(2); // neither concurrent write silently lost its audit entry

    // Restore the safe default.
    await toggle(ownerCookie, "checkout", { state: "DISABLED", confirm: true, reason: "Restoring pre-pilot safe default after concurrency test" });
  });
});
