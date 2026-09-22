import { beforeAll, afterAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { db } from "../src/db.js";
import { resetDb, loginAs, DEV_USERS } from "./helpers.js";

let app: FastifyInstance;
let ownerCookie: string;

beforeAll(async () => {
  await resetDb();
  app = await buildApp();
  ownerCookie = await loginAs(app, DEV_USERS.owner.email, DEV_USERS.owner.password);
});

afterAll(async () => {
  await app.close();
  await db.$disconnect();
});

describe("Free Webinar Dashboard (spec sections 40-41): real KPIs, derived rates, never hard-coded", () => {
  it("reflects live registration/attendance/pipeline counts and computes conversion rates from them", async () => {
    const session = await app.inject({
      method: "POST",
      url: "/api/webinar/sessions",
      headers: { cookie: ownerCookie },
      payload: { title: "Dashboard Probe Webinar", type: "Free Webinar", date: new Date(Date.now() + 86400000).toISOString(), startTime: "19:00", endTime: "21:00", platform: "Zoom", status: "Registration Open" },
    });
    const sessionId = session.json().session.id;

    const before = await app.inject({ method: "GET", url: "/api/webinar/dashboard", headers: { cookie: ownerCookie } });
    const registrationsBefore = before.json().summary.registrations;

    const reg = await app.inject({ method: "POST", url: "/api/webinar/register", payload: { fullName: "Dashboard Probe Lead", contactNumber: "09174440000", sessionId } });
    const registrationId = (await db.webinarRegistration.findFirstOrThrow({ where: { leadId: reg.json().lead.id } })).id;
    await app.inject({ method: "POST", url: `/api/webinar/registrations/${registrationId}/attendance`, headers: { cookie: ownerCookie }, payload: { status: "Attended" } });

    const after = await app.inject({ method: "GET", url: "/api/webinar/dashboard", headers: { cookie: ownerCookie } });
    expect(after.json().summary.registrations).toBe(registrationsBefore + 1);
    expect(after.json().summary.attended).toBeGreaterThan(0);
    expect(after.json().conversionRates.registrationToAttendance).toBeGreaterThan(0);
    expect(typeof after.json().conversionRates.registrationToEnrollment).toBe("number");
  });

  it("an unauthorized staff role is denied the dashboard and the reports endpoint", async () => {
    const financeCookie = await loginAs(app, DEV_USERS.finance.email, DEV_USERS.finance.password);
    const dashboard = await app.inject({ method: "GET", url: "/api/webinar/dashboard", headers: { cookie: financeCookie } });
    expect(dashboard.statusCode).toBe(403);
    const reports = await app.inject({ method: "GET", url: "/api/webinar/reports", headers: { cookie: financeCookie } });
    expect(reports.statusCode).toBe(403);
  });

  it("an unauthenticated request is rejected outright", async () => {
    const res = await app.inject({ method: "GET", url: "/api/webinar/dashboard" });
    expect(res.statusCode).toBe(401);
  });
});

describe("Reports (spec section 43)", () => {
  it("returns real grouped breakdowns", async () => {
    const res = await app.inject({ method: "GET", url: "/api/webinar/reports", headers: { cookie: ownerCookie } });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json().registrationsBySession)).toBe(true);
    expect(Array.isArray(res.json().byPipelineStage)).toBe(true);
    expect(typeof res.json().totalConversions).toBe("number");
  });
});
