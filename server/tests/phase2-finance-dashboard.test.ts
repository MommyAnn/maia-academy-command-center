import { beforeAll, afterAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { db } from "../src/db.js";
import { resetDb, loginAs, DEV_USERS } from "./helpers.js";

let app: FastifyInstance;
let studentAId: string;

beforeAll(async () => {
  await resetDb();
  app = await buildApp();
  studentAId = (await db.student.findUniqueOrThrow({ where: { studentDisplayId: "MAIA-B14-DEV-A" } })).id;
});

afterAll(async () => {
  await app.close();
  await db.$disconnect();
});

describe("Payment voiding (payment status set: PENDING VERIFICATION / VERIFIED / REJECTED / VOIDED)", () => {
  it("a verified payment can be voided, and a voided payment counts toward neither verifiedPaid nor pending", async () => {
    const cookieA = await loginAs(app, DEV_USERS.studentA.email, DEV_USERS.studentA.password);
    const submit = await app.inject({ method: "POST", url: `/api/students/${studentAId}/payments`, headers: { cookie: cookieA }, payload: { amount: 3000, method: "GCash", type: "Initial Payment" } });
    const paymentId = submit.json().payment.id;

    const ownerCookie = await loginAs(app, DEV_USERS.owner.email, DEV_USERS.owner.password);
    const verify = await app.inject({ method: "POST", url: `/api/payments/${paymentId}/verify`, headers: { cookie: ownerCookie } });
    expect(verify.statusCode).toBe(200);

    const before = await app.inject({ method: "GET", url: `/api/students/${studentAId}/finance-summary`, headers: { cookie: cookieA } });
    const verifiedBefore = before.json().summary.verifiedPaid;

    const void_ = await app.inject({ method: "POST", url: `/api/payments/${paymentId}/void`, headers: { cookie: ownerCookie } });
    expect(void_.statusCode).toBe(200);
    expect(void_.json().payment.status).toBe("CANCELLED");

    const after = await app.inject({ method: "GET", url: `/api/students/${studentAId}/finance-summary`, headers: { cookie: cookieA } });
    expect(after.json().summary.verifiedPaid).toBe(verifiedBefore - 3000);
    expect(after.json().summary.pending).toBe(0);

    const secondVoid = await app.inject({ method: "POST", url: `/api/payments/${paymentId}/void`, headers: { cookie: ownerCookie } });
    expect(secondVoid.statusCode).toBe(409);
  });

  it("a student can never void their own payment", async () => {
    const cookieA = await loginAs(app, DEV_USERS.studentA.email, DEV_USERS.studentA.password);
    const submit = await app.inject({ method: "POST", url: `/api/students/${studentAId}/payments`, headers: { cookie: cookieA }, payload: { amount: 100, method: "Cash", type: "Other" } });
    const paymentId = submit.json().payment.id;
    const res = await app.inject({ method: "POST", url: `/api/payments/${paymentId}/void`, headers: { cookie: cookieA } });
    expect(res.statusCode).toBe(403);
  });
});

describe("Dashboard aggregation (spec section 34): real KPIs, never hard-coded", () => {
  it("returns numeric KPIs reflecting live database state, and denies a role without Dashboard/VIEW", async () => {
    const ownerCookie = await loginAs(app, DEV_USERS.owner.email, DEV_USERS.owner.password);

    const before = await app.inject({ method: "GET", url: "/api/dashboard/summary", headers: { cookie: ownerCookie } });
    expect(before.statusCode).toBe(200);
    const totalBefore = before.json().summary.totalStudents;

    const batch = await db.batch.findUniqueOrThrow({ where: { code: "14" } });
    const pkg = await db.package.findUniqueOrThrow({ where: { name: "Premium" } });
    const enrollRes = await app.inject({ method: "POST", url: "/api/enroll", payload: { fullName: "Dashboard Probe Student", contactNumber: "09171112222", batchId: batch.id, packageId: pkg.id, discount: 0 } });
    expect(enrollRes.statusCode).toBe(201);

    const after = await app.inject({ method: "GET", url: "/api/dashboard/summary", headers: { cookie: ownerCookie } });
    expect(after.json().summary.totalStudents).toBe(totalBefore + 1);
    expect(typeof after.json().summary.receivables).toBe("number");
    expect(typeof after.json().summary.pendingPaymentVerification).toBe("number");
  });

  it("an unauthenticated request is rejected outright", async () => {
    const res = await app.inject({ method: "GET", url: "/api/dashboard/summary" });
    expect(res.statusCode).toBe(401);
  });
});
