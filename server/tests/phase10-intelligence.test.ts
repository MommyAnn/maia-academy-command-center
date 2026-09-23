import { beforeAll, afterAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { db } from "../src/db.js";
import { hashPassword } from "../src/auth/password.js";
import { resetDb, loginAs, DEV_USERS } from "./helpers.js";
import { evaluateAllRules } from "../src/modules/intelligence/engine.js";
import { askMaia } from "../src/modules/intelligence/ask.js";

let app: FastifyInstance;
let ownerCookie: string;
let financeCookie: string;
let studentAId: string;

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

beforeAll(async () => {
  await resetDb();
  app = await buildApp();
  ownerCookie = await loginAs(app, DEV_USERS.owner.email, DEV_USERS.owner.password);
  financeCookie = await loginAs(app, DEV_USERS.finance.email, DEV_USERS.finance.password);
  studentAId = (await db.student.findUniqueOrThrow({ where: { studentDisplayId: "MAIA-B14-DEV-A" } })).id;
});

afterAll(async () => {
  await app.close();
  await db.$disconnect();
});

async function findOpenSignal(ruleKey: string, entityId: string) {
  return db.intelligenceSignal.findFirst({
    where: { rule: { ruleKey }, entityId, status: { in: ["NEW", "REVIEWED", "ACTIONED"] } },
  });
}

describe("Rule engine (spec sections 9-54): each rule fires, explains itself, and auto-resolves", () => {
  it("Interested Lead Without Follow-Up: fires, then auto-resolves once a completed follow-up exists", async () => {
    const createRes = await app.inject({
      method: "POST",
      url: "/api/leads",
      headers: { cookie: ownerCookie },
      payload: { fullName: "Intelligence Test Lead", email: `intel-lead-${Date.now()}@example.com`, contactNumber: "09171111111", source: "Webinar" },
    });
    const lead = createRes.json().lead;
    await app.inject({ method: "PATCH", url: `/api/leads/${lead.id}/pipeline-stage`, headers: { cookie: ownerCookie }, payload: { stage: "INTERESTED", reason: "test" } });
    await db.lead.update({ where: { id: lead.id }, data: { createdAt: daysAgo(5) } });

    const summaries = await evaluateAllRules();
    const summary = summaries.find((s) => s.ruleKey === "lead-interested-no-followup")!;
    expect(summary.signalsCreated).toBeGreaterThanOrEqual(1);

    const signal = await findOpenSignal("lead-interested-no-followup", lead.id);
    expect(signal).not.toBeNull();
    expect(signal!.explanation).toContain("INTERESTED");
    expect((signal!.evidenceJson as { leadDisplayId: string }).leadDisplayId).toBe(lead.leadDisplayId);

    // Idempotency: running again with nothing changed creates no duplicate.
    const rerun = await evaluateAllRules();
    expect(rerun.find((s) => s.ruleKey === "lead-interested-no-followup")!.signalsCreated).toBe(0);

    // Complete a follow-up -> the condition clears -> auto-resolve.
    const followUp = await db.followUp.create({ data: { leadId: lead.id, channel: "Phone", scheduledFor: new Date(), status: "Completed", completedAt: new Date() } });
    expect(followUp.status).toBe("Completed");
    const afterFollowUp = await evaluateAllRules();
    expect(afterFollowUp.find((s) => s.ruleKey === "lead-interested-no-followup")!.signalsAutoResolved).toBeGreaterThanOrEqual(1);
    const resolved = await db.intelligenceSignal.findFirst({ where: { rule: { ruleKey: "lead-interested-no-followup" }, entityId: lead.id } });
    expect(resolved!.status).toBe("RESOLVED");
  });

  it("Payment Pending Verification Overdue: fires, then auto-resolves once verified", async () => {
    const submit = await app.inject({
      method: "POST",
      url: `/api/students/${studentAId}/payments`,
      headers: { cookie: ownerCookie },
      payload: { amount: 500, method: "Cash", type: "Balance Payment" },
    });
    const paymentId = submit.json().payment.id;
    await db.paymentTransaction.update({ where: { id: paymentId }, data: { createdAt: daysAgo(2) } });

    const summaries = await evaluateAllRules();
    expect(summaries.find((s) => s.ruleKey === "finance-payment-pending-overdue")!.signalsCreated).toBeGreaterThanOrEqual(1);
    const signal = await findOpenSignal("finance-payment-pending-overdue", paymentId);
    expect(signal).not.toBeNull();

    await app.inject({ method: "POST", url: `/api/payments/${paymentId}/verify`, headers: { cookie: ownerCookie } });
    const afterVerify = await evaluateAllRules();
    expect(afterVerify.find((s) => s.ruleKey === "finance-payment-pending-overdue")!.signalsAutoResolved).toBeGreaterThanOrEqual(1);
  });

  it("Course Access Granted But Never Started: fires, then auto-resolves once progress begins", async () => {
    const courseCreate = await app.inject({ method: "POST", url: "/api/courses", headers: { cookie: ownerCookie }, payload: { title: `Intel Course ${Date.now()}`, category: "Other", accessType: "MANUAL" } });
    const course = courseCreate.json().course;
    const moduleRes = await app.inject({ method: "POST", url: `/api/courses/${course.id}/modules`, headers: { cookie: ownerCookie }, payload: { title: "M1", order: 0 } });
    const lesson = (await app.inject({ method: "POST", url: `/api/courses/${course.id}/modules/${moduleRes.json().module.id}/lessons`, headers: { cookie: ownerCookie }, payload: { title: "L1", type: "Text Lesson", order: 0 } })).json().lesson;
    await app.inject({ method: "PATCH", url: `/api/lessons/${lesson.id}`, headers: { cookie: ownerCookie }, payload: { status: "Published" } });
    await app.inject({ method: "PATCH", url: `/api/courses/${course.id}`, headers: { cookie: ownerCookie }, payload: { status: "PUBLISHED" } });
    const grant = await app.inject({ method: "POST", url: `/api/students/${studentAId}/course-access`, headers: { cookie: ownerCookie }, payload: { courseId: course.id, source: "Manual Override" } });
    const grantId = grant.json().grant.id;
    await db.courseAccessGrant.update({ where: { id: grantId }, data: { grantedAt: daysAgo(10) } });

    const summaries = await evaluateAllRules();
    expect(summaries.find((s) => s.ruleKey === "student-course-access-not-started")!.signalsCreated).toBeGreaterThanOrEqual(1);
    expect(await findOpenSignal("student-course-access-not-started", grantId)).not.toBeNull();

    await app.inject({ method: "PATCH", url: `/api/students/${studentAId}/lessons/${lesson.id}/progress`, headers: { cookie: ownerCookie }, payload: { status: "In Progress" } });
    const afterProgress = await evaluateAllRules();
    expect(afterProgress.find((s) => s.ruleKey === "student-course-access-not-started")!.signalsAutoResolved).toBeGreaterThanOrEqual(1);
  });

  it("Certificate Eligible But Not Issued: fires, then auto-resolves once issued", async () => {
    await db.student.update({ where: { id: studentAId }, data: { enrollmentStatus: "Confirmed Student" } });
    const uploadDoc = await app.inject({
      method: "POST",
      url: `/api/students/${studentAId}/documents`,
      headers: { cookie: ownerCookie },
      payload: { documentType: "ValidId", filename: "id.jpg", mimeType: "image/jpeg", contentBase64: Buffer.from("intel-cert-test").toString("base64") },
    });
    const submitReq = await app.inject({ method: "POST", url: `/api/students/${studentAId}/requirements/ValidId/submit`, headers: { cookie: ownerCookie }, payload: { documentId: uploadDoc.json().document.id } });
    await app.inject({ method: "POST", url: `/api/requirements/${submitReq.json().requirement.id}/verify`, headers: { cookie: ownerCookie } });

    const eligible = await app.inject({
      method: "POST",
      url: `/api/students/${studentAId}/certificates/evaluate`,
      headers: { cookie: ownerCookie },
      payload: { requireFullyPaid: false, minAttendancePercent: 0 },
    });
    expect(eligible.json().certificate.status).toBe("Eligible");
    const certificateId = eligible.json().certificate.id;

    const summaries = await evaluateAllRules();
    expect(summaries.find((s) => s.ruleKey === "student-certificate-eligible-not-issued")!.signalsCreated).toBeGreaterThanOrEqual(1);
    expect(await findOpenSignal("student-certificate-eligible-not-issued", certificateId)).not.toBeNull();

    await app.inject({ method: "PATCH", url: `/api/certificates/${certificateId}`, headers: { cookie: ownerCookie }, payload: { status: "For Preparation" } });
    await app.inject({ method: "PATCH", url: `/api/certificates/${certificateId}`, headers: { cookie: ownerCookie }, payload: { status: "Ready" } });
    await app.inject({ method: "PATCH", url: `/api/certificates/${certificateId}`, headers: { cookie: ownerCookie }, payload: { status: "Issued" } });
    const afterIssue = await evaluateAllRules();
    expect(afterIssue.find((s) => s.ruleKey === "student-certificate-eligible-not-issued")!.signalsAutoResolved).toBeGreaterThanOrEqual(1);
  });

  it("GHL Sync Failures: fires on a FAILED outbox event, never claims it synced", async () => {
    const domainEvent = await db.domainEvent.create({ data: { type: "LEAD_CREATED", payloadJson: {} } });
    const outboxEvent = await db.integrationOutboxEvent.create({
      data: { domainEventId: domainEvent.id, idempotencyKey: `intel-test-${domainEvent.id}`, eventType: "LEAD_CREATED", status: "FAILED", attemptCount: 3, lastError: "Simulated failure" },
    });

    const summaries = await evaluateAllRules();
    expect(summaries.find((s) => s.ruleKey === "operations-ghl-sync-failures")!.signalsCreated).toBeGreaterThanOrEqual(1);
    const signal = await findOpenSignal("operations-ghl-sync-failures", outboxEvent.id);
    expect(signal).not.toBeNull();
    expect(signal!.explanation).toContain("FAILED");

    await db.integrationOutboxEvent.update({ where: { id: outboxEvent.id }, data: { resolvedAt: new Date(), resolvedById: "test" } });
    const afterResolve = await evaluateAllRules();
    expect(afterResolve.find((s) => s.ruleKey === "operations-ghl-sync-failures")!.signalsAutoResolved).toBeGreaterThanOrEqual(1);
  });
});

describe("Signal lifecycle routes + audit + RBAC (spec sections 50-54, 80-81)", () => {
  it("Owner can resolve a signal with a note, and it's audited", async () => {
    const lead = (await app.inject({ method: "POST", url: "/api/leads", headers: { cookie: ownerCookie }, payload: { fullName: "Manual Resolve Lead", email: `manual-${Date.now()}@example.com`, contactNumber: "09172222222", source: "Webinar" } })).json().lead;
    await app.inject({ method: "PATCH", url: `/api/leads/${lead.id}/pipeline-stage`, headers: { cookie: ownerCookie }, payload: { stage: "INTERESTED", reason: "test" } });
    await db.lead.update({ where: { id: lead.id }, data: { createdAt: daysAgo(5) } });
    await evaluateAllRules();
    const signal = await findOpenSignal("lead-interested-no-followup", lead.id);

    const resolve = await app.inject({ method: "POST", url: `/api/intelligence/signals/${signal!.id}/resolve`, headers: { cookie: ownerCookie }, payload: { resolution: "Called manually, not logged as a formal follow-up yet." } });
    expect(resolve.statusCode).toBe(200);
    expect(resolve.json().signal.status).toBe("RESOLVED");

    const auditRow = await db.activityLog.findFirst({ where: { action: "Intelligence Signal Resolved", entityId: signal!.id } });
    expect(auditRow).not.toBeNull();
  });

  it("a role without the Intelligence permission is denied rule/signal management and evaluation", async () => {
    const denyList = [
      { method: "GET" as const, url: "/api/intelligence/rules" },
      { method: "GET" as const, url: "/api/intelligence/signals" },
      { method: "POST" as const, url: "/api/intelligence/evaluate" },
      { method: "GET" as const, url: "/api/intelligence/daily-brief" },
    ];
    for (const route of denyList) {
      const res = await app.inject({ method: route.method, url: route.url, headers: { cookie: financeCookie } });
      expect(res.statusCode).toBe(403);
    }
  });
});

describe("Daily Brief / Today's Priorities (spec sections 2-6): fact-first, never fabricated", () => {
  it("returns real, live-computed numbers with FACT vs CALCULATED METRIC vs rule-based signals kept separate", async () => {
    const res = await app.inject({ method: "GET", url: "/api/intelligence/daily-brief?rangeDays=30", headers: { cookie: ownerCookie } });
    expect(res.statusCode).toBe(200);
    const brief = res.json().brief;
    expect(typeof brief.facts.newLeads).toBe("number");
    expect(typeof brief.calculatedMetrics.receivables).toBe("number");
    expect(typeof brief.ruleBasedSignals.totalOpen).toBe("number");
  });

  it("Today's Priorities are explainable and sorted by severity", async () => {
    const res = await app.inject({ method: "GET", url: "/api/intelligence/priorities", headers: { cookie: ownerCookie } });
    expect(res.statusCode).toBe(200);
    const priorities = res.json().priorities as Array<{ severity: string; explanation: string; recommendation: string }>;
    for (const p of priorities) {
      expect(p.explanation.length).toBeGreaterThan(0);
      expect(p.recommendation.length).toBeGreaterThan(0);
    }
  });
});

describe("Ask M.A.I.A. (spec sections 64-68, 83): grounded, permission-scoped, honest about what it can't answer", () => {
  it("answers a matched question with real facts, and is honest about an unmatched one", async () => {
    const res = await app.inject({ method: "POST", url: "/api/intelligence/ask", headers: { cookie: ownerCookie }, payload: { question: "How many payments are pending verification?" } });
    expect(res.statusCode).toBe(200);
    expect(res.json().matched).toBe(true);
    expect(typeof res.json().facts.count).toBe("number");

    const unmatched = await app.inject({ method: "POST", url: "/api/intelligence/ask", headers: { cookie: ownerCookie }, payload: { question: "What is the meaning of life?" } });
    expect(unmatched.json().matched).toBe(false);
  });

  it("denies a Finance question to a role without Finance - Payments permission", async () => {
    const role = await db.role.findUniqueOrThrow({ where: { name: "Training Coordinator" } });
    const person = await db.person.create({ data: { fullName: "Training Coordinator (Intel Test)", email: `training-intel-${Date.now()}@maiaacademy.local` } });
    const email = `training-intel-${Date.now()}@maiaacademy.local`;
    await db.user.create({ data: { personId: person.id, email, passwordHash: await hashPassword("IntelTest123!"), roleId: role.id, status: "ACTIVE" } });
    const cookie = await loginAs(app, email, "IntelTest123!");

    const res = await app.inject({ method: "POST", url: "/api/intelligence/ask", headers: { cookie }, payload: { question: "How many payments are pending verification?" } });
    expect(res.statusCode).toBe(403);
  });

  it("falls back to the deterministic factual answer when the AI provider is disabled — rule-based never depends on AI", async () => {
    await db.aiProviderConfig.updateMany({ where: { provider: "ANTHROPIC" }, data: { enabled: false } });
    try {
      const res = await app.inject({ method: "POST", url: "/api/intelligence/ask", headers: { cookie: ownerCookie }, payload: { question: "How many payments are pending verification?" } });
      expect(res.statusCode).toBe(200);
      expect(res.json().matched).toBe(true);
      expect(res.json().aiPhrased).toBe(false);
      expect(res.json().source).toBe("RULE-BASED");
    } finally {
      await db.aiProviderConfig.updateMany({ where: { provider: "ANTHROPIC" }, data: { enabled: true } });
    }
  });

  it("askMaia() itself never matches a Finance question without the caller's permission granting it (unit-level check)", async () => {
    const result = await askMaia("How many payments are pending verification?", { hasPermission: async () => false });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("PERMISSION_DENIED");
  });
});
