import { beforeAll, afterAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { db } from "../src/db.js";
import { resetDb, loginAs, DEV_USERS } from "./helpers.js";

let app: FastifyInstance;
let ownerCookie: string;
let ownerUserId: string;

beforeAll(async () => {
  await resetDb();
  app = await buildApp();
  ownerCookie = await loginAs(app, DEV_USERS.owner.email, DEV_USERS.owner.password);
  const me = await app.inject({ method: "GET", url: "/api/auth/me", headers: { cookie: ownerCookie } });
  ownerUserId = me.json().user.id;
});

afterAll(async () => {
  await app.close();
  await db.$disconnect();
});

async function createLead(fullName = `Pipeline Lead ${Date.now()}`) {
  const res = await app.inject({ method: "POST", url: "/api/leads", headers: { cookie: ownerCookie }, payload: { fullName, contactNumber: "09172220000" } });
  expect(res.statusCode).toBe(201);
  return res.json().lead;
}

describe("Lead Pipeline (spec sections 17-19)", () => {
  it("moving stages persists and appends to LeadPipelineHistory — never just overwriting the current value", async () => {
    const lead = await createLead();
    const toInterested = await app.inject({ method: "PATCH", url: `/api/leads/${lead.id}/pipeline-stage`, headers: { cookie: ownerCookie }, payload: { stage: "INTERESTED", reason: "Asked good questions on the call" } });
    expect(toInterested.statusCode).toBe(200);
    expect(toInterested.json().lead.pipelineStage).toBe("INTERESTED");

    const toConsidering = await app.inject({ method: "PATCH", url: `/api/leads/${lead.id}/pipeline-stage`, headers: { cookie: ownerCookie }, payload: { stage: "CONSIDERING" } });
    expect(toConsidering.statusCode).toBe(200);

    const history = await db.leadPipelineHistory.findMany({ where: { leadId: lead.id }, orderBy: { occurredAt: "asc" } });
    expect(history.map((h) => h.newStage)).toEqual(["INTERESTED", "CONSIDERING"]);
    expect(history[0]!.previousStage).toBe("NOT_CONTACTED");
    expect(history[1]!.previousStage).toBe("INTERESTED");

    const events = await db.domainEvent.findMany({ where: { type: { in: ["LEAD_INTERESTED", "LEAD_CONSIDERING"] } } });
    const forThisLead = events.filter((e) => (e.payloadJson as { leadId?: string }).leadId === lead.id);
    expect(forThisLead.length).toBe(2);
  });

  it("an unauthorized staff role cannot open the Leads list, export leads, or change a pipeline stage", async () => {
    const lead = await createLead();
    const financeCookie = await loginAs(app, DEV_USERS.finance.email, DEV_USERS.finance.password);

    const list = await app.inject({ method: "GET", url: "/api/leads", headers: { cookie: financeCookie } });
    expect(list.statusCode).toBe(403);

    const exported = await app.inject({ method: "GET", url: "/api/leads/export", headers: { cookie: financeCookie } });
    expect(exported.statusCode).toBe(403);

    const stageChange = await app.inject({ method: "PATCH", url: `/api/leads/${lead.id}/pipeline-stage`, headers: { cookie: financeCookie }, payload: { stage: "INTERESTED" } });
    expect(stageChange.statusCode).toBe(403);
  });

  it("a Student session can never reach any Lead admin endpoint", async () => {
    const lead = await createLead();
    const studentCookie = await loginAs(app, DEV_USERS.studentA.email, DEV_USERS.studentA.password);
    const res = await app.inject({ method: "GET", url: `/api/leads/${lead.id}`, headers: { cookie: studentCookie } });
    expect(res.statusCode).toBe(403);
  });
});

describe("Lead Notes (spec section 28)", () => {
  it("persists author/date/note and is readable via the Lead profile", async () => {
    const lead = await createLead();
    const create = await app.inject({ method: "POST", url: `/api/leads/${lead.id}/notes`, headers: { cookie: ownerCookie }, payload: { note: "Called, very interested in the AI track." } });
    expect(create.statusCode).toBe(201);

    const profile = await app.inject({ method: "GET", url: `/api/leads/${lead.id}`, headers: { cookie: ownerCookie } });
    expect(profile.json().lead.notes.length).toBe(1);
    expect(profile.json().lead.notes[0].note).toContain("AI track");
  });
});

describe("Follow-Up backend (spec sections 21-27)", () => {
  it("creates a follow-up, optionally links a real Task, and completing it never reopens or loses its outcome", async () => {
    const lead = await createLead();

    // Give the Owner a real Staff row so Task linking has somewhere to attach.
    const ownerUser = await db.user.findUniqueOrThrow({ where: { id: ownerUserId } });
    const ownerRole = await db.role.findUniqueOrThrow({ where: { name: "Owner" } });
    await db.staff.upsert({ where: { personId: ownerUser.personId }, update: {}, create: { personId: ownerUser.personId, roleId: ownerRole.id } });

    const create = await app.inject({
      method: "POST",
      url: `/api/leads/${lead.id}/follow-ups`,
      headers: { cookie: ownerCookie },
      payload: { channel: "Phone", purpose: "Check interest level", scheduledFor: new Date(Date.now() + 3600000).toISOString(), assignedStaffId: ownerUserId, createTask: true },
    });
    expect(create.statusCode).toBe(201);
    expect(create.json().followUp.taskId).not.toBeNull();

    const followUpId = create.json().followUp.id;
    const complete = await app.inject({ method: "PATCH", url: `/api/follow-ups/${followUpId}`, headers: { cookie: ownerCookie }, payload: { status: "Completed", outcome: "Very interested, wants to reserve." } });
    expect(complete.statusCode).toBe(200);
    expect(complete.json().followUp.completedAt).not.toBeNull();

    // Never overwritten/reopened after completion (spec section 27).
    const reopenAttempt = await app.inject({ method: "PATCH", url: `/api/follow-ups/${followUpId}`, headers: { cookie: ownerCookie }, payload: { status: "Scheduled" } });
    expect(reopenAttempt.statusCode).toBe(409);

    const stillCompleted = await db.followUp.findUniqueOrThrow({ where: { id: followUpId } });
    expect(stillCompleted.status).toBe("Completed");
    expect(stillCompleted.outcome).toContain("reserve");
  });

  it("the follow-up queue returns the Today bucket and an unauthorized staff role is denied", async () => {
    const lead = await createLead();
    await app.inject({ method: "POST", url: `/api/leads/${lead.id}/follow-ups`, headers: { cookie: ownerCookie }, payload: { channel: "SMS", scheduledFor: new Date().toISOString() } });

    const today = await app.inject({ method: "GET", url: "/api/follow-ups/queue?bucket=today", headers: { cookie: ownerCookie } });
    expect(today.statusCode).toBe(200);
    expect(today.json().followUps.length).toBeGreaterThan(0);

    const financeCookie = await loginAs(app, DEV_USERS.finance.email, DEV_USERS.finance.password);
    const denied = await app.inject({ method: "GET", url: "/api/follow-ups/queue?bucket=today", headers: { cookie: financeCookie } });
    expect(denied.statusCode).toBe(403);
  });
});
