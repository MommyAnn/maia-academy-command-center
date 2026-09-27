// M.A.I.A. Business OS — Business Home aggregation (spec sections 4-9,
// 16-19, 91). Every signal below is a real query against real data;
// nothing here is an invented score. Business Health deliberately uses
// explainable string statuses, never a 0-100 AI score (spec section 16).

import type { FastifyInstance } from "fastify";
import { db } from "../../db.js";
import { requireAuth, assertBusinessAccess, type AuthContext } from "../../rbac/middleware.js";

async function authorize(request: { authContext?: AuthContext }, businessId: string): Promise<boolean> {
  const ctx = request.authContext;
  if (!ctx) return false;
  return assertBusinessAccess(businessId, ctx, "VIEW");
}

export interface HealthCategory {
  category: string;
  status: "SETUP_REQUIRED" | "NEEDS_ATTENTION" | "OPERATIONAL" | "INSUFFICIENT_DATA";
  reason: string;
}

export async function computeBusinessHealth(businessId: string): Promise<HealthCategory[]> {
  const [publishedMasterBrain, approvedPlanVersion, campaignCount, activeCampaignCount, contactCount, opportunityCount, journeyCount, sopCount, automationCount, activeAutomationCount, recentFailedRuns, revenueRecordCount, expenseRecordCount] = await Promise.all([
    db.masterBrainDocument.findFirst({ where: { businessId, isCurrentPublished: true } }),
    db.businessPlanVersion.findFirst({ where: { businessPlan: { businessId }, status: "APPROVED" } }),
    db.campaign.count({ where: { businessId } }),
    db.campaign.count({ where: { businessId, status: "ACTIVE" } }),
    db.businessContact.count({ where: { businessId } }),
    db.opportunity.count({ where: { businessId } }),
    db.customerJourney.count({ where: { businessId } }),
    db.sopDocument.count({ where: { businessId } }),
    db.automation.count({ where: { businessId } }),
    db.automation.count({ where: { businessId, status: "ACTIVE" } }),
    db.automationRun.count({ where: { automation: { businessId }, status: "FAILED", startedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } }),
    db.businessRevenueRecord.count({ where: { businessId } }),
    db.businessExpenseRecord.count({ where: { businessId } }),
  ]);
  const financeRecordCount = revenueRecordCount + expenseRecordCount;

  const categories: HealthCategory[] = [];

  categories.push(
    publishedMasterBrain || approvedPlanVersion
      ? { category: "FOUNDATION", status: "OPERATIONAL", reason: "A published Master Brain or approved Business Plan exists." }
      : { category: "FOUNDATION", status: "SETUP_REQUIRED", reason: "No published Master Brain or approved Business Plan yet." },
  );

  if (campaignCount === 0) {
    categories.push({ category: "MARKETING", status: "SETUP_REQUIRED", reason: "No campaigns created yet." });
  } else if (activeCampaignCount === 0) {
    categories.push({ category: "MARKETING", status: "NEEDS_ATTENTION", reason: `${campaignCount} campaign(s) exist, but none are currently ACTIVE.` });
  } else {
    categories.push({ category: "MARKETING", status: "OPERATIONAL", reason: `${activeCampaignCount} of ${campaignCount} campaign(s) are ACTIVE.` });
  }

  categories.push(
    contactCount === 0
      ? { category: "LEAD_GENERATION", status: "SETUP_REQUIRED", reason: "No business contacts/leads recorded yet." }
      : { category: "LEAD_GENERATION", status: "OPERATIONAL", reason: `${contactCount} contact(s) recorded.` },
  );

  categories.push(
    opportunityCount === 0
      ? { category: "SALES_PROCESS", status: "SETUP_REQUIRED", reason: "No sales opportunities recorded yet." }
      : { category: "SALES_PROCESS", status: "OPERATIONAL", reason: `${opportunityCount} opportunity(ies) recorded.` },
  );

  categories.push(
    journeyCount === 0
      ? { category: "CUSTOMER_JOURNEY", status: "SETUP_REQUIRED", reason: "No customer journey mapped yet." }
      : { category: "CUSTOMER_JOURNEY", status: "OPERATIONAL", reason: `${journeyCount} customer journey stage set(s) exist.` },
  );

  categories.push(
    sopCount === 0
      ? { category: "OPERATIONS", status: "SETUP_REQUIRED", reason: "No SOPs documented yet." }
      : { category: "OPERATIONS", status: "OPERATIONAL", reason: `${sopCount} SOP(s) documented.` },
  );

  if (recentFailedRuns > 0) {
    categories.push({ category: "AUTOMATION", status: "NEEDS_ATTENTION", reason: `${recentFailedRuns} active automation run(s) failed during the last 7 days.` });
  } else if (automationCount === 0) {
    categories.push({ category: "AUTOMATION", status: "SETUP_REQUIRED", reason: "No automations built yet." });
  } else if (activeAutomationCount === 0) {
    categories.push({ category: "AUTOMATION", status: "NEEDS_ATTENTION", reason: `${automationCount} automation(s) exist, but none are ACTIVE.` });
  } else {
    categories.push({ category: "AUTOMATION", status: "OPERATIONAL", reason: `${activeAutomationCount} of ${automationCount} automation(s) are ACTIVE, no failures in the last 7 days.` });
  }

  categories.push(
    financeRecordCount === 0
      ? { category: "FINANCE_DATA", status: "INSUFFICIENT_DATA", reason: "No revenue or expense records recorded yet." }
      : { category: "FINANCE_DATA", status: "OPERATIONAL", reason: `${financeRecordCount} finance record(s) recorded.` },
  );

  return categories;
}

export interface ActionItem {
  type: string;
  title: string;
  entityType: string;
  entityId: string;
  ownerHint?: string;
}

/** Real, currently-open items pulled from existing modules — never invented (spec sections 19-21). */
export async function computeActionCenter(businessId: string): Promise<ActionItem[]> {
  const [failedRuns, pendingCreativeScripts, openOpportunitiesNoNextAction, staleContacts] = await Promise.all([
    db.automationRun.findMany({ where: { automation: { businessId }, status: "FAILED" }, take: 20, orderBy: { startedAt: "desc" }, select: { id: true, runDisplayId: true, automationId: true } }),
    db.script.findMany({ where: { businessId, status: "Draft" }, take: 20, select: { id: true, campaignId: true } }),
    db.opportunity.findMany({ where: { businessId, status: "OPEN", nextAction: null }, take: 20, select: { id: true, opportunityDisplayId: true } }),
    db.businessContact.findMany({ where: { businessId, status: "Active", updatedAt: { lte: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) } }, take: 20, select: { id: true, contactDisplayId: true } }),
  ]);

  const items: ActionItem[] = [];
  for (const r of failedRuns) items.push({ type: "FIX", title: `Automation run ${r.runDisplayId} failed`, entityType: "AutomationRun", entityId: r.id });
  for (const s of pendingCreativeScripts) items.push({ type: "REVIEW", title: "A creative script is waiting for review", entityType: "Script", entityId: s.id });
  for (const o of openOpportunitiesNoNextAction) items.push({ type: "ASSIGN", title: `Opportunity ${o.opportunityDisplayId} has no next action set`, entityType: "Opportunity", entityId: o.id });
  for (const c of staleContacts) items.push({ type: "FOLLOW_UP", title: `Contact ${c.contactDisplayId} has had no activity in 3+ days`, entityType: "BusinessContact", entityId: c.id });
  return items;
}

export async function businessHomeRoutes(app: FastifyInstance) {
  app.get("/api/businesses/:businessId/snapshot", { preHandler: [requireAuth] }, async (request, reply) => {
    const { businessId } = request.params as { businessId: string };
    if (!(await authorize(request, businessId))) return reply.code(403).send({ error: "Forbidden: this business does not belong to you." });
    const business = await db.business.findUniqueOrThrow({ where: { id: businessId } });
    const masterBrainDoc = await db.masterBrainDocument.findFirst({ where: { businessId }, orderBy: { generatedAt: "desc" } });
    const masterBrainStatus = !masterBrainDoc ? "NOT_STARTED" : masterBrainDoc.isCurrentPublished ? "PUBLISHED" : "DRAFT";
    return reply.send({
      business: { id: business.id, name: business.name, stage: business.stage, uiExperienceLevel: business.uiExperienceLevel, createdAt: business.createdAt },
      masterBrainStatus,
    });
  });

  app.get("/api/businesses/:businessId/health", { preHandler: [requireAuth] }, async (request, reply) => {
    const { businessId } = request.params as { businessId: string };
    if (!(await authorize(request, businessId))) return reply.code(403).send({ error: "Forbidden: this business does not belong to you." });
    return reply.send({ categories: await computeBusinessHealth(businessId) });
  });

  app.get("/api/businesses/:businessId/action-center", { preHandler: [requireAuth] }, async (request, reply) => {
    const { businessId } = request.params as { businessId: string };
    if (!(await authorize(request, businessId))) return reply.code(403).send({ error: "Forbidden: this business does not belong to you." });
    return reply.send({ items: await computeActionCenter(businessId) });
  });

  app.get("/api/businesses/:businessId/timeline", { preHandler: [requireAuth] }, async (request, reply) => {
    const { businessId } = request.params as { businessId: string };
    if (!(await authorize(request, businessId))) return reply.code(403).send({ error: "Forbidden: this business does not belong to you." });
    // ActivityLog entries whose entityId is one of this business's own
    // records — approximated by direct entityType/entityId membership
    // rather than a businessId column on ActivityLog itself (spec 91).
    const [campaignIds, automationIds, websiteIds, opportunityIds, goalIds] = await Promise.all([
      db.campaign.findMany({ where: { businessId }, select: { id: true } }),
      db.automation.findMany({ where: { businessId }, select: { id: true } }),
      db.websiteProject.findMany({ where: { businessId }, select: { id: true } }),
      db.opportunity.findMany({ where: { businessId }, select: { id: true } }),
      db.goal.findMany({ where: { businessId }, select: { id: true } }),
    ]);
    const entityIds = [...campaignIds, ...automationIds, ...websiteIds, ...opportunityIds, ...goalIds].map((r) => r.id);
    if (entityIds.length === 0) return reply.send({ events: [] });
    const events = await db.activityLog.findMany({ where: { entityId: { in: entityIds } }, orderBy: { occurredAt: "desc" }, take: 50 });
    return reply.send({ events });
  });

  // One combined call for the Business Home dashboard's first paint —
  // avoids loading every module's full dataset (spec section 131).
  app.get("/api/businesses/:businessId/home", { preHandler: [requireAuth] }, async (request, reply) => {
    const { businessId } = request.params as { businessId: string };
    if (!(await authorize(request, businessId))) return reply.code(403).send({ error: "Forbidden: this business does not belong to you." });
    const business = await db.business.findUniqueOrThrow({ where: { id: businessId } });
    const [health, actionItems, goals, openOpportunityCount, activeCampaignCount] = await Promise.all([
      computeBusinessHealth(businessId),
      computeActionCenter(businessId),
      db.goal.findMany({ where: { businessId }, take: 10, orderBy: { createdAt: "desc" } }),
      db.opportunity.count({ where: { businessId, status: "OPEN" } }),
      db.campaign.count({ where: { businessId, status: "ACTIVE" } }),
    ]);
    return reply.send({
      business: { id: business.id, name: business.name, stage: business.stage, uiExperienceLevel: business.uiExperienceLevel },
      health,
      actionItems,
      goals,
      salesSnapshot: { openOpportunityCount },
      marketingSnapshot: { activeCampaignCount },
    });
  });
}
