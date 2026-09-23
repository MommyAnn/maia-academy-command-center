import { beforeAll, afterAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { db } from "../src/db.js";
import { resetDb, loginAs, DEV_USERS } from "./helpers.js";
import { createFakeAnthropicServer } from "./anthropic-fake-server.js";
import { runDispatcherSweep } from "../src/modules/automation/dispatcher.js";
import { advanceRun } from "../src/modules/automation/executor.js";
import { validateFlow } from "../src/modules/automation/validator.js";
import { ACTION_TYPES } from "../src/modules/automation/flow.js";

let app: FastifyInstance;
let ownerCookie: string;
let studentACookie: string;
let studentBCookie: string;
let studentAId: string;
let ownerUserId: string;
const fakeAnthropic = createFakeAnthropicServer(4011);

beforeAll(async () => {
  await fakeAnthropic.start();
  await resetDb();
  app = await buildApp();
  ownerCookie = await loginAs(app, DEV_USERS.owner.email, DEV_USERS.owner.password);
  studentACookie = await loginAs(app, DEV_USERS.studentA.email, DEV_USERS.studentA.password);
  studentBCookie = await loginAs(app, DEV_USERS.studentB.email, DEV_USERS.studentB.password);
  studentAId = (await db.student.findUniqueOrThrow({ where: { studentDisplayId: "MAIA-B14-DEV-A" } })).id;
  const ownerUser = await db.user.findFirstOrThrow({ where: { person: { fullName: "Mommy Ann (Dev Seed)" } } });
  ownerUserId = ownerUser.id;
  // The dev seed creates no Staff rows at all — CREATE_TASK's real Task.createdById/assignedToId FK to Staff (never User) needs one to exist.
  await db.staff.upsert({ where: { personId: ownerUser.personId }, update: {}, create: { personId: ownerUser.personId, roleId: ownerUser.roleId, status: "ACTIVE" } });
});

afterAll(async () => {
  await app.close();
  await db.$disconnect();
  await fakeAnthropic.stop();
});

async function createPublishedBusiness(cookie: string, studentId: string, name: string, overview = "Synthetic overview") {
  const businessRes = await app.inject({ method: "POST", url: `/api/students/${studentId}/businesses`, headers: { cookie }, payload: { name } });
  const business = businessRes.json().business;

  await app.inject({ method: "PATCH", url: `/api/businesses/${business.id}/master-brain`, headers: { cookie }, payload: { answers: { x: 1 } } });
  const submission = (await app.inject({ method: "GET", url: `/api/businesses/${business.id}/master-brain`, headers: { cookie } })).json().submission;
  await db.masterBrainSubmission.update({ where: { id: submission.id }, data: { status: "APPROVED_FOR_GENERATION" } });

  fakeAnthropic.setMode("success");
  fakeAnthropic.setResponseText(JSON.stringify({ sections: [{ key: "brandOverview", title: "1. Brand Overview", content: overview, bullets: [] }] }));
  const document = (await app.inject({ method: "POST", url: `/api/master-brain/submissions/${submission.id}/generate`, headers: { cookie: ownerCookie } })).json().document;
  await app.inject({ method: "POST", url: `/api/master-brain/documents/${document.id}/publish`, headers: { cookie: ownerCookie } });

  return business;
}

async function createLead(cookie: string, fullName: string) {
  const res = await app.inject({
    method: "POST",
    url: "/api/leads",
    headers: { cookie },
    payload: { fullName, email: `${fullName.replace(/\s/g, "").toLowerCase()}-${Date.now()}@example.com`, contactNumber: "09171234567", source: "Webinar" },
  });
  expect(res.statusCode).toBe(201);
  return res.json().lead;
}

describe("Payment safety — the action library has no way to touch a payment (spec sections 19-21)", () => {
  it("ACTION_TYPES never contains a verify/refund/delete/mass-message/access-change action", () => {
    const forbidden = ["VERIFY_PAYMENT", "REFUND", "DELETE_RECORD", "MASS_MESSAGE", "CHANGE_FINANCIAL_STATUS", "CHANGE_ACCESS", "MARK_PAID"];
    for (const f of forbidden) expect(ACTION_TYPES as readonly string[]).not.toContain(f);
  });
});

describe("Flow Validator — structural safety (spec sections 33, 46-47)", () => {
  it("blocks a zero-delay cycle but allows a delay-guarded recurring loop", async () => {
    const unsafeFlow = {
      nodes: [
        { id: "start", type: "START", config: {} },
        { id: "cond", type: "CONDITION", config: { group: { op: "AND", rules: [] } } },
      ],
      edges: [
        { from: "start", to: "cond" },
        { from: "cond", to: "cond", branch: "NO" },
      ],
    };
    const result = await validateFlow(unsafeFlow as never, { skipDbChecks: true });
    expect(result.blocking).toBe(true);
    expect(result.issues.some((i) => i.code === "INFINITE_LOOP")).toBe(true);

    const safeFlow = {
      nodes: [
        { id: "start", type: "START", config: {} },
        { id: "delay", type: "DELAY", config: { amount: 1, unit: "DAYS" } },
        { id: "cond", type: "CONDITION", config: { group: { op: "AND", rules: [] } } },
        { id: "exit", type: "EXIT", config: {} },
      ],
      edges: [
        { from: "start", to: "delay" },
        { from: "delay", to: "cond" },
        { from: "cond", to: "delay", branch: "NO" },
        { from: "cond", to: "exit", branch: "YES" },
      ],
    };
    const result2 = await validateFlow(safeFlow as never, { skipDbChecks: true });
    expect(result2.issues.some((i) => i.code === "INFINITE_LOOP")).toBe(false);
  });

  it("flags a missing start, missing exit, and a dead end together", async () => {
    const flow = { nodes: [{ id: "a", type: "ACTION", config: { actionType: "ADD_TAG", tag: "x" } }], edges: [] };
    const result = await validateFlow(flow as never, { skipDbChecks: true });
    const codes = result.issues.map((i) => i.code);
    expect(codes).toEqual(expect.arrayContaining(["MISSING_START", "MISSING_EXIT", "DEAD_END"]));
    expect(result.blocking).toBe(true);
  });
});

describe("Phase 12 M.A.I.A. Automation Studio — full pipeline (spec sections 9-12, 35-42)", () => {
  it("creates -> validates -> submits -> approves -> publishes -> activates, then a real DomainEvent triggers exactly one idempotent run", async () => {
    const business = await createPublishedBusiness(studentACookie, studentAId, "Automation Pipeline Business");
    const journeyRes = await app.inject({
      method: "POST",
      url: `/api/students/${studentAId}/journeys`,
      headers: { cookie: studentACookie },
      payload: { businessId: business.id, name: "Lead Nurture Journey", stages: [{ stageName: "Lead" }] },
    });
    expect(journeyRes.statusCode).toBe(201);
    const journey = journeyRes.json().journey;

    const flow = {
      nodes: [
        { id: "start", type: "START", config: {} },
        { id: "task", type: "ACTION", config: { actionType: "CREATE_TASK", title: "Follow up with new lead", assignedToId: ownerUserId } },
        { id: "exit", type: "EXIT", config: {} },
      ],
      edges: [
        { from: "start", to: "task" },
        { from: "task", to: "exit" },
      ],
    };
    const createRes = await app.inject({
      method: "POST",
      url: `/api/students/${studentAId}/automations`,
      headers: { cookie: studentACookie },
      payload: { businessId: business.id, journeyId: journey.id, name: "New Lead Task", flow, triggerType: "LEAD_CREATED" },
    });
    expect(createRes.statusCode).toBe(201);
    const automation = createRes.json().automation;
    expect(automation.automationDisplayId).toMatch(/^AUTO-\d{4}-\d{6}$/);
    expect(automation.readiness).toBe("READY_FOR_TEST");
    expect(automation.status).toBe("DRAFT");

    const submitRes = await app.inject({ method: "POST", url: `/api/automations/${automation.id}/submit-for-review`, headers: { cookie: studentACookie } });
    expect(submitRes.statusCode).toBe(200);
    expect(submitRes.json().automation.status).toBe("FOR_REVIEW");

    // A Student may never approve their own automation — only staff holding Automation Studio / VERIFY may.
    const selfApprove = await app.inject({ method: "POST", url: `/api/automations/${automation.id}/approve`, headers: { cookie: studentACookie } });
    expect(selfApprove.statusCode).toBe(403);

    const approveRes = await app.inject({ method: "POST", url: `/api/automations/${automation.id}/approve`, headers: { cookie: ownerCookie } });
    expect(approveRes.statusCode).toBe(200);
    expect(approveRes.json().automation.status).toBe("APPROVED");

    const publishRes = await app.inject({ method: "POST", url: `/api/automations/${automation.id}/publish`, headers: { cookie: ownerCookie } });
    expect(publishRes.statusCode).toBe(200);
    expect(publishRes.json().automation.status).toBe("PUBLISHED");

    const activateRes = await app.inject({ method: "POST", url: `/api/automations/${automation.id}/activate`, headers: { cookie: ownerCookie } });
    expect(activateRes.statusCode).toBe(200);
    expect(activateRes.json().automation.status).toBe("ACTIVE");
    expect(activateRes.json().automation.readiness).toBe("ACTIVE");

    // Real trigger — POST /api/leads already records a real LEAD_CREATED DomainEvent (leads/routes.ts) — the SAME table every other phase writes to; nothing extra is recorded here.
    const lead = await createLead(ownerCookie, "New Automation Lead");

    const sweep1 = await runDispatcherSweep();
    expect(sweep1.matched).toBeGreaterThanOrEqual(1);

    const runs = await db.automationRun.findMany({ where: { automationId: automation.id } });
    expect(runs).toHaveLength(1);
    expect(runs[0]!.status).toBe("COMPLETED");
    expect(runs[0]!.entityType).toBe("Lead");
    expect(runs[0]!.entityId).toBe(lead.id);
    expect(runs[0]!.runDisplayId).toMatch(/^RUN-\d{4}-\d{6}$/);

    const steps = await db.automationRunStep.findMany({ where: { runId: runs[0]!.id } });
    expect(steps.find((s) => s.nodeId === "task")?.status).toBe("COMPLETED");

    const task = await db.task.findFirst({ where: { autoTriggerKey: `automation-run:${runs[0]!.id}:task` } });
    expect(task).not.toBeNull();
    expect(task!.title).toBe("Follow up with new lead");

    // Idempotency (spec section 34): sweeping again must never create a second run for the same DomainEvent.
    await runDispatcherSweep();
    const runsAfter = await db.automationRun.findMany({ where: { automationId: automation.id } });
    expect(runsAfter).toHaveLength(1);

    // Pausing stops new runs from being created for new events.
    const pauseRes = await app.inject({ method: "POST", url: `/api/automations/${automation.id}/pause`, headers: { cookie: studentACookie } });
    expect(pauseRes.statusCode).toBe(200);
    await createLead(ownerCookie, "Second Lead After Pause");
    await runDispatcherSweep();
    const runsAfterPause = await db.automationRun.findMany({ where: { automationId: automation.id } });
    expect(runsAfterPause).toHaveLength(1);

    // Approved-package-style versioning: editing after PUBLISHED spins a new DRAFT version, current stays untouched.
    const newVersionRes = await app.inject({ method: "POST", url: `/api/automations/${automation.id}/versions`, headers: { cookie: studentACookie }, payload: { changeNotes: "v2 draft" } });
    expect(newVersionRes.statusCode).toBe(201);
    expect(newVersionRes.json().version.versionNumber).toBe(2);
    expect(newVersionRes.json().version.status).toBe("DRAFT");
    const automationAfter = await db.automation.findUniqueOrThrow({ where: { id: automation.id } });
    expect(automationAfter.currentVersionId).not.toBe(newVersionRes.json().version.id); // still pointing at the live v1
  });
});

describe("DELAY node — yields WAITING and resumes without recomputing (spec sections 26, 34, 48)", () => {
  it("a TEST MODE run waits at a DELAY node, then completes once resumeAt has passed, with no real side effect", async () => {
    const business = await createPublishedBusiness(studentACookie, studentAId, "Delay Test Business");
    const flow = {
      nodes: [
        { id: "start", type: "START", config: {} },
        { id: "delay", type: "DELAY", config: { amount: 1, unit: "HOURS" } },
        { id: "tag", type: "ACTION", config: { actionType: "ADD_TAG", tag: "delayed-tag" } },
        { id: "exit", type: "EXIT", config: {} },
      ],
      edges: [
        { from: "start", to: "delay" },
        { from: "delay", to: "tag" },
        { from: "tag", to: "exit" },
      ],
    };
    const createRes = await app.inject({ method: "POST", url: `/api/students/${studentAId}/automations`, headers: { cookie: studentACookie }, payload: { businessId: business.id, name: "Delay Automation", flow, triggerType: "MANUAL" } });
    const version = createRes.json().version;

    const lead = await createLead(ownerCookie, "Delay Test Lead");
    const testContactRes = await app.inject({ method: "POST", url: `/api/businesses/${business.id}/automation-test-contacts`, headers: { cookie: studentACookie }, payload: { label: "Test Lead", entityType: "Lead", entityId: lead.id } });
    expect(testContactRes.statusCode).toBe(201);

    const testRunRes = await app.inject({ method: "POST", url: `/api/automation-versions/${version.id}/test-run`, headers: { cookie: studentACookie }, payload: { entityType: "Lead", entityId: lead.id } });
    expect(testRunRes.statusCode).toBe(201);
    const run = testRunRes.json().run;
    expect(run.status).toBe("WAITING");
    expect(run.isTest).toBe(true);
    expect(run.steps.find((s: { nodeId: string }) => s.nodeId === "delay")?.status).toBe("WAITING");

    await db.automationRun.update({ where: { id: run.id }, data: { resumeAt: new Date(Date.now() - 1000) } });
    await advanceRun(run.id);

    const finished = await db.automationRun.findUniqueOrThrow({ where: { id: run.id } });
    expect(finished.status).toBe("COMPLETED");

    const stepsAfter = await db.automationRunStep.findMany({ where: { runId: run.id } });
    expect(stepsAfter.filter((s) => s.nodeId === "delay")).toHaveLength(1); // updated in place, never duplicated
    expect(stepsAfter.find((s) => s.nodeId === "delay")?.status).toBe("COMPLETED");

    const tagStep = stepsAfter.find((s) => s.nodeId === "tag");
    expect(tagStep?.status).toBe("COMPLETED");
    expect((tagStep?.outputJson as { summary?: string } | null)?.summary).toContain("TEST MODE");

    // TEST MODE never performs the real side effect.
    const realTag = await db.entityTag.findUnique({ where: { entityType_entityId_tag: { entityType: "Lead", entityId: lead.id, tag: "delayed-tag" } } });
    expect(realTag).toBeNull();
  });

  it("TEST MODE may only target a configured Test Contact, never the real student population", async () => {
    const business = await createPublishedBusiness(studentACookie, studentAId, "Test Contact Guard Business");
    const flow = { nodes: [{ id: "start", type: "START", config: {} }, { id: "exit", type: "EXIT", config: {} }], edges: [{ from: "start", to: "exit" }] };
    const createRes = await app.inject({ method: "POST", url: `/api/students/${studentAId}/automations`, headers: { cookie: studentACookie }, payload: { businessId: business.id, name: "Guard Automation", flow, triggerType: "MANUAL" } });
    const version = createRes.json().version;

    const lead = await createLead(ownerCookie, "Not A Test Contact");
    const testRunRes = await app.inject({ method: "POST", url: `/api/automation-versions/${version.id}/test-run`, headers: { cookie: studentACookie }, payload: { entityType: "Lead", entityId: lead.id } });
    expect(testRunRes.statusCode).toBe(403);
  });
});

describe("AI Automation Architect (spec sections 43-45, 110-113)", () => {
  it("translates a description into a DRAFT blueprint with real validation — never auto-published", async () => {
    const business = await createPublishedBusiness(studentACookie, studentAId, "Architect Business");
    fakeAnthropic.setMode("success");
    fakeAnthropic.setResponseText(
      JSON.stringify({
        name: "Webinar Reminder Sequence",
        goal: "Remind registrants before the webinar and follow up after.",
        triggerType: "WEBINAR_REGISTERED",
        audience: "Webinar registrants",
        eligibility: "Registered and not opted out",
        flow: {
          nodes: [
            { id: "start", type: "START", config: {} },
            { id: "reminder", type: "MESSAGE", config: { channel: "Email" } },
            { id: "exit", type: "EXIT", config: {} },
          ],
          edges: [
            { from: "start", to: "reminder" },
            { from: "reminder", to: "exit" },
          ],
        },
        messagesNeeded: ["Webinar reminder email"],
        conditions: [],
        branches: [],
        delays: ["1 day before webinar"],
        exitConditions: ["LEAD_OPTED_OUT"],
        platformRequirements: ["GHL connection for Email sending"],
        risks: ["No template selected yet"],
        missingInformation: ["Which email template to use"],
      }),
    );

    const res = await app.inject({
      method: "POST",
      url: `/api/students/${studentAId}/automations/architect`,
      headers: { cookie: studentACookie },
      payload: { businessId: business.id, description: "My webinar registrants need a reminder before the webinar." },
    });
    expect(res.statusCode).toBe(201);
    const automation = res.json().automation;
    expect(automation.status).toBe("DRAFT");
    expect(automation.currentVersion.triggerType).toBe("WEBINAR_REGISTERED");
    const validation = automation.currentVersion.validationJson as { issues: { code: string }[] };
    expect(validation.issues.some((i) => i.code === "MISSING_TEMPLATE")).toBe(true);
  });

  it("fails cleanly, never fabricating a blueprint, when the AI provider is unavailable", async () => {
    const business = await createPublishedBusiness(studentACookie, studentAId, "Architect Failure Business");
    fakeAnthropic.setMode("server_error");
    const res = await app.inject({
      method: "POST",
      url: `/api/students/${studentAId}/automations/architect`,
      headers: { cookie: studentACookie },
      payload: { businessId: business.id, description: "Anything." },
    });
    expect(res.statusCode).toBe(502);
    const failed = await db.aiGeneration.findFirst({ where: { businessId: business.id, status: "FAILED" }, orderBy: { createdAt: "desc" } });
    expect(failed).not.toBeNull();
    fakeAnthropic.setMode("success");
  });
});

describe("Business/student isolation (spec sections 4, 88)", () => {
  it("Student B cannot reach Student A's journeys/automations via tampered IDs", async () => {
    const business = await createPublishedBusiness(studentACookie, studentAId, "Isolation Business");
    const journeyRes = await app.inject({ method: "POST", url: `/api/students/${studentAId}/journeys`, headers: { cookie: studentACookie }, payload: { businessId: business.id, name: "Isolation Journey" } });
    const journey = journeyRes.json().journey;

    const flow = { nodes: [{ id: "start", type: "START", config: {} }, { id: "exit", type: "EXIT", config: {} }], edges: [{ from: "start", to: "exit" }] };
    const automationRes = await app.inject({ method: "POST", url: `/api/students/${studentAId}/automations`, headers: { cookie: studentACookie }, payload: { businessId: business.id, name: "Isolation Automation", flow, triggerType: "MANUAL" } });
    const automation = automationRes.json().automation;

    const crossJourney = await app.inject({ method: "GET", url: `/api/journeys/${journey.id}`, headers: { cookie: studentBCookie } });
    expect(crossJourney.statusCode).toBe(403);

    const crossJourneyList = await app.inject({ method: "GET", url: `/api/businesses/${business.id}/journeys`, headers: { cookie: studentBCookie } });
    expect(crossJourneyList.statusCode).toBe(403);

    const crossAutomation = await app.inject({ method: "GET", url: `/api/automations/${automation.id}`, headers: { cookie: studentBCookie } });
    expect(crossAutomation.statusCode).toBe(403);

    const crossSubmit = await app.inject({ method: "POST", url: `/api/automations/${automation.id}/submit-for-review`, headers: { cookie: studentBCookie } });
    expect(crossSubmit.statusCode).toBe(403);

    const tamperedJourney = await app.inject({ method: "GET", url: `/api/journeys/nonexistent-tampered-id`, headers: { cookie: studentACookie } });
    expect(tamperedJourney.statusCode).toBe(404);

    const tamperedBusiness = await app.inject({ method: "GET", url: `/api/businesses/nonexistent-tampered-business/journeys`, headers: { cookie: studentACookie } });
    expect(tamperedBusiness.statusCode).toBe(403);
  });
});
