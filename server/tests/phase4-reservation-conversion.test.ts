import { beforeAll, afterAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { db } from "../src/db.js";
import { resetDb, loginAs, DEV_USERS } from "./helpers.js";

let app: FastifyInstance;
let ownerCookie: string;
let batchId: string;
let packageId: string;

beforeAll(async () => {
  await resetDb();
  app = await buildApp();
  ownerCookie = await loginAs(app, DEV_USERS.owner.email, DEV_USERS.owner.password);
  batchId = (await db.batch.findUniqueOrThrow({ where: { code: "14" } })).id;
  packageId = (await db.package.findUniqueOrThrow({ where: { name: "Premium" } })).id;
});

afterAll(async () => {
  await app.close();
  await db.$disconnect();
});

async function createLead(contactNumber: string) {
  const res = await app.inject({ method: "POST", url: "/api/leads", headers: { cookie: ownerCookie }, payload: { fullName: `Reservation Lead ${Date.now()}`, contactNumber } });
  return res.json().lead;
}

describe("Reservation payment stays on the Finance ledger, and only VERIFIED moves the pipeline (spec sections 30-33, 64)", () => {
  it("a PENDING reservation never bumps the pipeline to RESERVATION_PAID; verifying it does", async () => {
    const lead = await createLead("09173330001");
    const submit = await app.inject({
      method: "POST",
      url: `/api/leads/${lead.id}/reservation-payment`,
      headers: { cookie: ownerCookie },
      payload: { amount: 2000, method: "GCash", batchId, packageId },
    });
    expect(submit.statusCode).toBe(201);
    expect(submit.json().payment.status).toBe("PENDING_VERIFICATION");

    const afterSubmit = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(afterSubmit.pipelineStage).not.toBe("RESERVATION_PAID"); // this is the Phase 2 bug Phase 4 fixes

    const verify = await app.inject({ method: "POST", url: `/api/payments/${submit.json().payment.id}/verify`, headers: { cookie: ownerCookie } });
    expect(verify.statusCode).toBe(200);

    const afterVerify = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(afterVerify.pipelineStage).toBe("RESERVATION_PAID");

    const events = await db.domainEvent.findMany({ where: { type: { in: ["RESERVATION_SUBMITTED", "RESERVATION_VERIFIED"] } } });
    const forThisLead = events.filter((e) => (e.payloadJson as { leadId?: string }).leadId === lead.id);
    expect(forThisLead.map((e) => e.type).sort()).toEqual(["RESERVATION_SUBMITTED", "RESERVATION_VERIFIED"]);
  });

  it("a REJECTED reservation never moves the pipeline either", async () => {
    const lead = await createLead("09173330002");
    const submit = await app.inject({ method: "POST", url: `/api/leads/${lead.id}/reservation-payment`, headers: { cookie: ownerCookie }, payload: { amount: 2000, method: "GCash", batchId, packageId } });
    const reject = await app.inject({ method: "POST", url: `/api/payments/${submit.json().payment.id}/reject`, headers: { cookie: ownerCookie }, payload: { reason: "Reference not found" } });
    expect(reject.statusCode).toBe(200);

    const lead2 = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(lead2.pipelineStage).not.toBe("RESERVATION_PAID");
  });

  it("conversion preview surfaces webinar/reservation history and duplicate signals before confirming", async () => {
    const lead = await createLead("09173330003");
    await app.inject({ method: "POST", url: `/api/leads/${lead.id}/reservation-payment`, headers: { cookie: ownerCookie }, payload: { amount: 2000, method: "GCash", batchId, packageId } });

    const preview = await app.inject({ method: "GET", url: `/api/leads/${lead.id}/conversion-preview`, headers: { cookie: ownerCookie } });
    expect(preview.statusCode).toBe(200);
    expect(preview.json().reservation).not.toBeNull();
    expect(preview.json().alreadyConverted).toBe(false);
  });
});

describe("Lead -> Student conversion transaction safety + idempotency (spec sections 38-39, 62)", () => {
  it("DUPLICATE CONVERSION TEST: converting the same Lead twice never creates a second Student, even under a concurrent double-click", async () => {
    const lead = await createLead("09173330004");
    const payload = { batchId, packageId, discount: 0 };

    const [first, second] = await Promise.all([
      app.inject({ method: "POST", url: `/api/leads/${lead.id}/convert`, headers: { cookie: ownerCookie }, payload }),
      app.inject({ method: "POST", url: `/api/leads/${lead.id}/convert`, headers: { cookie: ownerCookie }, payload }),
    ]);

    const statuses = [first.statusCode, second.statusCode].sort();
    expect(statuses).toEqual([201, 409]);

    const students = await db.student.findMany({ where: { personId: (await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).personId } });
    expect(students.length).toBe(1);
    const enrollments = await db.enrollment.findMany({ where: { studentId: students[0]!.id } });
    expect(enrollments.length).toBe(1);

    // A third, sequential retry after both have resolved is cleanly rejected too.
    const third = await app.inject({ method: "POST", url: `/api/leads/${lead.id}/convert`, headers: { cookie: ownerCookie }, payload });
    expect(third.statusCode).toBe(409);
  });

  it("the Lead is never deleted after conversion, and preserves its full history", async () => {
    const lead = await createLead("09173330005");
    await app.inject({ method: "POST", url: `/api/leads/${lead.id}/convert`, headers: { cookie: ownerCookie }, payload: { batchId, packageId, discount: 0 } });

    const stillExists = await db.lead.findUnique({ where: { id: lead.id } });
    expect(stillExists).not.toBeNull();
    expect(stillExists!.status).toBe("Converted");
    expect(stillExists!.pipelineStage).toBe("ENROLLED");

    const profile = await app.inject({ method: "GET", url: `/api/leads/${lead.id}`, headers: { cookie: ownerCookie } });
    expect(profile.json().lead.conversion).not.toBeNull();
  });
});
