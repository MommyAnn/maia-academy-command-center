// Production Phase 15 — M.A.I.A. Business OS + Unified Business Command
// Center. Covers: business-first isolation across every new entity, the
// no-fake-progress rule for Goals, ESTIMATED-value labeling for
// Opportunities, strict Academy/Business finance domain separation,
// per-Business team RBAC, an end-to-end Contact -> Opportunity -> Revenue
// chain, and the Ask M.A.I.A. Business Copilot's grounded answers.

import { beforeAll, afterAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { db } from "../src/db.js";
import { resetDb, loginAs, DEV_USERS } from "./helpers.js";
import { createFakeAnthropicServer } from "./anthropic-fake-server.js";

let app: FastifyInstance;
let ownerCookie: string;
let studentACookie: string;
let studentBCookie: string;
let studentAId: string;
let studentBId: string;
let studentBUserId: string;
const fakeAnthropic = createFakeAnthropicServer(4011);

beforeAll(async () => {
  await fakeAnthropic.start();
  await resetDb();
  app = await buildApp();
  ownerCookie = await loginAs(app, DEV_USERS.owner.email, DEV_USERS.owner.password);
  studentACookie = await loginAs(app, DEV_USERS.studentA.email, DEV_USERS.studentA.password);
  studentBCookie = await loginAs(app, DEV_USERS.studentB.email, DEV_USERS.studentB.password);
  studentAId = (await db.student.findUniqueOrThrow({ where: { studentDisplayId: "MAIA-B14-DEV-A" } })).id;
  studentBId = (await db.student.findUniqueOrThrow({ where: { studentDisplayId: "MAIA-B14-DEV-B" } })).id;
  studentBUserId = (await db.user.findFirstOrThrow({ where: { person: { student: { id: studentBId } } } })).id;
});

afterAll(async () => {
  await app.close();
  await db.$disconnect();
  await fakeAnthropic.stop();
});

async function createBusiness(cookie: string, studentId: string, name: string) {
  const res = await app.inject({ method: "POST", url: `/api/students/${studentId}/businesses`, headers: { cookie }, payload: { name } });
  expect(res.statusCode).toBe(201);
  return res.json().business as { id: string };
}

describe("M.A.I.A. Business OS — Business stage, pipeline, unified CRM", () => {
  it("sets an explicit Business stage and UI experience level", async () => {
    const business = await createBusiness(studentACookie, studentAId, "Stage Business");
    const res = await app.inject({ method: "PATCH", url: `/api/businesses/${business.id}/stage`, headers: { cookie: studentACookie }, payload: { stage: "FOUNDATION" } });
    expect(res.statusCode).toBe(200);
    expect(res.json().business.stage).toBe("FOUNDATION");

    const uiRes = await app.inject({ method: "PATCH", url: `/api/businesses/${business.id}/ui-experience-level`, headers: { cookie: studentACookie }, payload: { uiExperienceLevel: "ADVANCED" } });
    expect(uiRes.statusCode).toBe(200);
    expect(uiRes.json().business.uiExperienceLevel).toBe("ADVANCED");
  });

  it("auto-creates a default pipeline on first use, and a custom pipeline can be saved", async () => {
    const business = await createBusiness(studentACookie, studentAId, "Pipeline Business");
    const getRes = await app.inject({ method: "GET", url: `/api/businesses/${business.id}/pipeline`, headers: { cookie: studentACookie } });
    expect(getRes.statusCode).toBe(200);
    const defaultStages = getRes.json().pipeline.stagesJson as { key: string }[];
    expect(defaultStages.length).toBeGreaterThan(5);
    expect(defaultStages.map((s) => s.key)).toContain("NEW_LEAD");

    const putRes = await app.inject({ method: "PUT", url: `/api/businesses/${business.id}/pipeline`, headers: { cookie: studentACookie }, payload: { stages: [{ key: "CUSTOM_A", label: "Custom A" }, { key: "CUSTOM_B", label: "Custom B" }] } });
    expect(putRes.statusCode).toBe(200);
    expect((putRes.json().pipeline.stagesJson as { key: string }[]).map((s) => s.key)).toEqual(["CUSTOM_A", "CUSTOM_B"]);
  });

  it("creates a Business Contact reusing an existing Person by email (never a duplicate identity), rejects an unknown pipeline stage", async () => {
    const business = await createBusiness(studentACookie, studentAId, "CRM Business");
    const email = "customer-dedupe-test@example.com";
    const existingPerson = await db.person.create({ data: { fullName: "Existing Person", email } });

    const res = await app.inject({ method: "POST", url: `/api/students/${studentAId}/business-contacts`, headers: { cookie: studentACookie }, payload: { businessId: business.id, fullName: "Existing Person", email } });
    expect(res.statusCode).toBe(201);
    expect(res.json().contact.personId).toBe(existingPerson.id);

    const badStage = await app.inject({ method: "POST", url: `/api/students/${studentAId}/business-contacts`, headers: { cookie: studentACookie }, payload: { businessId: business.id, fullName: "Someone Else", pipelineStageKey: "NOT_A_REAL_STAGE" } });
    expect(badStage.statusCode).toBe(400);
  });

  it("full Campaign-360-style chain: Business -> Contact -> Opportunity (ESTIMATED value labeled) -> Revenue (WON, real, separate from Academy finance)", async () => {
    const business = await createBusiness(studentACookie, studentAId, "Chain Business");
    const contactRes = await app.inject({ method: "POST", url: `/api/students/${studentAId}/business-contacts`, headers: { cookie: studentACookie }, payload: { businessId: business.id, fullName: "Chain Customer", email: "chain-customer@example.com" } });
    const contact = contactRes.json().contact;

    const oppRes = await app.inject({ method: "POST", url: `/api/students/${studentAId}/opportunities`, headers: { cookie: studentACookie }, payload: { businessId: business.id, contactId: contact.id, estimatedValue: 5000 } });
    expect(oppRes.statusCode).toBe(201);
    const opportunity = oppRes.json().opportunity;
    expect(opportunity.status).toBe("OPEN");
    expect(Number(opportunity.estimatedValue)).toBe(5000);

    const revenueRes = await app.inject({ method: "POST", url: `/api/students/${studentAId}/business-revenue`, headers: { cookie: studentACookie }, payload: { businessId: business.id, amount: 4800, source: "CRM_SALE", occurredAt: new Date().toISOString(), relatedOpportunityId: opportunity.id } });
    expect(revenueRes.statusCode).toBe(201);

    const oppAfter = await db.opportunity.findUniqueOrThrow({ where: { id: opportunity.id } });
    expect(oppAfter.status).toBe("WON");

    const summaryRes = await app.inject({ method: "GET", url: `/api/businesses/${business.id}/finance-summary`, headers: { cookie: studentACookie } });
    expect(summaryRes.json().totalRevenue).toBe(4800);
    expect(summaryRes.json().label).toContain("not formal accounting");

    // Strict domain separation — this Business's revenue never touches the
    // Academy's own PaymentTransaction ledger.
    const academyPayments = await db.paymentTransaction.count({ where: { studentId: studentAId } });
    const businessRevenue = await db.businessRevenueRecord.count({ where: { businessId: business.id } });
    expect(businessRevenue).toBe(1);
    expect(academyPayments).toBe(0);
  });
});

describe("M.A.I.A. Business OS — Goals: no fake progress, explainable status", () => {
  it("a MANUAL goal never advances without an explicit human update", async () => {
    const business = await createBusiness(studentACookie, studentAId, "Goals Business Manual");
    const createRes = await app.inject({
      method: "POST",
      url: `/api/students/${studentAId}/goals`,
      headers: { cookie: studentACookie },
      payload: { businessId: business.id, name: "Manual Revenue Goal", type: "Revenue", target: 10000, unit: "PHP", startDate: new Date().toISOString(), targetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), dataSource: "MANUAL" },
    });
    expect(createRes.statusCode).toBe(201);
    const goal = createRes.json().goal;
    expect(Number(goal.currentValue)).toBe(0);
    expect(goal.status).toBe("NOT_STARTED");

    // Re-fetching without any manual update never moves currentValue.
    const getRes = await app.inject({ method: "GET", url: `/api/goals/${goal.id}`, headers: { cookie: studentACookie } });
    expect(Number(getRes.json().goal.currentValue)).toBe(0);

    const updateRes = await app.inject({ method: "PATCH", url: `/api/goals/${goal.id}/progress`, headers: { cookie: studentACookie }, payload: { currentValue: 10000 } });
    expect(updateRes.statusCode).toBe(200);
    expect(updateRes.json().goal.status).toBe("COMPLETED");
  });

  it("a COMPUTED goal recomputes from a real query and rejects a manual progress edit", async () => {
    const business = await createBusiness(studentACookie, studentAId, "Goals Business Computed");
    const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const createRes = await app.inject({
      method: "POST",
      url: `/api/students/${studentAId}/goals`,
      headers: { cookie: studentACookie },
      payload: { businessId: business.id, name: "Contacts Goal", type: "Lead", target: 3, unit: "contacts", startDate, targetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), dataSource: "COMPUTED_CONTACTS" },
    });
    const goal = createRes.json().goal;
    expect(Number(goal.currentValue)).toBe(0);

    await app.inject({ method: "POST", url: `/api/students/${studentAId}/business-contacts`, headers: { cookie: studentACookie }, payload: { businessId: business.id, fullName: "Computed Contact 1" } });
    await app.inject({ method: "POST", url: `/api/students/${studentAId}/business-contacts`, headers: { cookie: studentACookie }, payload: { businessId: business.id, fullName: "Computed Contact 2" } });

    const getRes = await app.inject({ method: "GET", url: `/api/goals/${goal.id}`, headers: { cookie: studentACookie } });
    expect(Number(getRes.json().goal.currentValue)).toBe(2);

    const manualEdit = await app.inject({ method: "PATCH", url: `/api/goals/${goal.id}/progress`, headers: { cookie: studentACookie }, payload: { currentValue: 999 } });
    expect(manualEdit.statusCode).toBe(400);
  });
});

describe("M.A.I.A. Business OS — Business Plan versioning never overwrites an approved version", () => {
  it("edits a DRAFT in place, then creates a NEW version instead of overwriting after APPROVAL", async () => {
    const business = await createBusiness(studentACookie, studentAId, "Plan Business");
    const v1 = await app.inject({ method: "PUT", url: `/api/businesses/${business.id}/plan`, headers: { cookie: studentACookie }, payload: { sections: { businessModel: "First draft" } } });
    expect(v1.statusCode).toBe(200);
    expect(v1.json().version.versionNumber).toBe(1);
    expect(v1.json().version.status).toBe("DRAFT");

    const approveRes = await app.inject({ method: "POST", url: `/api/businesses/${business.id}/plan/approve`, headers: { cookie: studentACookie } });
    expect(approveRes.json().version.status).toBe("APPROVED");

    const v2 = await app.inject({ method: "PUT", url: `/api/businesses/${business.id}/plan`, headers: { cookie: studentACookie }, payload: { sections: { businessModel: "Revised after approval" } } });
    expect(v2.json().version.versionNumber).toBe(2);
    expect(v2.json().version.status).toBe("DRAFT");

    const approvedVersion = await db.businessPlanVersion.findFirst({ where: { businessPlan: { businessId: business.id }, versionNumber: 1 } });
    expect(approvedVersion).toBeTruthy();
    expect(approvedVersion!.status).toBe("APPROVED");
    expect((approvedVersion!.sectionsJson as { businessModel: string }).businessModel).toBe("First draft");
  });
});

describe("M.A.I.A. Business OS — Operations: SOP automation-opportunity signal, Content Calendar never fakes PUBLISHED", () => {
  it("flags a 5+ step ACTIVE SOP as an automation opportunity, never auto-automates it", async () => {
    const business = await createBusiness(studentACookie, studentAId, "SOP Business");
    const createRes = await app.inject({ method: "POST", url: `/api/students/${studentAId}/sops`, headers: { cookie: studentACookie }, payload: { businessId: business.id, title: "Order Fulfillment SOP", steps: ["Receive order", "Verify payment", "Pack", "Ship", "Notify customer", "Update records"] } });
    const sop = createRes.json().sop;
    await app.inject({ method: "PATCH", url: `/api/sops/${sop.id}`, headers: { cookie: studentACookie }, payload: { status: "ACTIVE" } });

    const listRes = await app.inject({ method: "GET", url: `/api/businesses/${business.id}/sops`, headers: { cookie: studentACookie } });
    expect(listRes.json().automationOpportunities.some((o: { sopId: string }) => o.sopId === sop.id)).toBe(true);
    expect(listRes.json().automationOpportunities[0].reason).toContain("suggestion only");
  });

  it("never allows a Content Calendar item to be marked PUBLISHED (no real publishing integration exists)", async () => {
    const business = await createBusiness(studentACookie, studentAId, "Content Business");
    const createRes = await app.inject({ method: "POST", url: `/api/students/${studentAId}/content-calendar`, headers: { cookie: studentACookie }, payload: { businessId: business.id, title: "Launch Post", contentType: "ORGANIC" } });
    const item = createRes.json().item;
    const publishAttempt = await app.inject({ method: "PATCH", url: `/api/content-calendar/${item.id}`, headers: { cookie: studentACookie }, payload: { stage: "PUBLISHED" } });
    expect(publishAttempt.statusCode).toBe(422);
    const approveOk = await app.inject({ method: "PATCH", url: `/api/content-calendar/${item.id}`, headers: { cookie: studentACookie }, payload: { stage: "APPROVED" } });
    expect(approveOk.statusCode).toBe(200);
  });
});

describe("M.A.I.A. Business OS — Business Home aggregation is real, never invented", () => {
  it("health/action-center/home reflect real underlying data, with explainable reasons", async () => {
    const business = await createBusiness(studentACookie, studentAId, "Home Business");
    const healthRes = await app.inject({ method: "GET", url: `/api/businesses/${business.id}/health`, headers: { cookie: studentACookie } });
    expect(healthRes.statusCode).toBe(200);
    const categories = healthRes.json().categories as { category: string; status: string; reason: string }[];
    expect(categories.length).toBeGreaterThan(0);
    for (const c of categories) expect(c.reason.length).toBeGreaterThan(0);
    const foundation = categories.find((c) => c.category === "FOUNDATION");
    expect(foundation?.status).toBe("SETUP_REQUIRED"); // no published Master Brain yet

    const homeRes = await app.inject({ method: "GET", url: `/api/businesses/${business.id}/home`, headers: { cookie: studentACookie } });
    expect(homeRes.statusCode).toBe(200);
    expect(homeRes.json().business.name).toBe("Home Business");
    expect(homeRes.json().salesSnapshot.openOpportunityCount).toBe(0);
  });
});

describe("M.A.I.A. Business OS — Ask M.A.I.A. Business Copilot: grounded facts, routed actions, honest fallback", () => {
  it("answers a factual question from a real query, never fabricated", async () => {
    const business = await createBusiness(studentACookie, studentAId, "Copilot Business");
    await app.inject({ method: "POST", url: `/api/students/${studentAId}/business-contacts`, headers: { cookie: studentACookie }, payload: { businessId: business.id, fullName: "Copilot Test Contact", email: "copilot-lead@example.com" } });

    const res = await app.inject({ method: "POST", url: `/api/businesses/${business.id}/ask`, headers: { cookie: studentACookie }, payload: { question: "How many leads do I have?" } });
    expect(res.statusCode).toBe(200);
    expect(res.json().kind).toBe("FACT");
    // The underlying retrieval is the real, grounded fact — a real count,
    // never an estimate (spec section 80) — independent of whether an AI
    // pass rephrases it afterward.
    expect(res.json().facts.count).toBe(1);
    expect(typeof res.json().answer).toBe("string");
    expect(res.json().answer.length).toBeGreaterThan(0);
  });

  it("routes an action-oriented request to the module that owns it, never fabricating the action itself", async () => {
    const business = await createBusiness(studentACookie, studentAId, "Copilot Route Business");
    const res = await app.inject({ method: "POST", url: `/api/businesses/${business.id}/ask`, headers: { cookie: studentACookie }, payload: { question: "Build a follow-up automation for new leads" } });
    expect(res.statusCode).toBe(200);
    expect(res.json().kind).toBe("ROUTE");
    expect(res.json().module).toBe("Automation Studio");
  });

  it("honestly says it has no answer for an unrecognized question, rather than guessing", async () => {
    const business = await createBusiness(studentACookie, studentAId, "Copilot Unknown Business");
    const res = await app.inject({ method: "POST", url: `/api/businesses/${business.id}/ask`, headers: { cookie: studentACookie }, payload: { question: "asdkjhaskdjhaskjdh nonsense query" } });
    expect(res.statusCode).toBe(422);
  });
});

describe("M.A.I.A. Business OS — per-Business team RBAC (spec sections 67-69)", () => {
  it("a MARKETING team member gets VIEW but not EDIT; only the owner/staff can grant or revoke access", async () => {
    const business = await createBusiness(studentACookie, studentAId, "Team Business");
    const grantRes = await app.inject({ method: "POST", url: `/api/businesses/${business.id}/team`, headers: { cookie: studentACookie }, payload: { userId: studentBUserId, role: "MARKETING" } });
    expect(grantRes.statusCode).toBe(201);

    const viewRes = await app.inject({ method: "GET", url: `/api/businesses/${business.id}/goals`, headers: { cookie: studentBCookie } });
    expect(viewRes.statusCode).toBe(200);

    const editRes = await app.inject({
      method: "POST",
      url: `/api/students/${studentBId}/goals`,
      headers: { cookie: studentBCookie },
      payload: { businessId: business.id, name: "Should Fail", type: "Custom", target: 1, unit: "x", startDate: new Date().toISOString(), targetDate: new Date(Date.now() + 86400000).toISOString() },
    });
    expect(editRes.statusCode).toBe(403);

    // A MARKETING-level team member cannot grant/revoke team access themselves.
    const selfGrantAttempt = await app.inject({ method: "POST", url: `/api/businesses/${business.id}/team`, headers: { cookie: studentBCookie }, payload: { userId: studentBUserId, role: "OWNER" } });
    expect(selfGrantAttempt.statusCode).toBe(403);

    // Upgrading the same team member to MANAGER now grants real EDIT access
    // to this specific business (never OWNER-level, never automatic).
    const upgradeRes = await app.inject({ method: "POST", url: `/api/businesses/${business.id}/team`, headers: { cookie: studentACookie }, payload: { userId: studentBUserId, role: "MANAGER" } });
    expect(upgradeRes.statusCode).toBe(201);
    const editAfterUpgrade = await app.inject({
      method: "POST",
      url: `/api/students/${studentBId}/goals`,
      headers: { cookie: studentBCookie },
      payload: { businessId: business.id, name: "Manager Can Edit", type: "Custom", target: 1, unit: "x", startDate: new Date().toISOString(), targetDate: new Date(Date.now() + 86400000).toISOString() },
    });
    expect(editAfterUpgrade.statusCode).toBe(201);

    // Revoking access removes it again.
    const revokeRes = await app.inject({ method: "DELETE", url: `/api/businesses/${business.id}/team/${studentBUserId}`, headers: { cookie: studentACookie } });
    expect(revokeRes.statusCode).toBe(200);
    const afterRevoke = await app.inject({ method: "GET", url: `/api/businesses/${business.id}/goals`, headers: { cookie: studentBCookie } });
    expect(afterRevoke.statusCode).toBe(403);
  });
});

describe("M.A.I.A. Business OS — data isolation (spec sections 5, 88, 135-138)", () => {
  it("Student B cannot view or edit Student A's contacts, opportunities, goals, plan, finance, products, SOPs, content, or home", async () => {
    const business = await createBusiness(studentACookie, studentAId, "Isolation Business");
    const contactRes = await app.inject({ method: "POST", url: `/api/students/${studentAId}/business-contacts`, headers: { cookie: studentACookie }, payload: { businessId: business.id, fullName: "Isolated Contact" } });
    const contact = contactRes.json().contact;

    const checks = [
      { method: "GET" as const, url: `/api/businesses/${business.id}/business-contacts` },
      { method: "GET" as const, url: `/api/business-contacts/${contact.id}` },
      { method: "GET" as const, url: `/api/businesses/${business.id}/opportunities` },
      { method: "GET" as const, url: `/api/businesses/${business.id}/goals` },
      { method: "GET" as const, url: `/api/businesses/${business.id}/plan` },
      { method: "GET" as const, url: `/api/businesses/${business.id}/business-revenue` },
      { method: "GET" as const, url: `/api/businesses/${business.id}/products` },
      { method: "GET" as const, url: `/api/businesses/${business.id}/sops` },
      { method: "GET" as const, url: `/api/businesses/${business.id}/content-calendar` },
      { method: "GET" as const, url: `/api/businesses/${business.id}/home` },
      { method: "GET" as const, url: `/api/businesses/${business.id}/team` },
    ];
    for (const check of checks) {
      const res = await app.inject({ method: check.method, url: check.url, headers: { cookie: studentBCookie } });
      expect(res.statusCode).toBe(403);
    }

    // A tampered/nonexistent businessId is rejected the same way as someone else's real business.
    const tampered = await app.inject({ method: "GET", url: `/api/businesses/nonexistent-tampered-id/home`, headers: { cookie: studentACookie } });
    expect(tampered.statusCode).toBe(403);
  });

  it("admin oversight requires the Business OS/VIEW permission; a Student session is always forbidden from it", async () => {
    const ownerRes = await app.inject({ method: "GET", url: "/api/business-os/contacts", headers: { cookie: ownerCookie } });
    expect(ownerRes.statusCode).toBe(200);
    const studentRes = await app.inject({ method: "GET", url: "/api/business-os/contacts", headers: { cookie: studentACookie } });
    expect(studentRes.statusCode).toBe(403);
  });
});
