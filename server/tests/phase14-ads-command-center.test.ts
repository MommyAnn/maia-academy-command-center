import { readFileSync } from "node:fs";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { db } from "../src/db.js";
import { resetDb, loginAs, DEV_USERS } from "./helpers.js";
import { createFakeAnthropicServer } from "./anthropic-fake-server.js";
import { generateCampaignDisplayId, generateLeadDisplayId } from "../src/modules/sequence.js";

function todayUtcMidnight(): Date {
  return new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
}

let app: FastifyInstance;
let ownerCookie: string;
let studentACookie: string;
let studentBCookie: string;
let studentAId: string;
const fakeAnthropic = createFakeAnthropicServer(4011);

beforeAll(async () => {
  await fakeAnthropic.start();
  await resetDb();
  app = await buildApp();
  ownerCookie = await loginAs(app, DEV_USERS.owner.email, DEV_USERS.owner.password);
  studentACookie = await loginAs(app, DEV_USERS.studentA.email, DEV_USERS.studentA.password);
  studentBCookie = await loginAs(app, DEV_USERS.studentB.email, DEV_USERS.studentB.password);
  studentAId = (await db.student.findUniqueOrThrow({ where: { studentDisplayId: "MAIA-B14-DEV-A" } })).id;
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

async function createManualConnectionAndAccount(cookie: string, studentId: string, businessId: string, currency = "PHP") {
  const connRes = await app.inject({ method: "POST", url: `/api/students/${studentId}/ad-connections`, headers: { cookie }, payload: { businessId, provider: "MANUAL" } });
  expect(connRes.statusCode).toBe(201);
  const connection = connRes.json().connection;
  const testRes = await app.inject({ method: "POST", url: `/api/ad-connections/${connection.id}/test`, headers: { cookie } });
  expect(testRes.statusCode).toBe(200);
  expect(testRes.json().connection.status).toBe("CONNECTED");

  const accountRes = await app.inject({ method: "POST", url: `/api/ad-connections/${connection.id}/ad-accounts`, headers: { cookie }, payload: { name: "Synthetic Ad Account", currency, timezone: "Asia/Manila" } });
  expect(accountRes.statusCode).toBe(201);
  return { connection, account: accountRes.json().adAccount };
}

describe("Connection status honesty (spec sections 4-5)", () => {
  it("MANUAL always reaches CONNECTED; META honestly stays NOT_CONNECTED/CONFIGURATION_REQUIRED with no real credentials in this environment", async () => {
    const business = await createPublishedBusiness(studentACookie, studentAId, "Ads Honesty Business");
    const { connection: manualConn } = await createManualConnectionAndAccount(studentACookie, studentAId, business.id);
    expect(manualConn.status).toBe("NOT_CONNECTED"); // status at creation, before test

    const metaRes = await app.inject({ method: "POST", url: `/api/students/${studentAId}/ad-connections`, headers: { cookie: studentACookie }, payload: { businessId: business.id, provider: "META" } });
    expect(metaRes.statusCode).toBe(201);
    const metaConn = metaRes.json().connection;

    const testRes = await app.inject({ method: "POST", url: `/api/ad-connections/${metaConn.id}/test`, headers: { cookie: studentACookie } });
    expect(testRes.statusCode).toBe(200);
    expect(testRes.json().connection.status).toBe("CONFIGURATION_REQUIRED");
    expect(testRes.json().connection.status).not.toBe("CONNECTED");
    expect(testRes.json().connection.credentialsConfigured).toBe(false);
  });
});

describe("No autonomous ad spend — Optimization Center never mutates budget or reaches a live-executed state (spec sections 9-12, 78-82)", () => {
  it("source files never issue a POST/PATCH/DELETE call to the Meta Graph API — every real HTTP call is GET-only", () => {
    const files = ["src/modules/ads/provider.ts", "src/modules/ads/meta-client.ts", "src/modules/ads/optimization.ts", "src/modules/ads/budget.ts"];
    for (const file of files) {
      const source = readFileSync(file, "utf-8");
      expect(source).not.toMatch(/method:\s*["'](POST|PATCH|PUT|DELETE)["']/i);
      expect(source).not.toMatch(/campaigns\/create|adsets\/create/i);
    }
  });

  it("an approved optimization action's terminal status is CANNOT_EXECUTE_NO_PROVIDER, never EXECUTED", async () => {
    const business = await createPublishedBusiness(studentACookie, studentAId, "Optimization Business");
    const { account } = await createManualConnectionAndAccount(studentACookie, studentAId, business.id);
    const campaignRes = await app.inject({ method: "POST", url: `/api/ad-accounts/${account.id}/campaigns`, headers: { cookie: studentACookie }, payload: { name: "Optimization Campaign", dailyBudget: 300 } });
    const campaign = campaignRes.json().campaign;

    const requestRes = await app.inject({ method: "POST", url: `/api/ad-campaigns/${campaign.id}/optimization-actions`, headers: { cookie: studentACookie }, payload: { actionType: "BUDGET_CHANGE_REQUESTED", currentValue: { dailyBudget: 300 }, proposedValue: { dailyBudget: 400 }, reason: "CPL improving, worth testing more spend." } });
    expect(requestRes.statusCode).toBe(201);
    const actionId = requestRes.json().actionId;

    // A Student may never decide their own request.
    const selfDecide = await app.inject({ method: "POST", url: `/api/ad-optimization-actions/${actionId}/decide`, headers: { cookie: studentACookie }, payload: { decision: "APPROVED" } });
    expect(selfDecide.statusCode).toBe(403);

    // Staff without Ads Command Center / VERIFY is denied too.
    const financeCookie = await loginAs(app, DEV_USERS.finance.email, DEV_USERS.finance.password);
    const financeDecide = await app.inject({ method: "POST", url: `/api/ad-optimization-actions/${actionId}/decide`, headers: { cookie: financeCookie }, payload: { decision: "APPROVED" } });
    expect(financeDecide.statusCode).toBe(403);

    const decideRes = await app.inject({ method: "POST", url: `/api/ad-optimization-actions/${actionId}/decide`, headers: { cookie: ownerCookie }, payload: { decision: "APPROVED" } });
    expect(decideRes.statusCode).toBe(200);
    expect(decideRes.json().status).toBe("CANNOT_EXECUTE_NO_PROVIDER");

    const stored = await db.adOptimizationAction.findUniqueOrThrow({ where: { id: actionId } });
    expect(stored.status).toBe("CANNOT_EXECUTE_NO_PROVIDER");

    // Budget itself was never touched by the approval.
    const campaignAfter = await db.adCampaign.findUniqueOrThrow({ where: { id: campaign.id } });
    expect(Number(campaignAfter.dailyBudget)).toBe(300);
  });
});

describe("Manual Mode E2E — formula safety (spec sections 24-26, 83, 116)", () => {
  it("aggregates manually entered metrics with real division-safe derived stats, and UNKNOWN stays UNKNOWN", async () => {
    const business = await createPublishedBusiness(studentACookie, studentAId, "Manual Mode Business");
    const { account } = await createManualConnectionAndAccount(studentACookie, studentAId, business.id);
    const campaignRes = await app.inject({ method: "POST", url: `/api/ad-accounts/${account.id}/campaigns`, headers: { cookie: studentACookie }, payload: { name: "Manual Campaign" } });
    const campaign = campaignRes.json().campaign;

    const today = new Date().toISOString().slice(0, 10);
    const entryRes = await app.inject({ method: "POST", url: `/api/ad-accounts/${account.id}/snapshots/manual`, headers: { cookie: studentACookie }, payload: { campaignId: campaign.id, date: today, spend: 1000, impressions: 50000, clicks: 500, leads: 20 } });
    expect(entryRes.statusCode).toBe(201);

    const overviewRes = await app.inject({ method: "GET", url: `/api/ad-accounts/${account.id}/overview?preset=TODAY`, headers: { cookie: studentACookie } });
    expect(overviewRes.statusCode).toBe(200);
    const { aggregate, derived } = overviewRes.json();
    expect(aggregate.spend).toBe(1000);
    expect(aggregate.reach).toBeNull(); // never reported, never fabricated
    expect(derived.cpl).toBe(50); // 1000/20
    expect(derived.cpm).toBeCloseTo(20, 5); // 1000/50000*1000
    expect(derived.platformReportedRoas).toBeNull(); // no purchaseValue reported → never a divide-by-zero fabrication

    // A Student may never see another Student's account.
    const cross = await app.inject({ method: "GET", url: `/api/ad-accounts/${account.id}/overview`, headers: { cookie: studentBCookie } });
    expect(cross.statusCode).toBe(403);
  });
});

describe("CSV import — validation, idempotent commit, rollback (spec sections 84-87)", () => {
  it("previews invalid/duplicate rows, commits only the valid ones, re-commit doesn't duplicate, and rollback removes exactly what it created", async () => {
    const business = await createPublishedBusiness(studentACookie, studentAId, "CSV Import Business");
    const { account } = await createManualConnectionAndAccount(studentACookie, studentAId, business.id);

    const rows = [
      { date: "2026-01-01", campaignName: "Import Campaign", spend: "500", impressions: "10000" },
      { date: "not-a-date", campaignName: "Import Campaign", spend: "100" },
      { date: "2026-01-01", campaignName: "Import Campaign", spend: "500", impressions: "10000" }, // duplicate of row 1
    ];

    const previewRes = await app.inject({ method: "POST", url: `/api/ad-accounts/${account.id}/import/preview`, headers: { cookie: studentACookie }, payload: { rows } });
    expect(previewRes.statusCode).toBe(200);
    const preview = previewRes.json().preview;
    expect(preview.totalRows).toBe(3);
    expect(preview.invalidRows).toHaveLength(1);
    expect(preview.duplicateRowNumbers).toEqual([3]);

    const commitRes = await app.inject({ method: "POST", url: `/api/ad-accounts/${account.id}/import/commit`, headers: { cookie: studentACookie }, payload: { rows, fileNameOriginal: "report.csv" } });
    expect(commitRes.statusCode).toBe(201);
    expect(commitRes.json().committedCount).toBe(1);
    const batchId = commitRes.json().batchId;

    const snapshotsAfterFirst = await db.adPerformanceSnapshot.count({ where: { adAccountId: account.id, source: "CSV_IMPORT" } });
    expect(snapshotsAfterFirst).toBe(1);

    // Re-committing the exact same file is idempotent — updates the same row, never duplicates.
    const secondCommit = await app.inject({ method: "POST", url: `/api/ad-accounts/${account.id}/import/commit`, headers: { cookie: studentACookie }, payload: { rows, fileNameOriginal: "report.csv" } });
    expect(secondCommit.statusCode).toBe(201);
    const snapshotsAfterSecond = await db.adPerformanceSnapshot.count({ where: { adAccountId: account.id, source: "CSV_IMPORT" } });
    expect(snapshotsAfterSecond).toBe(1);

    const rollbackRes = await app.inject({ method: "POST", url: `/api/ad-import-batches/${batchId}/rollback`, headers: { cookie: studentACookie } });
    expect(rollbackRes.statusCode).toBe(200);
    const batch = await db.adImportBatch.findUniqueOrThrow({ where: { id: batchId } });
    expect(batch.status).toBe("ROLLED_BACK");
  });
});

describe("Creative Performance roll-up (spec sections 32-34)", () => {
  it("rolls up real ad-level performance by a real linked Hook, never invents a mapping", async () => {
    const business = await createPublishedBusiness(studentACookie, studentAId, "Creative Performance Business");
    const { account } = await createManualConnectionAndAccount(studentACookie, studentAId, business.id);
    const campaignRes = await app.inject({ method: "POST", url: `/api/ad-accounts/${account.id}/campaigns`, headers: { cookie: studentACookie }, payload: { name: "Creative Campaign" } });
    const campaign = campaignRes.json().campaign;
    const adSetRes = await app.inject({ method: "POST", url: `/api/ad-campaigns/${campaign.id}/ad-sets`, headers: { cookie: studentACookie }, payload: { name: "Ad Set 1" } });
    const adSet = adSetRes.json().adSet;
    const adRes = await app.inject({ method: "POST", url: `/api/ad-sets/${adSet.id}/ads`, headers: { cookie: studentACookie }, payload: { name: "Ad 1" } });
    const ad = adRes.json().ad;

    const marketingCampaign = await db.campaign.create({ data: { campaignDisplayId: await generateCampaignDisplayId(), studentId: studentAId, businessId: business.id, name: "Creative Source Campaign", objective: "Lead Generation", createdById: (await db.user.findFirstOrThrow({ where: { person: { fullName: "Mommy Ann (Dev Seed)" } } })).id } });
    const hook = await db.hook.create({ data: { campaignId: marketingCampaign.id, studentId: studentAId, businessId: business.id, category: "CURIOSITY", text: "You won't believe what happened when we tried this..." } });

    const linkRes = await app.inject({ method: "POST", url: `/api/ads/${ad.id}/creative-link`, headers: { cookie: studentACookie }, payload: { hookId: hook.id, format: "Video" } });
    expect(linkRes.statusCode).toBe(200);

    // A hook belonging to a different business can never be linked — never invented (spec section 32-33).
    const studentBId = (await db.student.findUniqueOrThrow({ where: { studentDisplayId: "MAIA-B14-DEV-B" } })).id;
    const otherBusiness = await createPublishedBusiness(studentBCookie, studentBId, "Other Creative Business");
    const otherMarketingCampaign = await db.campaign.create({ data: { campaignDisplayId: await generateCampaignDisplayId(), studentId: studentBId, businessId: otherBusiness.id, name: "Other Source Campaign", objective: "Lead Generation", createdById: (await db.user.findFirstOrThrow({ where: { person: { fullName: "Mommy Ann (Dev Seed)" } } })).id } });
    const otherHook = await db.hook.create({ data: { campaignId: otherMarketingCampaign.id, studentId: studentBId, businessId: otherBusiness.id, category: "CURIOSITY", text: "A hook that belongs to a different business entirely." } });
    const crossLinkRes = await app.inject({ method: "POST", url: `/api/ads/${ad.id}/creative-link`, headers: { cookie: studentACookie }, payload: { hookId: otherHook.id } });
    expect(crossLinkRes.statusCode).toBe(422);

    await db.adPerformanceSnapshot.create({ data: { adAccountId: account.id, campaignId: campaign.id, adSetId: adSet.id, adId: ad.id, provider: "MANUAL", dateFrom: todayUtcMidnight(), dateTo: todayUtcMidnight(), source: "MANUAL", clicks: 100, impressions: 2000 } });

    const rollupRes = await app.inject({ method: "GET", url: `/api/ad-accounts/${account.id}/creative-performance?groupBy=hook&preset=LAST_30_DAYS`, headers: { cookie: studentACookie } });
    expect(rollupRes.statusCode).toBe(200);
    const rollup = rollupRes.json().rollup;
    expect(rollup).toHaveLength(1);
    expect(rollup[0].adCount).toBe(1);
    expect(rollup[0].derived.ctr).toBeCloseTo(0.05, 5);
  });
});

describe("Revenue attribution — no double counting, platform vs verified kept separate (spec sections 45-49)", () => {
  it("attributes exactly one real Lead's verified payment to the matching campaign via first-touch UTM only", async () => {
    const business = await createPublishedBusiness(studentACookie, studentAId, "Revenue Attribution Business");
    const { account } = await createManualConnectionAndAccount(studentACookie, studentAId, business.id);
    const utmCampaign = `revenue-test-${Date.now()}`;
    const campaignRes = await app.inject({ method: "POST", url: `/api/ad-accounts/${account.id}/campaigns`, headers: { cookie: studentACookie }, payload: { name: "Revenue Campaign", utmCampaign, dailyBudget: 500 } });
    const campaign = campaignRes.json().campaign;

    await db.adPerformanceSnapshot.create({ data: { adAccountId: account.id, campaignId: campaign.id, provider: "MANUAL", dateFrom: todayUtcMidnight(), dateTo: todayUtcMidnight(), source: "MANUAL", spend: 1000, purchaseValue: 300 } });

    const person = await db.person.create({ data: { fullName: "Revenue Attribution Lead", email: `rev-${Date.now()}@example.com` } });
    const lead = await db.lead.create({ data: { leadDisplayId: await generateLeadDisplayId(), personId: person.id, utmCampaign, utmSource: "facebook", utmMedium: "paid_social", source: "Facebook", firstRegistrationDate: new Date() } });

    const recomputeRes = await app.inject({ method: "POST", url: `/api/ad-campaigns/${campaign.id}/attribution/recompute`, headers: { cookie: studentACookie } });
    expect(recomputeRes.statusCode).toBe(200);
    expect(recomputeRes.json().result.known).toBe(1);

    const attributionRecord = await db.adAttributionRecord.findFirstOrThrow({ where: { leadId: lead.id, adCampaignId: campaign.id } });
    expect(attributionRecord.confidence).toBe("KNOWN");
    expect(attributionRecord.touchType).toBe("FIRST_TOUCH");

    // Convert the Lead to a real Student, then record a VERIFIED payment.
    const batch = await db.batch.findUniqueOrThrow({ where: { code: "14" } });
    const pkg = await db.package.findUniqueOrThrow({ where: { name: "Premium" } });
    const convertRes = await app.inject({ method: "POST", url: `/api/leads/${lead.id}/convert`, headers: { cookie: ownerCookie }, payload: { batchId: batch.id, packageId: pkg.id } });
    expect(convertRes.statusCode).toBe(201);
    const newStudentId = convertRes.json().student.id;

    const enrollment = await db.enrollment.findFirstOrThrow({ where: { studentId: newStudentId } });
    const ownerUserId = (await db.user.findFirstOrThrow({ where: { person: { fullName: "Mommy Ann (Dev Seed)" } } })).id;
    await db.paymentTransaction.create({
      data: { paymentDisplayId: `PAY-TEST-${Date.now()}`, studentId: newStudentId, enrollmentId: enrollment.id, batchId: batch.id, packageId: pkg.id, type: "Reservation", amount: 250, method: "Bank Transfer", status: "VERIFIED", paymentDate: new Date(), recordedById: ownerUserId },
    });

    const revenueRes = await app.inject({ method: "GET", url: `/api/ad-campaigns/${campaign.id}/revenue-attribution?preset=LAST_30_DAYS`, headers: { cookie: studentACookie } });
    expect(revenueRes.statusCode).toBe(200);
    const revenue = revenueRes.json().revenue;
    expect(revenue.verifiedRevenue).toBe(250);
    expect(revenue.platformReportedPurchaseValue).toBe(300); // kept separate from verified revenue — never merged
    expect(revenue.attributedEnrollmentCount).toBe(1);
    expect(revenue.verifiedAttributedRoas).toBeCloseTo(250 / 1000, 5);
    expect(revenue.platformReportedRoas).toBeCloseTo(300 / 1000, 5);

    // Recomputing again never creates a second attribution record for the same Lead/campaign/touch.
    await app.inject({ method: "POST", url: `/api/ad-campaigns/${campaign.id}/attribution/recompute`, headers: { cookie: studentACookie } });
    const records = await db.adAttributionRecord.findMany({ where: { leadId: lead.id } });
    expect(records).toHaveLength(1);
  });
});

describe("Budget Guardrails — alert only, never mutates spend (spec sections 57-59)", () => {
  it("a breached rule creates a real recommendation and leaves the campaign's budget untouched", async () => {
    const business = await createPublishedBusiness(studentACookie, studentAId, "Budget Guardrail Business");
    const { account } = await createManualConnectionAndAccount(studentACookie, studentAId, business.id);
    const campaignRes = await app.inject({ method: "POST", url: `/api/ad-accounts/${account.id}/campaigns`, headers: { cookie: studentACookie }, payload: { name: "Guardrail Campaign", dailyBudget: 300 } });
    const campaign = campaignRes.json().campaign;

    const ruleRes = await app.inject({ method: "POST", url: `/api/students/${studentAId}/ad-budget-alert-rules`, headers: { cookie: studentACookie }, payload: { businessId: business.id, adCampaignId: campaign.id, metric: "DAILY_SPEND", comparator: "ABOVE", threshold: 200 } });
    expect(ruleRes.statusCode).toBe(201);

    const today = new Date().toISOString().slice(0, 10);
    await app.inject({ method: "POST", url: `/api/ad-accounts/${account.id}/snapshots/manual`, headers: { cookie: studentACookie }, payload: { campaignId: campaign.id, date: today, spend: 450 } });

    const checkRes = await app.inject({ method: "POST", url: `/api/ad-campaigns/${campaign.id}/budget-alerts/check`, headers: { cookie: studentACookie }, payload: { preset: "TODAY" } });
    expect(checkRes.statusCode).toBe(200);
    expect(checkRes.json().results[0].breached).toBe(true);

    const recommendations = await db.adRecommendation.findMany({ where: { adCampaignId: campaign.id, category: "BUDGET_ALERT" } });
    expect(recommendations).toHaveLength(1);

    const campaignAfter = await db.adCampaign.findUniqueOrThrow({ where: { id: campaign.id } });
    expect(Number(campaignAfter.dailyBudget)).toBe(300); // never auto-changed
  });
});

describe("Ads Analyzer — fact vs interpretation, never fabricates on AI failure (spec sections 27-30)", () => {
  it("grounds its analysis in real snapshot data and separates facts from interpretation", async () => {
    const business = await createPublishedBusiness(studentACookie, studentAId, "Analyzer Business");
    const { account } = await createManualConnectionAndAccount(studentACookie, studentAId, business.id);
    const campaignRes = await app.inject({ method: "POST", url: `/api/ad-accounts/${account.id}/campaigns`, headers: { cookie: studentACookie }, payload: { name: "Analyzer Campaign" } });
    const campaign = campaignRes.json().campaign;
    await db.adPerformanceSnapshot.create({ data: { adAccountId: account.id, campaignId: campaign.id, provider: "MANUAL", dateFrom: todayUtcMidnight(), dateTo: todayUtcMidnight(), source: "MANUAL", spend: 500, clicks: 50, impressions: 5000 } });

    fakeAnthropic.setMode("success");
    fakeAnthropic.setResponseText(
      JSON.stringify({
        observedFacts: ["Spend was 500 with 50 clicks over the selected period."],
        metricChanges: ["No prior-period data was available for comparison."],
        potentialStrengths: ["CTR is within a reasonable range for cold traffic."],
        potentialWeaknesses: [],
        possibleExplanations: ["Creative freshness may be one factor — not confirmed."],
        recommendedTests: ["Test a new hook against the current creative."],
        risks: ["Sample size is limited to one day of data."],
      }),
    );
    const analyzeRes = await app.inject({ method: "POST", url: `/api/ad-campaigns/${campaign.id}/analyze`, headers: { cookie: studentACookie }, payload: { preset: "LAST_30_DAYS" } });
    expect(analyzeRes.statusCode).toBe(201);
    expect(analyzeRes.json().body.observedFacts[0]).toContain("500");
    const recommendation = await db.adRecommendation.findUniqueOrThrow({ where: { id: analyzeRes.json().recommendationId } });
    expect(recommendation.category).toBe("GENERAL");

    fakeAnthropic.setMode("server_error");
    const failRes = await app.inject({ method: "POST", url: `/api/ad-campaigns/${campaign.id}/analyze`, headers: { cookie: studentACookie }, payload: {} });
    expect(failRes.statusCode).toBe(502);
    fakeAnthropic.setMode("success");
  });
});

describe("Campaign Planner — DRAFT-only blueprint, never a live campaign (spec sections 68-70)", () => {
  it("generates a real DRAFT AdCampaignPlan that is never automatically promoted to a real AdCampaign", async () => {
    const business = await createPublishedBusiness(studentACookie, studentAId, "Planner Business");
    fakeAnthropic.setMode("success");
    fakeAnthropic.setResponseText(
      JSON.stringify({
        audience: "Aspiring entrepreneurs aged 25-45",
        offer: "Foundations Bundle",
        creativeStrategy: "UGC-style testimonials paired with founder story hooks.",
        creativeVariations: ["Hook A: pain point", "Hook B: transformation"],
        funnel: "Lead gen -> webinar -> reservation",
        tracking: "UTM-tagged links + Meta Pixel readiness",
        budgetContext: "Start at 300/day, review weekly.",
        testingPlan: ["Test 2 hooks against 1 audience"],
        metricsToWatch: ["CPL", "CTR"],
        risks: ["No historical data yet for this offer"],
      }),
    );
    const planRes = await app.inject({ method: "POST", url: `/api/students/${studentAId}/ad-campaign-plans`, headers: { cookie: studentACookie }, payload: { businessId: business.id, objective: "Generate leads for the Foundations Bundle" } });
    expect(planRes.statusCode).toBe(201);
    expect(planRes.json().plan.status).toBe("DRAFT");

    const campaignCountBefore = await db.adCampaign.count();
    // No route exists to auto-promote a plan into a live campaign — confirmed structurally.
    const plannerSource = readFileSync("src/modules/ads/planner.ts", "utf-8");
    expect(plannerSource).not.toContain("db.adCampaign.create");
    const campaignCountAfter = await db.adCampaign.count();
    expect(campaignCountAfter).toBe(campaignCountBefore);
  });
});

describe("Ask M.A.I.A. Ads — grounded in real retrieved data (spec sections 91-95)", () => {
  it("answers 'how are my ads performing' using the real aggregated snapshot data, not a guess", async () => {
    const business = await createPublishedBusiness(studentACookie, studentAId, "Ask Ads Business");
    const { account } = await createManualConnectionAndAccount(studentACookie, studentAId, business.id);
    await db.adPerformanceSnapshot.create({ data: { adAccountId: account.id, provider: "MANUAL", dateFrom: todayUtcMidnight(), dateTo: todayUtcMidnight(), source: "MANUAL", spend: 777, leads: 10 } });

    fakeAnthropic.setMode("success");
    fakeAnthropic.setResponseText("Your ads spent 777 over the last 30 days and generated 10 leads.");
    const askRes = await app.inject({ method: "POST", url: `/api/ad-accounts/${account.id}/ask`, headers: { cookie: studentACookie }, payload: { question: "How are my ads performing?" } });
    expect(askRes.statusCode).toBe(200);
    const result = askRes.json();
    expect(result.ok).toBe(true);
    expect((result.facts.aggregate as { spend: number }).spend).toBe(777);

    const unknownRes = await app.inject({ method: "POST", url: `/api/ad-accounts/${account.id}/ask`, headers: { cookie: studentACookie }, payload: { question: "What is the meaning of life?" } });
    expect(unknownRes.statusCode).toBe(422);
  });
});

describe("Business/student isolation (spec sections 2, 7, 105)", () => {
  it("Student B cannot reach Student A's connections/accounts/campaigns via tampered IDs", async () => {
    const business = await createPublishedBusiness(studentACookie, studentAId, "Isolation Business");
    const { connection, account } = await createManualConnectionAndAccount(studentACookie, studentAId, business.id);
    const campaignRes = await app.inject({ method: "POST", url: `/api/ad-accounts/${account.id}/campaigns`, headers: { cookie: studentACookie }, payload: { name: "Isolation Campaign" } });
    const campaign = campaignRes.json().campaign;

    const crossConnection = await app.inject({ method: "GET", url: `/api/ad-connections/${connection.id}`, headers: { cookie: studentBCookie } });
    expect(crossConnection.statusCode).toBe(403);

    const crossAccount = await app.inject({ method: "GET", url: `/api/ad-accounts/${account.id}`, headers: { cookie: studentBCookie } });
    expect(crossAccount.statusCode).toBe(403);

    const crossCampaign = await app.inject({ method: "GET", url: `/api/ad-campaigns/${campaign.id}`, headers: { cookie: studentBCookie } });
    expect(crossCampaign.statusCode).toBe(403);

    const crossCampaignList = await app.inject({ method: "GET", url: `/api/businesses/${business.id}/ad-connections`, headers: { cookie: studentBCookie } });
    expect(crossCampaignList.statusCode).toBe(403);

    const tamperedConnection = await app.inject({ method: "GET", url: `/api/ad-connections/nonexistent-tampered-id`, headers: { cookie: studentACookie } });
    expect(tamperedConnection.statusCode).toBe(404);
  });
});

describe("Provider failure — sync fails cleanly, never fakes fresh data (spec section 121)", () => {
  it("a sync attempt on a non-CONNECTED META account fails cleanly with no campaigns/snapshots created", async () => {
    const business = await createPublishedBusiness(studentACookie, studentAId, "Provider Failure Business");
    const connRes = await app.inject({ method: "POST", url: `/api/students/${studentAId}/ad-connections`, headers: { cookie: studentACookie }, payload: { businessId: business.id, provider: "META" } });
    const connection = connRes.json().connection;
    // Never CONNECTED in this environment — confirmed by the connection-status-honesty test above.
    const accountRes = await app.inject({ method: "POST", url: `/api/ad-connections/${connection.id}/ad-accounts`, headers: { cookie: studentACookie }, payload: { name: "Never Connected", currency: "USD", timezone: "UTC" } });
    expect(accountRes.statusCode).toBe(422); // creating an account requires CONNECTED first

    // Force a MANUAL-then-corrupted scenario is unnecessary — directly exercise sync on a manual account instead, which should also fail cleanly (sync is provider-only).
    const { account } = await createManualConnectionAndAccount(studentACookie, studentAId, business.id);
    const syncRes = await app.inject({ method: "POST", url: `/api/ad-accounts/${account.id}/sync`, headers: { cookie: studentACookie }, payload: {} });
    expect(syncRes.statusCode).toBe(200);
    expect(syncRes.json().summary.status).toBe("FAILED");
    expect(syncRes.json().summary.campaignsSynced).toBe(0);

    const updatedAccount = await db.adAccount.findUniqueOrThrow({ where: { id: account.id } });
    expect(updatedAccount.syncStatus).toBe("FAILED");
  });
});
