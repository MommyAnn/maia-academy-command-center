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

describe("Finance: transaction-ledger derivation rules (spec section 24)", () => {
  it("balance starts at the full package price with zero payments", async () => {
    const cookie = await loginAs(app, DEV_USERS.studentA.email, DEV_USERS.studentA.password);
    const res = await app.inject({ method: "GET", url: `/api/students/${studentAId}/finance-summary`, headers: { cookie } });
    const summary = res.json().summary;
    expect(summary.verifiedPaid).toBe(0);
    expect(summary.status).toBe("Unpaid");
    expect(summary.balance).toBe(summary.netAmountDue);
  });

  it("a PENDING payment does not count toward verifiedPaid or reduce the balance", async () => {
    const cookie = await loginAs(app, DEV_USERS.studentA.email, DEV_USERS.studentA.password);
    const submit = await app.inject({
      method: "POST",
      url: `/api/students/${studentAId}/payments`,
      headers: { cookie },
      payload: { amount: 10000, method: "Bank Transfer", type: "Initial Payment" },
    });
    expect(submit.statusCode).toBe(201);
    expect(submit.json().payment.status).toBe("PENDING_VERIFICATION");

    const summaryRes = await app.inject({ method: "GET", url: `/api/students/${studentAId}/finance-summary`, headers: { cookie } });
    const summary = summaryRes.json().summary;
    expect(summary.verifiedPaid).toBe(0);
    expect(summary.pending).toBe(10000);
    expect(summary.status).toBe("Pending Verification");
  });

  it("verifying the payment moves it into verifiedPaid and reduces the balance by exactly that amount", async () => {
    const studentCookie = await loginAs(app, DEV_USERS.studentA.email, DEV_USERS.studentA.password);
    const before = await app.inject({ method: "GET", url: `/api/students/${studentAId}/finance-summary`, headers: { cookie: studentCookie } });
    const netAmountDue = before.json().summary.netAmountDue;

    const payments = await app.inject({ method: "GET", url: `/api/students/${studentAId}/payments`, headers: { cookie: studentCookie } });
    const pendingPayment = payments.json().payments.find((p: { status: string }) => p.status === "PENDING_VERIFICATION");

    const ownerCookie = await loginAs(app, DEV_USERS.owner.email, DEV_USERS.owner.password);
    const verify = await app.inject({ method: "POST", url: `/api/payments/${pendingPayment.id}/verify`, headers: { cookie: ownerCookie } });
    expect(verify.statusCode).toBe(200);

    const after = await app.inject({ method: "GET", url: `/api/students/${studentAId}/finance-summary`, headers: { cookie: studentCookie } });
    const summary = after.json().summary;
    expect(summary.verifiedPaid).toBe(10000);
    expect(summary.balance).toBe(netAmountDue - 10000);
    expect(summary.status).toBe("Partial Payment");
  });

  it("a REJECTED payment counts toward neither verifiedPaid nor pending", async () => {
    const studentCookie = await loginAs(app, DEV_USERS.studentA.email, DEV_USERS.studentA.password);
    const submit = await app.inject({
      method: "POST",
      url: `/api/students/${studentAId}/payments`,
      headers: { cookie: studentCookie },
      payload: { amount: 500, method: "Cash", type: "Other" },
    });
    const paymentId = submit.json().payment.id;

    const ownerCookie = await loginAs(app, DEV_USERS.owner.email, DEV_USERS.owner.password);
    const reject = await app.inject({
      method: "POST",
      url: `/api/payments/${paymentId}/reject`,
      headers: { cookie: ownerCookie },
      payload: { reason: "Reference number did not match bank record." },
    });
    expect(reject.statusCode).toBe(200);
    expect(reject.json().payment.status).toBe("REJECTED");

    const summaryRes = await app.inject({ method: "GET", url: `/api/students/${studentAId}/finance-summary`, headers: { cookie: studentCookie } });
    // The 500 rejected amount must not appear in either bucket — only the
    // earlier 10000 verified payment should still be counted.
    expect(summaryRes.json().summary.verifiedPaid).toBe(10000);
    expect(summaryRes.json().summary.pending).toBe(0);
  });

  it("cannot verify the same payment twice (status guard, not just a UI disabled-button)", async () => {
    const studentCookie = await loginAs(app, DEV_USERS.studentA.email, DEV_USERS.studentA.password);
    const submit = await app.inject({
      method: "POST",
      url: `/api/students/${studentAId}/payments`,
      headers: { cookie: studentCookie },
      payload: { amount: 100, method: "Cash", type: "Other" },
    });
    const paymentId = submit.json().payment.id;

    const ownerCookie = await loginAs(app, DEV_USERS.owner.email, DEV_USERS.owner.password);
    const first = await app.inject({ method: "POST", url: `/api/payments/${paymentId}/verify`, headers: { cookie: ownerCookie } });
    expect(first.statusCode).toBe(200);

    const second = await app.inject({ method: "POST", url: `/api/payments/${paymentId}/verify`, headers: { cookie: ownerCookie } });
    expect(second.statusCode).toBe(409);
  });

  it("a student can never verify their own payment — the route requires staff permission", async () => {
    const studentCookie = await loginAs(app, DEV_USERS.studentA.email, DEV_USERS.studentA.password);
    const submit = await app.inject({
      method: "POST",
      url: `/api/students/${studentAId}/payments`,
      headers: { cookie: studentCookie },
      payload: { amount: 100, method: "Cash", type: "Other" },
    });
    const paymentId = submit.json().payment.id;

    const selfVerify = await app.inject({ method: "POST", url: `/api/payments/${paymentId}/verify`, headers: { cookie: studentCookie } });
    expect(selfVerify.statusCode).toBe(403);
  });
});
