// M.A.I.A. Ads Brief (spec sections 89-90) — every number is a live
// database query, nothing cached or invented, mirroring Phase 10's Daily
// Brief pattern (src/modules/intelligence/brief.ts). A Student sees only
// their own business's data; an Owner/staff call scopes the same way via
// the route layer.

import { db } from "../../db.js";
import { aggregateSnapshots, deriveMetrics } from "./metrics.js";

export async function buildAdsBrief(adAccountId: string, dateFrom: Date, dateTo: Date) {
  const priorTo = new Date(dateFrom.getTime() - 24 * 60 * 60 * 1000);
  const priorFrom = new Date(priorTo.getTime() - (dateTo.getTime() - dateFrom.getTime()));

  const [currentSnapshots, priorSnapshots, campaigns, openRecommendations, testSuggestions] = await Promise.all([
    db.adPerformanceSnapshot.findMany({ where: { adAccountId, dateFrom: { gte: dateFrom }, dateTo: { lte: dateTo } } }),
    db.adPerformanceSnapshot.findMany({ where: { adAccountId, dateFrom: { gte: priorFrom }, dateTo: { lte: priorTo } } }),
    db.adCampaign.findMany({ where: { adAccountId } }),
    db.adRecommendation.count({ where: { adCampaign: { adAccountId }, status: "OPEN" } }),
    db.adRecommendation.findMany({ where: { adCampaign: { adAccountId }, status: "OPEN", category: { in: ["TEST_SUGGESTION", "CREATIVE_FATIGUE"] } }, take: 5, orderBy: { createdAt: "desc" } }),
  ]);

  const currentAggregate = aggregateSnapshots(currentSnapshots);
  const currentDerived = deriveMetrics(currentAggregate);
  const priorAggregate = aggregateSnapshots(priorSnapshots);
  const priorDerived = deriveMetrics(priorAggregate);

  return {
    dateRange: { from: dateFrom, to: dateTo },
    spend: { current: currentAggregate.spend, prior: priorAggregate.spend },
    results: { leads: currentAggregate.leads, purchases: currentAggregate.purchases, messages: currentAggregate.messages },
    derived: { current: currentDerived, prior: priorDerived },
    campaignCount: campaigns.length,
    openAlertsAndRecommendations: openRecommendations,
    recommendedTests: testSuggestions.map((r) => r.title),
  };
}
