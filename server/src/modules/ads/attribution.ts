// Funnel / Lead / Revenue Attribution (spec sections 41-55). Attribution is
// computed by matching a real Lead's own UTM fields (set once, at Lead
// creation, by Phase 2/4 — never touched by this module) against a real
// AdCampaign/Ad's own utmCampaign/utmContent values — never invented, never
// guessed. Only FIRST_TOUCH ever credits verified revenue (spec section
// 47's no-double-count rule), since Lead.utmCampaign is set exactly once,
// so a given Lead's revenue is attributed to at most one campaign.
//
// PLATFORM-REPORTED PURCHASE VALUE (from AdPerformanceSnapshot, spec 48-49)
// and M.A.I.A. VERIFIED REVENUE (from the real Finance ledger, spec 45-46)
// are always returned as two separate, clearly labeled numbers — never
// merged into one.

import { db } from "../../db.js";
import { aggregateSnapshots, deriveMetrics } from "./metrics.js";

export type TouchType = "FIRST_TOUCH" | "LATEST_TOUCH";
export type AttributionConfidence = "KNOWN" | "PARTIAL" | "UNKNOWN";

/**
 * Matches every Lead in this business against the given AdCampaign's real
 * utmCampaign value and (re)computes AdAttributionRecord rows. Idempotent —
 * safe to call repeatedly; recomputed rows are updated in place.
 */
export async function recomputeAttributionForCampaign(adCampaignId: string): Promise<{ known: number; partial: number }> {
  const campaign = await db.adCampaign.findUniqueOrThrow({ where: { id: adCampaignId } });
  if (!campaign.utmCampaign) return { known: 0, partial: 0 };

  // Lead has no direct businessId column (spec-honest limitation — Leads
  // are not yet business-scoped in this codebase's schema); attribution
  // here is therefore matched purely on UTM value, the same real signal a
  // real ad-platform-to-CRM integration would use, not a business-scoped
  // Lead list.
  const known = await db.lead.findMany({ where: { utmCampaign: { equals: campaign.utmCampaign, mode: "insensitive" } } });
  let knownCount = 0;
  for (const lead of known) {
    await db.adAttributionRecord.upsert({
      where: { leadId_adCampaignId_touchType: { leadId: lead.id, adCampaignId, touchType: "FIRST_TOUCH" } },
      update: { confidence: "KNOWN", matchedUtmJson: { utmCampaign: lead.utmCampaign, utmSource: lead.utmSource, utmMedium: lead.utmMedium } },
      create: { leadId: lead.id, adCampaignId, touchType: "FIRST_TOUCH", confidence: "KNOWN", matchedUtmJson: { utmCampaign: lead.utmCampaign, utmSource: lead.utmSource, utmMedium: lead.utmMedium } },
    });
    knownCount++;
  }

  // PARTIAL: the Lead's free-text `campaign` field mentions this campaign's
  // name, but the UTM value itself doesn't cleanly match — a weaker, more
  // honestly-labeled signal (spec section 44).
  const partialCandidates = await db.lead.findMany({ where: { campaign: { equals: campaign.name, mode: "insensitive" }, NOT: { utmCampaign: { equals: campaign.utmCampaign, mode: "insensitive" } } } });
  let partialCount = 0;
  for (const lead of partialCandidates) {
    await db.adAttributionRecord.upsert({
      where: { leadId_adCampaignId_touchType: { leadId: lead.id, adCampaignId, touchType: "FIRST_TOUCH" } },
      update: { confidence: "PARTIAL", matchedUtmJson: { campaignNameMatch: lead.campaign } },
      create: { leadId: lead.id, adCampaignId, touchType: "FIRST_TOUCH", confidence: "PARTIAL", matchedUtmJson: { campaignNameMatch: lead.campaign } },
    });
    partialCount++;
  }

  return { known: knownCount, partial: partialCount };
}

export interface AttributionCoverage {
  totalLeads: number;
  knownCount: number;
  partialCount: number;
  unknownCount: number;
  knownPct: number | null;
}

export async function getAttributionCoverage(businessId: string, dateFrom: Date, dateTo: Date): Promise<AttributionCoverage> {
  // Leads aren't business-scoped in this schema (spec-honest note above) —
  // coverage is computed against every Lead created in the window whose
  // utmCampaign matches ANY of this business's real AdCampaigns.
  const campaigns = await db.adCampaign.findMany({ where: { businessId }, select: { id: true } });
  const campaignIds = campaigns.map((c) => c.id);

  const totalLeads = await db.lead.count({ where: { createdAt: { gte: dateFrom, lte: dateTo } } });
  const records = await db.adAttributionRecord.findMany({ where: { adCampaignId: { in: campaignIds }, touchType: "FIRST_TOUCH" }, include: { lead: true } });
  const inWindow = records.filter((r) => r.lead.createdAt >= dateFrom && r.lead.createdAt <= dateTo);
  const knownCount = inWindow.filter((r) => r.confidence === "KNOWN").length;
  const partialCount = inWindow.filter((r) => r.confidence === "PARTIAL").length;

  return { totalLeads, knownCount, partialCount, unknownCount: Math.max(0, totalLeads - knownCount - partialCount), knownPct: totalLeads > 0 ? (knownCount / totalLeads) * 100 : null };
}

export interface RevenueAttribution {
  platformReportedPurchaseValue: number | null;
  verifiedRevenue: number | null;
  verifiedAttributedRoas: number | null; // spec section 49
  platformReportedRoas: number | null; // spec section 49
  attributedLeadCount: number;
  attributedEnrollmentCount: number;
  attributedVerifiedCustomerCount: number;
  costPerEnrollment: number | null; // spec section 52
  costPerVerifiedCustomer: number | null; // spec section 53
}

export async function getRevenueAttribution(adCampaignId: string, dateFrom: Date, dateTo: Date): Promise<RevenueAttribution> {
  const snapshots = await db.adPerformanceSnapshot.findMany({ where: { campaignId: adCampaignId, dateFrom: { gte: dateFrom }, dateTo: { lte: dateTo } } });
  const aggregate = aggregateSnapshots(snapshots);
  const derived = deriveMetrics(aggregate);

  const records = await db.adAttributionRecord.findMany({ where: { adCampaignId, touchType: "FIRST_TOUCH", confidence: "KNOWN" } });
  const leadIds = records.map((r) => r.leadId);

  const conversions = await db.leadStudentConversion.findMany({ where: { leadId: { in: leadIds } } });
  const studentIds = conversions.map((c) => c.studentId);

  const payments = leadIds.length === 0 && studentIds.length === 0 ? [] : await db.paymentTransaction.findMany({ where: { status: "VERIFIED", OR: [{ leadId: { in: leadIds } }, { studentId: { in: studentIds } }] } });
  const verifiedRevenue = payments.length > 0 ? payments.reduce((sum, p) => sum + Number(p.amount), 0) : null;

  const enrollments = studentIds.length === 0 ? [] : await db.enrollment.findMany({ where: { studentId: { in: studentIds } } });
  const verifiedCustomerIds = new Set(payments.map((p) => p.studentId).filter((id): id is string => !!id));

  const verifiedAttributedRoas = verifiedRevenue !== null && aggregate.spend !== null && aggregate.spend > 0 ? verifiedRevenue / aggregate.spend : null;
  const costPerEnrollment = aggregate.spend !== null && enrollments.length > 0 ? aggregate.spend / enrollments.length : null;
  const costPerVerifiedCustomer = aggregate.spend !== null && verifiedCustomerIds.size > 0 ? aggregate.spend / verifiedCustomerIds.size : null;

  return {
    platformReportedPurchaseValue: aggregate.purchaseValue,
    verifiedRevenue,
    verifiedAttributedRoas,
    platformReportedRoas: derived.platformReportedRoas,
    attributedLeadCount: leadIds.length,
    attributedEnrollmentCount: enrollments.length,
    attributedVerifiedCustomerCount: verifiedCustomerIds.size,
    costPerEnrollment,
    costPerVerifiedCustomer,
  };
}

export interface MarketingFunnelStage {
  stage: string;
  value: number | null; // null = UNKNOWN (spec section 54)
}

export async function getMarketingFunnelView(adCampaignId: string, dateFrom: Date, dateTo: Date): Promise<MarketingFunnelStage[]> {
  const campaign = await db.adCampaign.findUniqueOrThrow({ where: { id: adCampaignId } });
  const snapshots = await db.adPerformanceSnapshot.findMany({ where: { campaignId: adCampaignId, dateFrom: { gte: dateFrom }, dateTo: { lte: dateTo } } });
  const aggregate = aggregateSnapshots(snapshots);

  const records = await db.adAttributionRecord.findMany({ where: { adCampaignId, touchType: "FIRST_TOUCH", confidence: "KNOWN" } });
  const leadIds = records.map((r) => r.leadId);
  const leadCount = leadIds.length;

  const registrations = leadIds.length === 0 ? 0 : await db.webinarRegistration.count({ where: { leadId: { in: leadIds } } });
  const reservations = leadIds.length === 0 ? 0 : await db.paymentTransaction.count({ where: { leadId: { in: leadIds }, status: { in: ["PENDING_VERIFICATION", "VERIFIED"] } } });
  const conversions = leadIds.length === 0 ? [] : await db.leadStudentConversion.findMany({ where: { leadId: { in: leadIds } } });
  const enrollments = conversions.length === 0 ? 0 : await db.enrollment.count({ where: { studentId: { in: conversions.map((c) => c.studentId) } } });
  const verifiedPayments = conversions.length === 0 && leadIds.length === 0 ? 0 : await db.paymentTransaction.count({ where: { status: "VERIFIED", OR: [{ leadId: { in: leadIds } }, { studentId: { in: conversions.map((c) => c.studentId) } }] } });

  // Landing page views are UNKNOWN unless this campaign is actually
  // connected to a real Funnel/WebsiteProject (spec section 41) — never a
  // fabricated zero.
  let landingPageViews: number | null = null;
  if (campaign.funnelId) {
    const funnel = await db.funnel.findUnique({ where: { id: campaign.funnelId } });
    if (funnel) {
      const pageIds = (funnel.stagesJson as { pageId?: string }[]).map((s) => s.pageId).filter((id): id is string => !!id);
      if (pageIds.length > 0) {
        landingPageViews = await db.websiteAnalyticsEvent.count({ where: { pageId: { in: pageIds }, eventName: "PAGE_VIEW", occurredAt: { gte: dateFrom, lte: dateTo } } });
      }
    }
  }

  return [
    { stage: "SPEND", value: aggregate.spend },
    { stage: "IMPRESSIONS", value: aggregate.impressions },
    { stage: "CLICKS_OR_MESSAGES", value: aggregate.clicks !== null || aggregate.messages !== null ? (aggregate.clicks ?? 0) + (aggregate.messages ?? 0) : null },
    { stage: "LANDING_PAGE_VIEWS", value: landingPageViews },
    { stage: "LEADS", value: leadCount },
    { stage: "WEBINAR_OR_INQUIRY", value: registrations },
    { stage: "RESERVATION", value: reservations },
    { stage: "ENROLLMENT", value: enrollments },
    { stage: "VERIFIED_REVENUE_PAYMENTS", value: verifiedPayments },
  ];
}
