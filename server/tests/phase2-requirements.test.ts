import { beforeAll, afterAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { db } from "../src/db.js";
import { resetDb, loginAs, DEV_USERS } from "./helpers.js";

let app: FastifyInstance;
let studentAId: string;
let studentBId: string;

async function uploadDoc(cookie: string, studentId: string, documentType: "ValidId" | "PaymentProof") {
  const res = await app.inject({
    method: "POST",
    url: `/api/students/${studentId}/documents`,
    headers: { cookie },
    payload: { documentType, filename: `${documentType}.jpg`, mimeType: "image/jpeg", contentBase64: Buffer.from(`${documentType}-bytes`).toString("base64") },
  });
  expect(res.statusCode).toBe(201);
  return res.json().document.id as string;
}

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

describe("Requirements workflow (spec sections 12, 36)", () => {
  it("Student A submits a requirement, an unauthorized staff role cannot verify it, but Owner can", async () => {
    const cookieA = await loginAs(app, DEV_USERS.studentA.email, DEV_USERS.studentA.password);
    const docId = await uploadDoc(cookieA, studentAId, "ValidId");

    const submit = await app.inject({ method: "POST", url: `/api/students/${studentAId}/requirements/ValidId/submit`, headers: { cookie: cookieA }, payload: { documentId: docId } });
    expect(submit.statusCode).toBe(201);
    expect(submit.json().requirement.status).toBe("PENDING");

    // Finance Officer's seeded matrix has Students: VIEW only, no VERIFY —
    // the same "unauthorized staff verifying" case as the payment matrix.
    const financeCookie = await loginAs(app, DEV_USERS.finance.email, DEV_USERS.finance.password);
    const deniedVerify = await app.inject({ method: "POST", url: `/api/requirements/${submit.json().requirement.id}/verify`, headers: { cookie: financeCookie } });
    expect(deniedVerify.statusCode).toBe(403);

    const ownerCookie = await loginAs(app, DEV_USERS.owner.email, DEV_USERS.owner.password);
    const verify = await app.inject({ method: "POST", url: `/api/requirements/${submit.json().requirement.id}/verify`, headers: { cookie: ownerCookie } });
    expect(verify.statusCode).toBe(200);
    expect(verify.json().requirement.status).toBe("VERIFIED");
  });

  it("Student A cannot submit a requirement on Student B's behalf", async () => {
    const cookieA = await loginAs(app, DEV_USERS.studentA.email, DEV_USERS.studentA.password);
    const docId = await uploadDoc(cookieA, studentAId, "PaymentProof");
    const res = await app.inject({ method: "POST", url: `/api/students/${studentBId}/requirements/PaymentProof/submit`, headers: { cookie: cookieA }, payload: { documentId: docId } });
    expect(res.statusCode).toBe(403);
  });

  it("rejection stores a reason, and a resubmission preserves the full review trail instead of erasing it", async () => {
    const cookieA = await loginAs(app, DEV_USERS.studentA.email, DEV_USERS.studentA.password);
    const docId1 = await uploadDoc(cookieA, studentAId, "PaymentProof");
    const submit1 = await app.inject({ method: "POST", url: `/api/students/${studentAId}/requirements/PaymentProof/submit`, headers: { cookie: cookieA }, payload: { documentId: docId1 } });
    const requirementId = submit1.json().requirement.id;

    const ownerCookie = await loginAs(app, DEV_USERS.owner.email, DEV_USERS.owner.password);
    const reject = await app.inject({ method: "POST", url: `/api/requirements/${requirementId}/reject`, headers: { cookie: ownerCookie }, payload: { reason: "Blurry image" } });
    expect(reject.statusCode).toBe(200);
    expect(reject.json().requirement.status).toBe("REJECTED");

    const docId2 = await uploadDoc(cookieA, studentAId, "PaymentProof");
    const resubmit = await app.inject({ method: "POST", url: `/api/students/${studentAId}/requirements/PaymentProof/submit`, headers: { cookie: cookieA }, payload: { documentId: docId2 } });
    expect(resubmit.statusCode).toBe(201);
    expect(resubmit.json().requirement.status).toBe("PENDING");
    expect(resubmit.json().requirement.id).toBe(requirementId); // same requirement row, upserted by [studentId, type]

    const list = await app.inject({ method: "GET", url: `/api/students/${studentAId}/requirements`, headers: { cookie: cookieA } });
    const paymentProofReq = list.json().requirements.find((r: { type: string }) => r.type === "PaymentProof");
    // Append-only: the original PENDING review, the REJECTED review, and the
    // new PENDING review from the resubmission must ALL still be present.
    expect(paymentProofReq.reviews.length).toBe(3);
    expect(paymentProofReq.reviews.map((r: { status: string }) => r.status)).toEqual(["PENDING", "REJECTED", "PENDING"]);
    expect(paymentProofReq.reviews.some((r: { reason: string | null }) => r.reason === "Blurry image")).toBe(true);
  });
});

describe("Admin notes (spec section 32: staff-only, students must never see them)", () => {
  it("a Student session cannot reach the notes routes at all", async () => {
    const cookieA = await loginAs(app, DEV_USERS.studentA.email, DEV_USERS.studentA.password);
    const get = await app.inject({ method: "GET", url: `/api/students/${studentAId}/notes`, headers: { cookie: cookieA } });
    expect(get.statusCode).toBe(403);
    const post = await app.inject({ method: "POST", url: `/api/students/${studentAId}/notes`, headers: { cookie: cookieA }, payload: { note: "trying to see my own note" } });
    expect(post.statusCode).toBe(403);
  });

  it("Finance Officer (Students: VIEW only) can read notes but cannot add one; Owner can do both", async () => {
    const financeCookie = await loginAs(app, DEV_USERS.finance.email, DEV_USERS.finance.password);
    const deniedPost = await app.inject({ method: "POST", url: `/api/students/${studentAId}/notes`, headers: { cookie: financeCookie }, payload: { note: "Should be denied" } });
    expect(deniedPost.statusCode).toBe(403);

    const ownerCookie = await loginAs(app, DEV_USERS.owner.email, DEV_USERS.owner.password);
    const create = await app.inject({ method: "POST", url: `/api/students/${studentAId}/notes`, headers: { cookie: ownerCookie }, payload: { note: "Called to confirm batch schedule." } });
    expect(create.statusCode).toBe(201);

    const financeRead = await app.inject({ method: "GET", url: `/api/students/${studentAId}/notes`, headers: { cookie: financeCookie } });
    expect(financeRead.statusCode).toBe(200);
    expect(financeRead.json().notes.length).toBeGreaterThan(0);
  });
});

describe("Activity history (spec section 33): reads durable records only", () => {
  it("Student A can read their own activity, Student B cannot read Student A's", async () => {
    const cookieA = await loginAs(app, DEV_USERS.studentA.email, DEV_USERS.studentA.password);
    const own = await app.inject({ method: "GET", url: `/api/students/${studentAId}/activity`, headers: { cookie: cookieA } });
    expect(own.statusCode).toBe(200);
    // The requirement/reject/resubmit/note actions from the tests above must
    // all be present as real, previously-written rows — never fabricated.
    const actions = own.json().activity.map((a: { action: string }) => a.action);
    expect(actions).toContain("Requirement Submitted");
    expect(actions).toContain("Requirement Rejected");

    const cookieB = await loginAs(app, DEV_USERS.studentB.email, DEV_USERS.studentB.password);
    const crossStudent = await app.inject({ method: "GET", url: `/api/students/${studentAId}/activity`, headers: { cookie: cookieB } });
    expect(crossStudent.statusCode).toBe(403);
  });
});
