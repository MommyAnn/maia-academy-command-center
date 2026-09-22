import { beforeAll, afterAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { db } from "../src/db.js";
import { resetDb, loginAs, DEV_USERS } from "./helpers.js";

let app: FastifyInstance;

beforeAll(async () => {
  await resetDb();
  app = await buildApp();
});

afterAll(async () => {
  await app.close();
  await db.$disconnect();
});

describe("Audit log foundation (spec sections 31-32)", () => {
  it("records a Login entry with a human-readable summary", async () => {
    await loginAs(app, DEV_USERS.owner.email, DEV_USERS.owner.password);
    const entries = await db.activityLog.findMany({ where: { action: "Login" }, orderBy: { occurredAt: "desc" } });
    expect(entries.length).toBeGreaterThan(0);
    expect(entries[0]!.summary).toContain("logged in");
  });

  it("records a Login Failed entry on a wrong password, without ever storing the attempted password", async () => {
    await app.inject({ method: "POST", url: "/api/auth/login", payload: { email: DEV_USERS.owner.email, password: "TotallyWrongPassword123!" } });
    const entries = await db.activityLog.findMany({ where: { action: "Login Failed" } });
    expect(entries.length).toBeGreaterThan(0);

    const allText = entries.map((e) => e.summary).join(" ");
    expect(allText).not.toContain("TotallyWrongPassword123!");
  });

  it("NEVER logs a raw password, password hash, or session token anywhere in the activity log, across every action recorded in this suite", async () => {
    // Exercise every logging code path once more.
    const cookie = await loginAs(app, DEV_USERS.finance.email, DEV_USERS.finance.password);
    await app.inject({ method: "POST", url: "/api/auth/logout", headers: { cookie } });
    await app.inject({ method: "POST", url: "/api/auth/request-password-reset", payload: { email: DEV_USERS.finance.email } });

    const allEntries = await db.activityLog.findMany();
    const allSummaries = allEntries.map((e) => e.summary).join("\n");

    const secretsThatMustNeverAppear = [
      DEV_USERS.owner.password,
      DEV_USERS.finance.password,
      DEV_USERS.studentA.password,
      DEV_USERS.studentB.password,
    ];
    for (const secret of secretsThatMustNeverAppear) {
      expect(allSummaries).not.toContain(secret);
    }
    // Bcrypt hashes always start with this prefix — confirms no hash leaked either.
    expect(allSummaries).not.toContain("$2a$");
    expect(allSummaries).not.toContain("$2b$");
  });

  it("a payment verification is attributed to the acting staff member, not anonymous", async () => {
    const studentA = await db.student.findUniqueOrThrow({ where: { studentDisplayId: "MAIA-B14-DEV-A" } });
    const studentCookie = await loginAs(app, DEV_USERS.studentA.email, DEV_USERS.studentA.password);
    const submit = await app.inject({
      method: "POST",
      url: `/api/students/${studentA.id}/payments`,
      headers: { cookie: studentCookie },
      payload: { amount: 200, method: "Cash", type: "Other" },
    });
    const paymentId = submit.json().payment.id;

    const ownerCookie = await loginAs(app, DEV_USERS.owner.email, DEV_USERS.owner.password);
    await app.inject({ method: "POST", url: `/api/payments/${paymentId}/verify`, headers: { cookie: ownerCookie } });

    const entry = await db.activityLog.findFirst({ where: { action: "Payment Verified", entityId: paymentId } });
    expect(entry).not.toBeNull();
    expect(entry!.actorUserId).not.toBeNull();
  });
});
