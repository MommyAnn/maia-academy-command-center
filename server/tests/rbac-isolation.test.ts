import { beforeAll, afterAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { db } from "../src/db.js";
import { resetDb, loginAs, DEV_USERS } from "./helpers.js";

let app: FastifyInstance;
let studentAId: string;
let studentBId: string;

beforeAll(async () => {
  await resetDb();
  app = await buildApp();
  studentAId = (await db.student.findUniqueOrThrow({ where: { studentDisplayId: "MAIA-B14-DEV-A" } })).id;
  studentBId = (await db.student.findUniqueOrThrow({ where: { studentDisplayId: "MAIA-B14-DEV-B" } })).id;
});

afterAll(async () => {
  await app.close();
  await db.$disconnect();
});

describe("Server-side role-based access control", () => {
  it("denies an unauthenticated request to a protected route", async () => {
    const res = await app.inject({ method: "GET", url: "/api/students" });
    expect(res.statusCode).toBe(401);
  });

  it("allows Owner (full permission matrix) to list students", async () => {
    const cookie = await loginAs(app, DEV_USERS.owner.email, DEV_USERS.owner.password);
    const res = await app.inject({ method: "GET", url: "/api/students", headers: { cookie } });
    expect(res.statusCode).toBe(200);
    expect(res.json().pagination).toBeDefined();
  });

  it("denies Finance Officer (no Students/EDIT in their seeded matrix) from provisioning a student account", async () => {
    const cookie = await loginAs(app, DEV_USERS.finance.email, DEV_USERS.finance.password);
    const res = await app.inject({ method: "POST", url: `/api/students/${studentAId}/provision-account`, headers: { cookie } });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toContain("Students");
  });

  it("allows Finance Officer to verify a payment (their seeded matrix includes Finance - Payments/VERIFY)", async () => {
    const studentCookie = await loginAs(app, DEV_USERS.studentA.email, DEV_USERS.studentA.password);
    const submit = await app.inject({
      method: "POST",
      url: `/api/students/${studentAId}/payments`,
      headers: { cookie: studentCookie },
      payload: { amount: 5000, method: "GCash", type: "Initial Payment" },
    });
    expect(submit.statusCode).toBe(201);
    const paymentId = submit.json().payment.id;

    const financeCookie = await loginAs(app, DEV_USERS.finance.email, DEV_USERS.finance.password);
    const verify = await app.inject({ method: "POST", url: `/api/payments/${paymentId}/verify`, headers: { cookie: financeCookie } });
    expect(verify.statusCode).toBe(200);
    expect(verify.json().payment.status).toBe("VERIFIED");
  });

  it("a Student session is never granted staff permissions at all, even for a module they'd expect to read", async () => {
    const cookie = await loginAs(app, DEV_USERS.studentA.email, DEV_USERS.studentA.password);
    const res = await app.inject({ method: "GET", url: "/api/students", headers: { cookie } });
    expect(res.statusCode).toBe(403);
  });
});

describe("CRITICAL: student data isolation", () => {
  it("Student A can read their own finance summary", async () => {
    const cookie = await loginAs(app, DEV_USERS.studentA.email, DEV_USERS.studentA.password);
    const res = await app.inject({ method: "GET", url: `/api/students/${studentAId}/finance-summary`, headers: { cookie } });
    expect(res.statusCode).toBe(200);
  });

  it("Student A CANNOT read Student B's finance summary", async () => {
    const cookie = await loginAs(app, DEV_USERS.studentA.email, DEV_USERS.studentA.password);
    const res = await app.inject({ method: "GET", url: `/api/students/${studentBId}/finance-summary`, headers: { cookie } });
    expect(res.statusCode).toBe(403);
  });

  it("Student A CANNOT read Student B's payment history", async () => {
    const cookie = await loginAs(app, DEV_USERS.studentA.email, DEV_USERS.studentA.password);
    const res = await app.inject({ method: "GET", url: `/api/students/${studentBId}/payments`, headers: { cookie } });
    expect(res.statusCode).toBe(403);
  });

  it("Student A CANNOT submit a payment on Student B's behalf", async () => {
    const cookie = await loginAs(app, DEV_USERS.studentA.email, DEV_USERS.studentA.password);
    const res = await app.inject({
      method: "POST",
      url: `/api/students/${studentBId}/payments`,
      headers: { cookie },
      payload: { amount: 1000, method: "Cash", type: "Other" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("Student A CANNOT view Student B's profile record", async () => {
    const cookie = await loginAs(app, DEV_USERS.studentA.email, DEV_USERS.studentA.password);
    const res = await app.inject({ method: "GET", url: `/api/students/${studentBId}`, headers: { cookie } });
    expect(res.statusCode).toBe(403);
  });

  it("Student A CAN view their own profile record", async () => {
    const cookie = await loginAs(app, DEV_USERS.studentA.email, DEV_USERS.studentA.password);
    const res = await app.inject({ method: "GET", url: `/api/students/${studentAId}`, headers: { cookie } });
    expect(res.statusCode).toBe(200);
    expect(res.json().student.studentDisplayId).toBe("MAIA-B14-DEV-A");
  });
});

describe("Secure file storage: ownership-gated signed downloads", () => {
  it("Student A can upload a document and download it via a signed URL", async () => {
    const cookie = await loginAs(app, DEV_USERS.studentA.email, DEV_USERS.studentA.password);
    const upload = await app.inject({
      method: "POST",
      url: `/api/students/${studentAId}/documents`,
      headers: { cookie },
      payload: {
        documentType: "ValidId",
        filename: "id-front.jpg",
        mimeType: "image/jpeg",
        contentBase64: Buffer.from("fake-image-bytes-for-test").toString("base64"),
      },
    });
    expect(upload.statusCode).toBe(201);
    const documentId = upload.json().document.id;

    const signed = await app.inject({ method: "GET", url: `/api/documents/${documentId}/signed-url`, headers: { cookie } });
    expect(signed.statusCode).toBe(200);
    const { url } = signed.json();

    const download = await app.inject({ method: "GET", url });
    expect(download.statusCode).toBe(200);
    expect(download.body).toBe("fake-image-bytes-for-test");
  });

  it("rejects an unsupported file type server-side, even if the client claims otherwise", async () => {
    const cookie = await loginAs(app, DEV_USERS.studentA.email, DEV_USERS.studentA.password);
    const upload = await app.inject({
      method: "POST",
      url: `/api/students/${studentAId}/documents`,
      headers: { cookie },
      payload: {
        documentType: "ValidId",
        filename: "malware.exe",
        mimeType: "application/x-msdownload",
        contentBase64: Buffer.from("not-a-real-image").toString("base64"),
      },
    });
    expect(upload.statusCode).toBe(422);
  });

  it("Student B cannot obtain a signed URL for Student A's document", async () => {
    const cookieA = await loginAs(app, DEV_USERS.studentA.email, DEV_USERS.studentA.password);
    const upload = await app.inject({
      method: "POST",
      url: `/api/students/${studentAId}/documents`,
      headers: { cookie: cookieA },
      payload: { documentType: "ValidId", filename: "id.jpg", mimeType: "image/jpeg", contentBase64: Buffer.from("abc").toString("base64") },
    });
    const documentId = upload.json().document.id;

    const cookieB = await loginAs(app, DEV_USERS.studentB.email, DEV_USERS.studentB.password);
    const signed = await app.inject({ method: "GET", url: `/api/documents/${documentId}/signed-url`, headers: { cookie: cookieB } });
    expect(signed.statusCode).toBe(403);
  });

  it("an expired/forged download token is rejected", async () => {
    const res = await app.inject({ method: "GET", url: "/api/documents/download?token=not-a-real-token" });
    expect(res.statusCode).toBe(403);
  });
});
