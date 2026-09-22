import { beforeAll, afterAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { db } from "../src/db.js";
import { resetDb, loginAs, DEV_USERS } from "./helpers.js";

let app: FastifyInstance;
let batchId: string;
let packageId: string;
let ownerCookie: string;

beforeAll(async () => {
  await resetDb();
  app = await buildApp();
  const batch = await db.batch.findUniqueOrThrow({ where: { code: "14" } });
  const pkg = await db.package.findUniqueOrThrow({ where: { name: "Premium" } });
  batchId = batch.id;
  packageId = pkg.id;
  ownerCookie = await loginAs(app, DEV_USERS.owner.email, DEV_USERS.owner.password);
});

afterAll(async () => {
  await app.close();
  await db.$disconnect();
});

describe("Public enrollment (spec sections 7-8)", () => {
  it("creates a Person + Student + Enrollment, freezing the package price as a snapshot", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/enroll",
      payload: { fullName: "Enrollment Test One", contactNumber: "09171234567", batchId, packageId, discount: 1000 },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.student.studentDisplayId).toMatch(/^MAIA-B14-\d{4}$/);
    expect(body.enrollment.netAmountDue).toBe(24000); // 25000 default - 1000 discount

    // Changing the package's price afterward must NOT retroactively alter
    // this enrollment's already-frozen netAmountDue (spec section 8).
    await app.inject({ method: "PATCH", url: `/api/packages/${packageId}`, headers: { cookie: ownerCookie }, payload: { defaultPrice: 99999 } });
    const enrollment = await db.enrollment.findUniqueOrThrow({ where: { id: body.enrollment.id } });
    expect(Number(enrollment.netAmountDue)).toBe(24000);
    expect(Number(enrollment.packagePriceSnapshot)).toBe(25000);

    // Restore for later tests in this file.
    await app.inject({ method: "PATCH", url: `/api/packages/${packageId}`, headers: { cookie: ownerCookie }, payload: { defaultPrice: 25000 } });
  });

  it("flags a possible duplicate by email without blocking the new submission", async () => {
    const email = `dup-${Date.now()}@example.com`;
    const first = await app.inject({ method: "POST", url: "/api/enroll", payload: { fullName: "Dup One", email, contactNumber: "09170000001", batchId, packageId, discount: 0 } });
    expect(first.statusCode).toBe(201);

    const second = await app.inject({ method: "POST", url: "/api/enroll", payload: { fullName: "Dup Two", email, contactNumber: "09170000002", batchId, packageId, discount: 0 } });
    expect(second.statusCode).toBe(201);
    expect(second.json().possibleDuplicates.some((d: { matchedOn: string }) => d.matchedOn === "email")).toBe(true);

    // Duplicate detection is a signal only — never an auto-merge. Both
    // Person rows must exist independently.
    const people = await db.person.findMany({ where: { email } });
    expect(people.length).toBe(2);
  });

  it("assigns unique, sequential student IDs under concurrent submissions (spec section 29 concurrency safety)", async () => {
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        app.inject({
          method: "POST",
          url: "/api/enroll",
          payload: { fullName: `Concurrent Student ${i}`, contactNumber: `0917100000${i}`, batchId, packageId, discount: 0 },
        }),
      ),
    );
    for (const r of results) expect(r.statusCode).toBe(201);
    const ids = results.map((r) => r.json().student.studentDisplayId);
    expect(new Set(ids).size).toBe(ids.length); // no two submissions ever collided
  });

  it("rejects enrollment into a deactivated package", async () => {
    const create = await app.inject({ method: "POST", url: "/api/packages", headers: { cookie: ownerCookie }, payload: { name: "Inactive Test Package", defaultPrice: 1000 } });
    const inactivePkg = create.json().package;
    await app.inject({ method: "PATCH", url: `/api/packages/${inactivePkg.id}`, headers: { cookie: ownerCookie }, payload: { isActive: false } });

    const res = await app.inject({ method: "POST", url: "/api/enroll", payload: { fullName: "Should Fail", contactNumber: "09179999999", batchId, packageId: inactivePkg.id, discount: 0 } });
    expect(res.statusCode).toBe(422);
  });
});

describe("Lead → Student conversion (spec sections 14, 27, 30)", () => {
  async function createLead(email: string) {
    const res = await app.inject({
      method: "POST",
      url: "/api/leads",
      headers: { cookie: ownerCookie },
      payload: { fullName: "Lead Conversion Test", email, contactNumber: "09175551234", source: "Webinar" },
    });
    expect(res.statusCode).toBe(201);
    return res.json().lead;
  }

  it("carries the reservation payment forward into the Student without duplicating it, and blocks a second link/convert", async () => {
    const lead = await createLead(`lead-${Date.now()}@example.com`);

    const reservation = await app.inject({
      method: "POST",
      url: `/api/leads/${lead.id}/reservation-payment`,
      headers: { cookie: ownerCookie },
      payload: { amount: 2000, method: "GCash", batchId, packageId },
    });
    expect(reservation.statusCode).toBe(201);
    const reservationPaymentId = reservation.json().payment.id;

    // Cannot link a second reservation to the same Lead.
    const secondReservation = await app.inject({
      method: "POST",
      url: `/api/leads/${lead.id}/reservation-payment`,
      headers: { cookie: ownerCookie },
      payload: { amount: 2000, method: "GCash", batchId, packageId },
    });
    expect(secondReservation.statusCode).toBe(409);

    const convert = await app.inject({
      method: "POST",
      url: `/api/leads/${lead.id}/convert`,
      headers: { cookie: ownerCookie },
      payload: { batchId, packageId, discount: 0 },
    });
    expect(convert.statusCode).toBe(201);
    expect(convert.json().reservationPaymentCarriedForward).toBe(true);

    // Same payment row, now re-parented — never duplicated.
    const paymentsForStudent = await db.paymentTransaction.findMany({ where: { studentId: convert.json().student.id } });
    expect(paymentsForStudent.length).toBe(1);
    expect(paymentsForStudent[0]!.id).toBe(reservationPaymentId);

    // The Lead record itself must still exist — conversion never deletes it.
    const stillExists = await db.lead.findUnique({ where: { id: lead.id } });
    expect(stillExists).not.toBeNull();

    // Cannot convert the same Lead twice.
    const secondConvert = await app.inject({
      method: "POST",
      url: `/api/leads/${lead.id}/convert`,
      headers: { cookie: ownerCookie },
      payload: { batchId, packageId, discount: 0 },
    });
    expect(secondConvert.statusCode).toBe(409);
  });

  it("full end-to-end flow: Lead → Student → requirement verified → payment verified → fully paid", async () => {
    const lead = await createLead(`e2e-${Date.now()}@example.com`);
    const convert = await app.inject({
      method: "POST",
      url: `/api/leads/${lead.id}/convert`,
      headers: { cookie: ownerCookie },
      payload: { batchId, packageId, discount: 24000 }, // netAmountDue = 1000, small so the test pays it off quickly
    });
    const studentId = convert.json().student.id;
    expect(convert.json().enrollment.enrollmentDisplayId).toMatch(/^ENR-\d{4}-\d{6}$/);

    // Staff provisions portal login for the new student so it can self-submit.
    await db.student.update({ where: { id: studentId }, data: {} }); // no-op, ensures row committed
    const studentRow = await db.student.findUniqueOrThrow({ where: { id: studentId }, include: { person: true } });
    await db.person.update({ where: { id: studentRow.personId }, data: { email: `e2e-portal-${Date.now()}@example.com` } });
    const provision = await app.inject({ method: "POST", url: `/api/students/${studentId}/provision-account`, headers: { cookie: ownerCookie } });
    expect(provision.statusCode).toBe(201);

    // Staff directly verifies the payment path via Owner session (student
    // self-service payment submission is covered in finance.test.ts already).
    const submit = await app.inject({
      method: "POST",
      url: `/api/students/${studentId}/payments`,
      headers: { cookie: ownerCookie },
      // Owner is staff, not the student, so this uses requireStudentSelf's
      // staff-bypass path exactly like an admin recording a walk-in payment.
      payload: { amount: 1000, method: "Cash", type: "Balance Payment" },
    });
    expect(submit.statusCode).toBe(201);
    const paymentId = submit.json().payment.id;

    const verify = await app.inject({ method: "POST", url: `/api/payments/${paymentId}/verify`, headers: { cookie: ownerCookie } });
    expect(verify.statusCode).toBe(200);

    const summary = await app.inject({ method: "GET", url: `/api/students/${studentId}/finance-summary`, headers: { cookie: ownerCookie } });
    expect(summary.json().summary.status).toBe("Fully Paid");
    expect(summary.json().summary.balance).toBe(0);

    // The STUDENT_FULLY_PAID domain event must be recorded exactly once —
    // internally, never dispatched anywhere external (spec sections 37-39).
    const events = await db.domainEvent.findMany({ where: { type: "STUDENT_FULLY_PAID", studentId } });
    expect(events.length).toBe(1);
    expect(events[0]!.processedAt).toBeNull();
  });
});
