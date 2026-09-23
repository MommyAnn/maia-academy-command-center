// Optimization Center (spec sections 60-66, 78-82). Every optimization
// action is a request that requires explicit human approval — nothing in
// this module (or anywhere in this codebase) ever calls a real ad-platform
// mutation. Once approved, the action's terminal state is honestly
// CANNOT_EXECUTE_NO_PROVIDER: this build has no write-capable provider
// connection (spec sections 9-12, 111-114), so "approved" never silently
// becomes "done".

import type { Prisma } from "@prisma/client";
import { db } from "../../db.js";
import { writeAuditLog } from "../../audit/log.js";
import { generateAdOptimizationActionDisplayId, generateAdRecommendationDisplayId } from "../sequence.js";
import { getMarketingFunnelView } from "./attribution.js";
import { aggregateSnapshots, deriveMetrics } from "./metrics.js";

export type RequestOutcome = { ok: true; actionId: string } | { ok: false; httpStatus: number; reason: string };

export async function requestOptimizationAction(input: {
  studentId: string;
  businessId: string;
  adCampaignId: string;
  actionType: "BUDGET_CHANGE_REQUESTED" | "PAUSE_REQUESTED" | "RESUME_REQUESTED";
  currentValue?: unknown;
  proposedValue?: unknown;
  reason?: string;
  recommendationId?: string;
  requestedById: string;
}): Promise<RequestOutcome> {
  const campaign = await db.adCampaign.findUnique({ where: { id: input.adCampaignId } });
  if (!campaign || campaign.studentId !== input.studentId || campaign.businessId !== input.businessId) {
    return { ok: false, httpStatus: 403, reason: "This campaign does not belong to the requesting student/business." };
  }

  const action = await db.adOptimizationAction.create({
    data: {
      actionDisplayId: await generateAdOptimizationActionDisplayId(),
      studentId: input.studentId,
      businessId: input.businessId,
      adCampaignId: input.adCampaignId,
      recommendationId: input.recommendationId ?? null,
      actionType: input.actionType,
      currentValueJson: (input.currentValue as Prisma.InputJsonValue) ?? undefined,
      proposedValueJson: (input.proposedValue as Prisma.InputJsonValue) ?? undefined,
      reason: input.reason ?? null,
      status: "PENDING_APPROVAL",
      requestedById: input.requestedById,
    },
  });
  await writeAuditLog({ action: "Ad Optimization Action Requested", summary: `${input.actionType} requested for campaign "${campaign.name}"`, actorUserId: input.requestedById, entityType: "AdOptimizationAction", entityId: action.id });
  return { ok: true, actionId: action.id };
}

export type DecideOutcome = { ok: true; status: string } | { ok: false; httpStatus: number; reason: string };

export async function decideOptimizationAction(input: { actionId: string; decision: "APPROVED" | "REJECTED"; approvedById: string }): Promise<DecideOutcome> {
  const action = await db.adOptimizationAction.findUnique({ where: { id: input.actionId } });
  if (!action) return { ok: false, httpStatus: 404, reason: "Optimization action not found." };
  if (action.status !== "PENDING_APPROVAL") return { ok: false, httpStatus: 422, reason: `Only a PENDING_APPROVAL action can be decided (current status: ${action.status}).` };

  if (input.decision === "REJECTED") {
    await db.adOptimizationAction.update({ where: { id: input.actionId }, data: { status: "REJECTED", approvedById: input.approvedById, decidedAt: new Date() } });
    await writeAuditLog({ action: "Ad Optimization Action Decided", summary: `Optimization action rejected`, actorUserId: input.approvedById, entityType: "AdOptimizationAction", entityId: input.actionId });
    return { ok: true, status: "REJECTED" };
  }

  // Approval never silently becomes execution — this build has no
  // write-capable provider connection anywhere (spec sections 9-12).
  await db.adOptimizationAction.update({ where: { id: input.actionId }, data: { status: "CANNOT_EXECUTE_NO_PROVIDER", approvedById: input.approvedById, decidedAt: new Date() } });
  await writeAuditLog({ action: "Ad Optimization Action Decided", summary: `Optimization action approved — CANNOT_EXECUTE_NO_PROVIDER (no write-capable provider connected)`, actorUserId: input.approvedById, entityType: "AdOptimizationAction", entityId: input.actionId });
  return { ok: true, status: "CANNOT_EXECUTE_NO_PROVIDER" };
}

// --- Full-funnel diagnostic (spec sections 61-63) ---------------------------
// Deterministic, evidence-based hypotheses only — never a guaranteed
// diagnosis (spec section 62). Every finding cites the real numbers behind
// it and is persisted as a real AdRecommendation for the Optimization
// Center to list.

export async function runFullFunnelDiagnostic(adCampaignId: string, dateFrom: Date, dateTo: Date): Promise<{ findings: string[] }> {
  const campaign = await db.adCampaign.findUniqueOrThrow({ where: { id: adCampaignId } });
  const snapshots = await db.adPerformanceSnapshot.findMany({ where: { campaignId: adCampaignId, dateFrom: { gte: dateFrom }, dateTo: { lte: dateTo } } });
  const aggregate = aggregateSnapshots(snapshots);
  const derived = deriveMetrics(aggregate);
  const stages = await getMarketingFunnelView(adCampaignId, dateFrom, dateTo);
  const byStage = Object.fromEntries(stages.map((s) => [s.stage, s.value]));

  const findings: string[] = [];

  const makeRecommendation = async (category: string, title: string, observedFacts: string[]) => {
    await db.adRecommendation.create({
      data: {
        recommendationDisplayId: await generateAdRecommendationDisplayId(),
        studentId: campaign.studentId,
        businessId: campaign.businessId,
        adCampaignId,
        category,
        title,
        bodyJson: {
          observedFacts,
          potentialStrengths: [],
          potentialWeaknesses: [],
          possibleExplanations: [title + " is one possible explanation among several — not a confirmed diagnosis."],
          recommendedTests: [],
          risks: ["Other funnel stages or external factors may also explain this pattern."],
        } as unknown as Prisma.InputJsonValue,
        status: "OPEN",
      },
    });
  };

  if (derived.ctr !== null && derived.ctr < 0.01) {
    findings.push(`LOW CTR (${(derived.ctr * 100).toFixed(2)}%) → Review Hook / Creative / Audience Match.`);
    await makeRecommendation("TEST_SUGGESTION", "Low CTR — review hook/creative/audience match", [`CTR was ${(derived.ctr * 100).toFixed(2)}% over the selected period.`]);
  }

  const landingPageViews = byStage.LANDING_PAGE_VIEWS;
  const leads = byStage.LEADS;
  if (derived.ctr !== null && derived.ctr >= 0.01 && landingPageViews !== null && landingPageViews > 0 && leads !== null) {
    const conversionRate = leads / landingPageViews;
    if (conversionRate < 0.05) {
      findings.push(`GOOD CTR + HIGH LANDING PAGE DROP (${(conversionRate * 100).toFixed(2)}% page-to-lead) → Review Landing Page.`);
      await makeRecommendation("LANDING_PAGE_DROP", "High landing page drop-off — review the landing page", [`${leads} leads from ${landingPageViews} landing page views (${(conversionRate * 100).toFixed(2)}%).`]);
    }
  }

  const registrations = byStage.WEBINAR_OR_INQUIRY;
  if (leads !== null && leads > 0 && registrations !== null) {
    const followUpRate = registrations / leads;
    if (followUpRate < 0.2) {
      findings.push(`GOOD LEADS + LOW FOLLOW-UP (${(followUpRate * 100).toFixed(2)}%) → Review Operations / Follow-Up.`);
      await makeRecommendation("LEAD_FOLLOWUP_GAP", "Low lead follow-up — review operations", [`${registrations} of ${leads} leads reached a webinar/inquiry stage (${(followUpRate * 100).toFixed(2)}%).`]);
    }
  }

  const reservations = byStage.RESERVATION;
  const verifiedPayments = byStage.VERIFIED_REVENUE_PAYMENTS;
  if (reservations !== null && reservations > 0 && verifiedPayments !== null) {
    const verifyRate = verifiedPayments / reservations;
    if (verifyRate < 0.5) {
      findings.push(`GOOD RESERVATIONS + LOW VERIFIED PAYMENT (${(verifyRate * 100).toFixed(2)}%) → Review Payment Journey.`);
      await makeRecommendation("GENERAL", "Low reservation-to-verified-payment rate — review payment journey", [`${verifiedPayments} of ${reservations} reservations reached VERIFIED (${(verifyRate * 100).toFixed(2)}%).`]);
    }
  }

  return { findings };
}
