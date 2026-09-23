// Budget Center + Guardrails (spec sections 56-59). An alert is only ever a
// recommendation — nothing in this module (or anywhere in this codebase)
// ever writes to AdCampaign.dailyBudget/lifetimeBudget as a side effect of
// a threshold breach. Budget change still requires the human approval
// workflow in optimization.ts, which itself never reaches a real provider
// call in this build (spec sections 12, 58-59).

import type { Prisma } from "@prisma/client";
import { db } from "../../db.js";
import { generateAdRecommendationDisplayId } from "../sequence.js";
import { aggregateSnapshots, deriveMetrics } from "./metrics.js";

export interface BudgetOverviewRow {
  campaignId: string;
  campaignName: string;
  configuredDailyBudget: number | null;
  configuredLifetimeBudget: number | null;
  actualSpend: number | null;
  remainingPlannedBudget: number | null; // lifetimeBudget - actualSpend, only when lifetimeBudget is known
  currency: string | null;
}

export async function getBudgetCenterOverview(adAccountId: string, dateFrom: Date, dateTo: Date): Promise<BudgetOverviewRow[]> {
  const campaigns = await db.adCampaign.findMany({ where: { adAccountId } });
  const rows: BudgetOverviewRow[] = [];
  for (const campaign of campaigns) {
    const snapshots = await db.adPerformanceSnapshot.findMany({ where: { campaignId: campaign.id, dateFrom: { gte: dateFrom }, dateTo: { lte: dateTo } } });
    const aggregate = aggregateSnapshots(snapshots);
    const lifetimeBudget = campaign.lifetimeBudget ? Number(campaign.lifetimeBudget) : null;
    rows.push({
      campaignId: campaign.id,
      campaignName: campaign.name,
      configuredDailyBudget: campaign.dailyBudget ? Number(campaign.dailyBudget) : null,
      configuredLifetimeBudget: lifetimeBudget,
      actualSpend: aggregate.spend,
      remainingPlannedBudget: lifetimeBudget !== null && aggregate.spend !== null ? lifetimeBudget - aggregate.spend : null,
      currency: campaign.currency,
    });
  }
  return rows;
}

export interface AlertCheckResult {
  ruleId: string;
  metric: string;
  comparator: string;
  threshold: number;
  observedValue: number | null;
  breached: boolean;
}

function metricValue(metric: string, agg: ReturnType<typeof aggregateSnapshots>, derived: ReturnType<typeof deriveMetrics>): number | null {
  switch (metric) {
    case "DAILY_SPEND":
    case "CAMPAIGN_SPEND":
      return agg.spend;
    case "CPL":
      return derived.cpl;
    case "COST_PER_CONVERSATION":
      return agg.spend !== null && agg.messages !== null && agg.messages > 0 ? agg.spend / agg.messages : null;
    case "ROAS":
      return derived.platformReportedRoas;
    default:
      return null;
  }
}

/** Checks every active rule for a campaign against its current spend window and creates a real AdRecommendation for each breach. Never mutates budget. */
export async function checkBudgetAlerts(adCampaignId: string, dateFrom: Date, dateTo: Date): Promise<AlertCheckResult[]> {
  const campaign = await db.adCampaign.findUniqueOrThrow({ where: { id: adCampaignId } });
  const rules = await db.adBudgetAlertRule.findMany({ where: { isActive: true, OR: [{ adCampaignId }, { adCampaignId: null, studentId: campaign.studentId, businessId: campaign.businessId }] } });
  if (rules.length === 0) return [];

  const snapshots = await db.adPerformanceSnapshot.findMany({ where: { campaignId: adCampaignId, dateFrom: { gte: dateFrom }, dateTo: { lte: dateTo } } });
  const aggregate = aggregateSnapshots(snapshots);
  const derived = deriveMetrics(aggregate);

  const results: AlertCheckResult[] = [];
  for (const rule of rules) {
    const observed = metricValue(rule.metric, aggregate, derived);
    const threshold = Number(rule.threshold);
    const breached = observed !== null && (rule.comparator === "ABOVE" ? observed > threshold : observed < threshold);
    results.push({ ruleId: rule.id, metric: rule.metric, comparator: rule.comparator, threshold, observedValue: observed, breached });

    if (breached) {
      await db.adRecommendation.create({
        data: {
          recommendationDisplayId: await generateAdRecommendationDisplayId(),
          studentId: campaign.studentId,
          businessId: campaign.businessId,
          adCampaignId: campaign.id,
          category: "BUDGET_ALERT",
          title: `Budget alert: ${rule.metric} ${rule.comparator === "ABOVE" ? "above" : "below"} threshold`,
          bodyJson: {
            observedFacts: [`${rule.metric} is ${observed?.toFixed(2)} (threshold: ${rule.comparator} ${threshold}).`],
            potentialStrengths: [],
            potentialWeaknesses: [`${rule.metric} has crossed the configured guardrail.`],
            possibleExplanations: ["Review recent spend/delivery changes for this campaign."],
            recommendedTests: [],
            risks: ["This is an alert, not an automatic change — spend/budget is unchanged."],
          } as unknown as Prisma.InputJsonValue,
          status: "OPEN",
        },
      });
    }
  }
  return results;
}
