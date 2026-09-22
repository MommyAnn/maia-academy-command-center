import { beforeAll, afterAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { db } from "../src/db.js";
import { resetDb, loginAs, DEV_USERS } from "./helpers.js";

let app: FastifyInstance;
let studentAId: string;
let batchId: string;
let ownerCookie: string;

beforeAll(async () => {
  await resetDb();
  app = await buildApp();
  studentAId = (await db.student.findUniqueOrThrow({ where: { studentDisplayId: "MAIA-B14-DEV-A" } })).id;
  batchId = (await db.batch.findUniqueOrThrow({ where: { code: "14" } })).id;
  ownerCookie = await loginAs(app, DEV_USERS.owner.email, DEV_USERS.owner.password);
});

afterAll(async () => {
  await app.close();
  await db.$disconnect();
});

async function createSession() {
  const res = await app.inject({
    method: "POST",
    url: "/api/training/sessions",
    headers: { cookie: ownerCookie },
    payload: { title: "Facebook Ads Masterclass", type: "Masterclass", batchId, date: new Date().toISOString(), startTime: "09:00", endTime: "12:00" },
  });
  expect(res.statusCode).toBe(201);
  return res.json().session;
}

describe("Training sessions (spec sections 1-3)", () => {
  it("Owner can create a session; Finance Officer (no Training grant) cannot", async () => {
    const session = await createSession();
    expect(session.sessionDisplayId).toMatch(/^TRN-B14-\d{4}$/);
    expect(session.status).toBe("Draft");

    const financeCookie = await loginAs(app, DEV_USERS.finance.email, DEV_USERS.finance.password);
    const denied = await app.inject({ method: "POST", url: "/api/training/sessions", headers: { cookie: financeCookie }, payload: { title: "x", type: "Workshop", date: new Date().toISOString(), startTime: "09:00", endTime: "10:00" } });
    expect(denied.statusCode).toBe(403);
  });
});

describe("Roster / eligibility + duplicate attendance protection (spec sections 4, 7)", () => {
  it("adding the same student to the roster twice updates eligibility instead of creating a duplicate row", async () => {
    const session = await createSession();
    const first = await app.inject({ method: "POST", url: `/api/training/sessions/${session.id}/roster`, headers: { cookie: ownerCookie }, payload: { studentId: studentAId, eligibility: "Eligible" } });
    expect(first.statusCode).toBe(201);

    const second = await app.inject({ method: "POST", url: `/api/training/sessions/${session.id}/roster`, headers: { cookie: ownerCookie }, payload: { studentId: studentAId, eligibility: "Not Eligible" } });
    expect(second.statusCode).toBe(201);

    const rows = await db.trainingAttendance.findMany({ where: { sessionId: session.id, studentId: studentAId } });
    expect(rows.length).toBe(1);
    expect(rows[0]!.eligibility).toBe("Not Eligible");
  });

  it("Quick Attendance marks and later updates the SAME row — never a second row for the same student+session", async () => {
    const session = await createSession();
    const mark = await app.inject({ method: "POST", url: `/api/training/sessions/${session.id}/attendance`, headers: { cookie: ownerCookie }, payload: { studentId: studentAId, status: "Present" } });
    expect(mark.statusCode).toBe(200);
    expect(mark.json().entry.status).toBe("Present");

    const update = await app.inject({ method: "POST", url: `/api/training/sessions/${session.id}/attendance`, headers: { cookie: ownerCookie }, payload: { studentId: studentAId, status: "Late" } });
    expect(update.statusCode).toBe(200);

    const rows = await db.trainingAttendance.findMany({ where: { sessionId: session.id, studentId: studentAId } });
    expect(rows.length).toBe(1);
    expect(rows[0]!.status).toBe("Late");

    const events = await db.domainEvent.findMany({ where: { type: "TRAINING_ATTENDED", studentId: studentAId } });
    expect(events.some((e) => (e.payloadJson as { sessionId?: string }).sessionId === session.id)).toBe(true);
  });

  it("an unauthorized staff role cannot mark attendance", async () => {
    const session = await createSession();
    const financeCookie = await loginAs(app, DEV_USERS.finance.email, DEV_USERS.finance.password);
    const res = await app.inject({ method: "POST", url: `/api/training/sessions/${session.id}/attendance`, headers: { cookie: financeCookie }, payload: { studentId: studentAId, status: "Present" } });
    expect(res.statusCode).toBe(403);
  });
});

describe("Student Portal My Training (spec section 10)", () => {
  it("Student A sees their own roster entries; Student B does not see Student A's", async () => {
    const session = await createSession();
    await app.inject({ method: "POST", url: `/api/training/sessions/${session.id}/roster`, headers: { cookie: ownerCookie }, payload: { studentId: studentAId } });

    const cookieA = await loginAs(app, DEV_USERS.studentA.email, DEV_USERS.studentA.password);
    const own = await app.inject({ method: "GET", url: `/api/students/${studentAId}/training`, headers: { cookie: cookieA } });
    expect(own.statusCode).toBe(200);
    expect(own.json().training.some((t: { sessionId: string }) => t.sessionId === session.id)).toBe(true);

    const cookieB = await loginAs(app, DEV_USERS.studentB.email, DEV_USERS.studentB.password);
    const crossStudent = await app.inject({ method: "GET", url: `/api/students/${studentAId}/training`, headers: { cookie: cookieB } });
    expect(crossStudent.statusCode).toBe(403);
  });
});
