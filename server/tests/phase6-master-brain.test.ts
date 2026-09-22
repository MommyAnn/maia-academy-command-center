import { beforeAll, afterAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { db } from "../src/db.js";
import { resetDb, loginAs, DEV_USERS } from "./helpers.js";
import { createFakeAnthropicServer } from "./anthropic-fake-server.js";
import { MASTER_BRAIN_SECTION_DEFS } from "../src/modules/ai/validation.js";

let app: FastifyInstance;
let ownerCookie: string;
let studentACookie: string;
let studentAId: string;
const fakeAnthropic = createFakeAnthropicServer(4011);

function fakeMasterBrainJson(overrides: Partial<Record<string, string>> = {}): string {
  const sections = MASTER_BRAIN_SECTION_DEFS.map((def) => ({
    key: def.key,
    title: def.title,
    content: overrides[def.key] ?? `Synthetic generated content for ${def.title}.`,
    bullets: ["Synthetic bullet one", "Synthetic bullet two"],
  }));
  return JSON.stringify({ sections });
}

beforeAll(async () => {
  await fakeAnthropic.start();
  await resetDb();
  app = await buildApp();
  ownerCookie = await loginAs(app, DEV_USERS.owner.email, DEV_USERS.owner.password);
  studentACookie = await loginAs(app, DEV_USERS.studentA.email, DEV_USERS.studentA.password);
  studentAId = (await db.student.findUniqueOrThrow({ where: { studentDisplayId: "MAIA-B14-DEV-A" } })).id;
});

afterAll(async () => {
  await app.close();
  await db.$disconnect();
  await fakeAnthropic.stop();
});

async function createBusiness(cookie: string, studentId: string, name: string) {
  const res = await app.inject({ method: "POST", url: `/api/students/${studentId}/businesses`, headers: { cookie }, payload: { name } });
  expect(res.statusCode).toBe(201);
  return res.json().business;
}

describe("Master Brain E2E (spec section 82): questionnaire -> review -> AI generation -> publish -> version", () => {
  it("runs the full lifecycle with real persistence and ownership", async () => {
    fakeAnthropic.setMode("success");
    fakeAnthropic.setResponseText(fakeMasterBrainJson({ brandOverview: "A synthetic test business overview." }));

    const business = await createBusiness(studentACookie, studentAId, "Synthetic Test Business");

    const save = await app.inject({
      method: "PATCH",
      url: `/api/businesses/${business.id}/master-brain`,
      headers: { cookie: studentACookie },
      payload: { answers: { businessFoundation: { name: "Synthetic Test Business" } }, currentStep: 3, progressPercent: 25 },
    });
    expect(save.statusCode).toBe(200);
    expect(save.json().submission.status).toBe("IN_PROGRESS");

    const submit = await app.inject({ method: "POST", url: `/api/businesses/${business.id}/master-brain/submit`, headers: { cookie: studentACookie } });
    expect(submit.statusCode).toBe(200);
    expect(submit.json().submission.status).toBe("SUBMITTED");
    const submissionId = submit.json().submission.id;

    const startReview = await app.inject({ method: "POST", url: `/api/master-brain/submissions/${submissionId}/start-review`, headers: { cookie: ownerCookie } });
    expect(startReview.json().submission.status).toBe("UNDER_REVIEW");

    const approve = await app.inject({ method: "POST", url: `/api/master-brain/submissions/${submissionId}/approve`, headers: { cookie: ownerCookie } });
    expect(approve.json().submission.status).toBe("APPROVED_FOR_GENERATION");

    const generate = await app.inject({ method: "POST", url: `/api/master-brain/submissions/${submissionId}/generate`, headers: { cookie: ownerCookie } });
    expect(generate.statusCode).toBe(201);
    expect(generate.json().document.generationMethod).toBe("AI_ASSISTED");
    expect(generate.json().document.documentVersion).toBe(1);
    const documentId = generate.json().document.id;

    const afterGenerate = await db.masterBrainSubmission.findUniqueOrThrow({ where: { id: submissionId } });
    expect(afterGenerate.status).toBe("DRAFT_READY");

    const publish = await app.inject({ method: "POST", url: `/api/master-brain/documents/${documentId}/publish`, headers: { cookie: ownerCookie } });
    expect(publish.statusCode).toBe(200);
    expect(publish.json().document.isCurrentPublished).toBe(true);
    expect(publish.json().document.publishedAt).not.toBeNull();

    const afterPublish = await db.masterBrainSubmission.findUniqueOrThrow({ where: { id: submissionId } });
    expect(afterPublish.status).toBe("PUBLISHED");

    // Ownership: this business's Master Brain belongs to the right Student + Business.
    const businessCheck = await db.masterBrainSubmission.findUniqueOrThrow({ where: { id: submissionId } });
    expect(businessCheck.studentId).toBe(studentAId);
    expect(businessCheck.businessId).toBe(business.id);
  });

  it("NEVER silently overwrites a published document — a second generation creates a new version, the old one stays retrievable", async () => {
    fakeAnthropic.setMode("success");
    fakeAnthropic.setResponseText(fakeMasterBrainJson());

    const business = await createBusiness(studentACookie, studentAId, "Version Test Business");
    await app.inject({ method: "PATCH", url: `/api/businesses/${business.id}/master-brain`, headers: { cookie: studentACookie }, payload: { answers: { x: 1 } } });
    const submission = (await app.inject({ method: "POST", url: `/api/businesses/${business.id}/master-brain/submit`, headers: { cookie: studentACookie } })).json().submission;
    await app.inject({ method: "POST", url: `/api/master-brain/submissions/${submission.id}/start-review`, headers: { cookie: ownerCookie } });
    await app.inject({ method: "POST", url: `/api/master-brain/submissions/${submission.id}/approve`, headers: { cookie: ownerCookie } });
    const v1 = (await app.inject({ method: "POST", url: `/api/master-brain/submissions/${submission.id}/generate`, headers: { cookie: ownerCookie } })).json().document;
    await app.inject({ method: "POST", url: `/api/master-brain/documents/${v1.id}/publish`, headers: { cookie: ownerCookie } });

    // Bring it back around for a second generation cycle.
    await db.masterBrainSubmission.update({ where: { id: submission.id }, data: { status: "APPROVED_FOR_GENERATION" } });
    const v2 = (await app.inject({ method: "POST", url: `/api/master-brain/submissions/${submission.id}/generate`, headers: { cookie: ownerCookie } })).json().document;
    expect(v2.documentVersion).toBe(2);
    await app.inject({ method: "POST", url: `/api/master-brain/documents/${v2.id}/publish`, headers: { cookie: ownerCookie } });

    const v1Reloaded = await db.masterBrainDocument.findUniqueOrThrow({ where: { id: v1.id } });
    expect(v1Reloaded.isCurrentPublished).toBe(false); // flipped, never deleted
    const v2Reloaded = await db.masterBrainDocument.findUniqueOrThrow({ where: { id: v2.id } });
    expect(v2Reloaded.isCurrentPublished).toBe(true);

    const allDocuments = await db.masterBrainDocument.findMany({ where: { submissionId: submission.id } });
    expect(allDocuments.length).toBe(2); // both versions retained forever
  });

  it("a Draft automation-review flow never lets generation run before APPROVED_FOR_GENERATION", async () => {
    const business = await createBusiness(studentACookie, studentAId, "Guard Test Business");
    await app.inject({ method: "PATCH", url: `/api/businesses/${business.id}/master-brain`, headers: { cookie: studentACookie }, payload: { answers: {} } });
    const submission = (await app.inject({ method: "GET", url: `/api/businesses/${business.id}/master-brain`, headers: { cookie: studentACookie } })).json().submission;

    const generate = await app.inject({ method: "POST", url: `/api/master-brain/submissions/${submission.id}/generate`, headers: { cookie: ownerCookie } });
    expect(generate.statusCode).toBe(422);
  });
});

describe("Business ownership isolation (spec sections 11, 85)", () => {
  it("Student B cannot read or edit Student A's Master Brain", async () => {
    const business = await createBusiness(studentACookie, studentAId, "Isolation Test Business");
    const studentBCookie = await loginAs(app, DEV_USERS.studentB.email, DEV_USERS.studentB.password);

    const read = await app.inject({ method: "GET", url: `/api/businesses/${business.id}/master-brain`, headers: { cookie: studentBCookie } });
    expect(read.statusCode).toBe(403);

    const write = await app.inject({ method: "PATCH", url: `/api/businesses/${business.id}/master-brain`, headers: { cookie: studentBCookie }, payload: { answers: {} } });
    expect(write.statusCode).toBe(403);
  });

  it("Student B cannot list Student A's businesses", async () => {
    const studentBCookie = await loginAs(app, DEV_USERS.studentB.email, DEV_USERS.studentB.password);
    const res = await app.inject({ method: "GET", url: `/api/students/${studentAId}/businesses`, headers: { cookie: studentBCookie } });
    expect(res.statusCode).toBe(403);
  });
});

describe("Security: publish/edit endpoints are staff-permission-gated (spec section 90)", () => {
  it("a Student cannot publish or manually edit a Master Brain document", async () => {
    fakeAnthropic.setMode("success");
    fakeAnthropic.setResponseText(fakeMasterBrainJson());
    const business = await createBusiness(studentACookie, studentAId, "Security Test Business");
    await app.inject({ method: "PATCH", url: `/api/businesses/${business.id}/master-brain`, headers: { cookie: studentACookie }, payload: { answers: {} } });
    const submission = (await app.inject({ method: "GET", url: `/api/businesses/${business.id}/master-brain`, headers: { cookie: studentACookie } })).json().submission;
    await db.masterBrainSubmission.update({ where: { id: submission.id }, data: { status: "APPROVED_FOR_GENERATION" } });
    const document = (await app.inject({ method: "POST", url: `/api/master-brain/submissions/${submission.id}/generate`, headers: { cookie: ownerCookie } })).json().document;

    const patch = await app.inject({ method: "PATCH", url: `/api/master-brain/documents/${document.id}`, headers: { cookie: studentACookie }, payload: { sections: [] } });
    expect(patch.statusCode).toBe(403);

    const publish = await app.inject({ method: "POST", url: `/api/master-brain/documents/${document.id}/publish`, headers: { cookie: studentACookie } });
    expect(publish.statusCode).toBe(403);
  });
});
