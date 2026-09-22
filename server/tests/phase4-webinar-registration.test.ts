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

async function createOpenSession(title = `Webinar ${Date.now()}`) {
  const res = await app.inject({
    method: "POST",
    url: "/api/webinar/sessions",
    headers: { cookie: ownerCookie },
    payload: { title, type: "Free Webinar", date: new Date(Date.now() + 86400000).toISOString(), startTime: "19:00", endTime: "21:00", platform: "Zoom", status: "Registration Open" },
  });
  expect(res.statusCode).toBe(201);
  return res.json().session;
}

describe("Public webinar registration (spec sections 4-9)", () => {
  it("creates a Person + Lead + Registration, with first-touch attribution on the Lead", async () => {
    const session = await createOpenSession();
    const res = await app.inject({
      method: "POST",
      url: "/api/webinar/register",
      payload: {
        fullName: "Synthetic Test Lead One",
        contactNumber: "09170001111",
        email: `synth1-${Date.now()}@example.com`,
        sessionId: session.id,
        source: "Facebook",
        campaign: "Campaign A",
        utmSource: "facebook",
        utmMedium: "cpc",
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().lead.leadDisplayId).toMatch(/^LEAD-\d{4}-\d{6}$/);

    const lead = await db.lead.findUniqueOrThrow({ where: { id: res.json().lead.id } });
    expect(lead.source).toBe("Facebook");
    expect(lead.campaign).toBe("Campaign A");
    expect(lead.firstRegistrationDate).not.toBeNull();
    expect(lead.pipelineStage).toBe("NOT_CONTACTED");
  });

  it("registering twice for the SAME session is rejected as a duplicate registration", async () => {
    const session = await createOpenSession();
    const email = `dup-session-${Date.now()}@example.com`;
    const first = await app.inject({ method: "POST", url: "/api/webinar/register", payload: { fullName: "Dup Same Session", contactNumber: "09170002222", email, sessionId: session.id } });
    expect(first.statusCode).toBe(201);

    const second = await app.inject({ method: "POST", url: "/api/webinar/register", payload: { fullName: "Dup Same Session", contactNumber: "09170002222", email, sessionId: session.id } });
    expect(second.statusCode).toBe(409);
  });

  it("MULTIPLE WEBINAR TEST (spec section 60): the same Lead registering for two different sessions gets ONE Lead and TWO Registration rows", async () => {
    const sessionA = await createOpenSession("Webinar A");
    const sessionB = await createOpenSession("Webinar B");
    const email = `multi-webinar-${Date.now()}@example.com`;

    const regA = await app.inject({ method: "POST", url: "/api/webinar/register", payload: { fullName: "Multi Webinar Lead", contactNumber: "09170003333", email, sessionId: sessionA.id, campaign: "Campaign A" } });
    expect(regA.statusCode).toBe(201);
    const leadId = regA.json().lead.id;

    const regB = await app.inject({ method: "POST", url: "/api/webinar/register", payload: { fullName: "Multi Webinar Lead", contactNumber: "09170003333", email, sessionId: sessionB.id, campaign: "Campaign B" } });
    expect(regB.statusCode).toBe(201);
    expect(regB.json().lead.id).toBe(leadId); // same Lead reused, never duplicated

    const registrations = await db.webinarRegistration.findMany({ where: { leadId } });
    expect(registrations.length).toBe(2);

    // ATTRIBUTION TEST (spec section 66): original source stays on the
    // Lead; the latest registration's own campaign is preserved separately
    // and never overwrites the Lead's first-touch value.
    const lead = await db.lead.findUniqueOrThrow({ where: { id: leadId } });
    expect(lead.campaign).toBe("Campaign A"); // first-touch, unchanged
    const latestReg = registrations.find((r) => r.sessionId === sessionB.id)!;
    expect(latestReg.campaign).toBe("Campaign B"); // latest-touch, on the registration row
  });

  it("WEBINAR FULL / WEBINAR CLOSED error states (spec sections 5, 57)", async () => {
    const full = await app.inject({
      method: "POST",
      url: "/api/webinar/sessions",
      headers: { cookie: ownerCookie },
      payload: { title: "Tiny Room", type: "Free Webinar", date: new Date(Date.now() + 86400000).toISOString(), startTime: "10:00", endTime: "11:00", platform: "Zoom", status: "Registration Open", capacity: 1 },
    });
    const fullSessionId = full.json().session.id;
    const first = await app.inject({ method: "POST", url: "/api/webinar/register", payload: { fullName: "Seat One", contactNumber: "09170004444", sessionId: fullSessionId } });
    expect(first.statusCode).toBe(201);
    const second = await app.inject({ method: "POST", url: "/api/webinar/register", payload: { fullName: "Seat Two", contactNumber: "09170005555", sessionId: fullSessionId } });
    expect(second.statusCode).toBe(422);
    expect(second.json().error).toBe("WEBINAR FULL");

    const draft = await app.inject({
      method: "POST",
      url: "/api/webinar/sessions",
      headers: { cookie: ownerCookie },
      payload: { title: "Draft Webinar", type: "Free Webinar", date: new Date(Date.now() + 86400000).toISOString(), startTime: "10:00", endTime: "11:00", platform: "Zoom" },
    });
    const closedRes = await app.inject({ method: "POST", url: "/api/webinar/register", payload: { fullName: "Too Early", contactNumber: "09170006666", sessionId: draft.json().session.id } });
    expect(closedRes.statusCode).toBe(422);
    expect(closedRes.json().error).toBe("WEBINAR CLOSED");
  });

  it("consent is a separate, optional field — registering without it never sets any communication permission", async () => {
    const session = await createOpenSession();
    const res = await app.inject({ method: "POST", url: "/api/webinar/register", payload: { fullName: "No Consent Given", contactNumber: "09170007777", sessionId: session.id } });
    expect(res.statusCode).toBe(201);
    const lead = await db.lead.findUniqueOrThrow({ where: { id: res.json().lead.id } });
    expect(lead.canEmail).toBe(false);
    expect(lead.canSms).toBe(false);
    expect(lead.canWhatsapp).toBe(false);
    expect(lead.consentDate).toBeNull();

    const withConsent = await app.inject({
      method: "POST",
      url: "/api/webinar/register",
      payload: { fullName: "Consent Given", contactNumber: "09170008888", sessionId: session.id, consent: { canEmail: true, canSms: false, canWhatsapp: false, consentVersion: "v1.0" } },
    });
    const leadWithConsent = await db.lead.findUniqueOrThrow({ where: { id: withConsent.json().lead.id } });
    expect(leadWithConsent.canEmail).toBe(true);
    expect(leadWithConsent.consentDate).not.toBeNull();
  });

  it("EXISTING STUDENT TEST (spec sections 36, 63): an already-converted Student registering for a new webinar is recognized, not duplicated", async () => {
    const email = `existing-student-${Date.now()}@example.com`;
    const contactNumber = "09170009999";

    // Bring a Lead all the way to a real Student first.
    const batch = await db.batch.findUniqueOrThrow({ where: { code: "14" } });
    const pkg = await db.package.findUniqueOrThrow({ where: { name: "Premium" } });
    const bootstrapSession = await createOpenSession();
    const bootstrapReg = await app.inject({ method: "POST", url: "/api/webinar/register", payload: { fullName: "Future Student", contactNumber, email, sessionId: bootstrapSession.id } });
    const leadId = bootstrapReg.json().lead.id;
    const convert = await app.inject({ method: "POST", url: `/api/leads/${leadId}/convert`, headers: { cookie: ownerCookie }, payload: { batchId: batch.id, packageId: pkg.id } });
    expect(convert.statusCode).toBe(201);
    const studentCountBefore = await db.student.count();

    // Now the same person registers for ANOTHER webinar.
    const secondSession = await createOpenSession();
    const secondReg = await app.inject({ method: "POST", url: "/api/webinar/register", payload: { fullName: "Future Student", contactNumber, email, sessionId: secondSession.id } });
    expect(secondReg.statusCode).toBe(201);
    expect(secondReg.json().matchedExistingStudent).toBe(true);

    const studentCountAfter = await db.student.count();
    expect(studentCountAfter).toBe(studentCountBefore); // no duplicate Student created
  });
});

describe("Webinar attendance (spec sections 13-15, 61)", () => {
  it("NO-SHOW TEST: a registered lead who never attends keeps their registration, marked No Show, and remains available for follow-up", async () => {
    const session = await createOpenSession();
    const reg = await app.inject({ method: "POST", url: "/api/webinar/register", payload: { fullName: "No Show Lead", contactNumber: "09171110000", sessionId: session.id } });
    const leadId = reg.json().lead.id;
    const registrations = await db.webinarRegistration.findMany({ where: { leadId } });
    const registrationId = registrations[0]!.id;

    const mark = await app.inject({ method: "POST", url: `/api/webinar/registrations/${registrationId}/attendance`, headers: { cookie: ownerCookie }, payload: { status: "No Show" } });
    expect(mark.statusCode).toBe(200);

    const updated = await db.webinarRegistration.findUniqueOrThrow({ where: { id: registrationId } });
    expect(updated.attendanceStatus).toBe("No Show");
    expect(updated.registrationStatus).toBe("Registered"); // registration itself preserved, not deleted

    const events = await db.domainEvent.findMany({ where: { type: "WEBINAR_NO_SHOW" } });
    const forThisLead = events.filter((e) => (e.payloadJson as { leadId?: string }).leadId === leadId);
    expect(forThisLead.length).toBe(1);
  });

  it("an unauthorized staff role cannot mark webinar attendance", async () => {
    const session = await createOpenSession();
    const reg = await app.inject({ method: "POST", url: "/api/webinar/register", payload: { fullName: "Security Test Lead", contactNumber: "09171111111", sessionId: session.id } });
    const registrationId = (await db.webinarRegistration.findFirstOrThrow({ where: { leadId: reg.json().lead.id } })).id;

    const financeCookie = await loginAs(app, DEV_USERS.finance.email, DEV_USERS.finance.password);
    const res = await app.inject({ method: "POST", url: `/api/webinar/registrations/${registrationId}/attendance`, headers: { cookie: financeCookie }, payload: { status: "Attended" } });
    expect(res.statusCode).toBe(403);
  });
});
