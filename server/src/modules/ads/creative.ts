// Creative Performance + Fatigue Signals (spec sections 32-37) — connects
// real Ads to the real Phase 11 Creative Studio artifacts they came from,
// when that mapping exists. Never invents a mapping: every soft-referenced
// id is verified to exist and belong to the same student/business before
// AdCreativeLink is written. Roll-ups only ever aggregate real ad-level
// AdPerformanceSnapshot rows — sample size (adCount) is always shown
// alongside a group's numbers so nothing is generalized beyond the
// available evidence (spec section 34).
//
// Fatigue signals are deterministic, code-configurable rules over real
// data — never an AI guess — and are always phrased as a possibility, never
// a proven diagnosis (spec section 35): "POSSIBLE CREATIVE FATIGUE — REVIEW
// RECOMMENDED", never "CREATIVE IS FATIGUED".

import type { Prisma } from "@prisma/client";
import { db } from "../../db.js";
import { writeAuditLog } from "../../audit/log.js";
import { generateAdRecommendationDisplayId } from "../sequence.js";
import { aggregateSnapshots, deriveMetrics, type AggregatedMetrics, type DerivedMetrics } from "./metrics.js";

export interface LinkCreativeOutcome {
  ok: boolean;
  httpStatus?: number;
  reason?: string;
  linkId?: string;
}

export async function linkAdCreative(input: {
  studentId: string;
  businessId: string;
  adId: string;
  creativePackageId?: string;
  hookId?: string;
  creativeAngleId?: string;
  scriptId?: string;
  assetDocumentId?: string;
  format?: string;
  ctaType?: string;
}): Promise<LinkCreativeOutcome> {
  const ad = await db.ad.findUnique({ where: { id: input.adId }, include: { adSet: { include: { campaign: true } } } });
  if (!ad || ad.adSet.campaign.studentId !== input.studentId || ad.adSet.campaign.businessId !== input.businessId) {
    return { ok: false, httpStatus: 403, reason: "This ad does not belong to the requesting student/business." };
  }

  // Never invent a mapping (spec section 32-33) — every soft-referenced id
  // is verified against the real Creative Studio table before it's linked.
  if (input.creativePackageId) {
    const row = await db.creativePackage.findUnique({ where: { id: input.creativePackageId } });
    if (!row || row.studentId !== input.studentId || row.businessId !== input.businessId) return { ok: false, httpStatus: 422, reason: "Creative package not found for this business." };
  }
  if (input.hookId) {
    const row = await db.hook.findUnique({ where: { id: input.hookId } });
    if (!row || row.studentId !== input.studentId || row.businessId !== input.businessId) return { ok: false, httpStatus: 422, reason: "Hook not found for this business." };
  }
  if (input.creativeAngleId) {
    const row = await db.creativeAngle.findUnique({ where: { id: input.creativeAngleId } });
    if (!row || row.studentId !== input.studentId || row.businessId !== input.businessId) return { ok: false, httpStatus: 422, reason: "Creative angle not found for this business." };
  }
  if (input.scriptId) {
    const row = await db.script.findUnique({ where: { id: input.scriptId } });
    if (!row || row.studentId !== input.studentId || row.businessId !== input.businessId) return { ok: false, httpStatus: 422, reason: "Script not found for this business." };
  }
  if (input.assetDocumentId) {
    const row = await db.document.findUnique({ where: { id: input.assetDocumentId } });
    if (!row || row.ownerBusinessId !== input.businessId) return { ok: false, httpStatus: 422, reason: "Asset document not found for this business." };
  }

  const link = await db.adCreativeLink.upsert({
    where: { adId: input.adId },
    update: { creativePackageId: input.creativePackageId ?? null, hookId: input.hookId ?? null, creativeAngleId: input.creativeAngleId ?? null, scriptId: input.scriptId ?? null, assetDocumentId: input.assetDocumentId ?? null, format: input.format ?? null, ctaType: input.ctaType ?? null },
    create: { adId: input.adId, creativePackageId: input.creativePackageId ?? null, hookId: input.hookId ?? null, creativeAngleId: input.creativeAngleId ?? null, scriptId: input.scriptId ?? null, assetDocumentId: input.assetDocumentId ?? null, format: input.format ?? null, ctaType: input.ctaType ?? null },
  });
  return { ok: true, linkId: link.id };
}

export type CreativeGroupBy = "hook" | "angle" | "format" | "ctaType";

interface CreativeRollupRow {
  groupKey: string;
  groupLabel: string;
  adCount: number;
  aggregate: AggregatedMetrics;
  derived: DerivedMetrics;
}

export async function getCreativePerformanceRollup(input: { adAccountId: string; groupBy: CreativeGroupBy; dateFrom: Date; dateTo: Date }): Promise<CreativeRollupRow[]> {
  const ads = await db.ad.findMany({
    where: { adSet: { campaign: { adAccountId: input.adAccountId } } },
    include: { creativeLink: true },
  });
  const linkedAds = ads.filter((a) => a.creativeLink);
  if (linkedAds.length === 0) return [];

  const snapshots = await db.adPerformanceSnapshot.findMany({
    where: { adId: { in: linkedAds.map((a) => a.id) }, dateFrom: { gte: input.dateFrom }, dateTo: { lte: input.dateTo } },
  });
  const snapshotsByAdId = new Map<string, typeof snapshots>();
  for (const s of snapshots) {
    if (!s.adId) continue;
    const list = snapshotsByAdId.get(s.adId) ?? [];
    list.push(s);
    snapshotsByAdId.set(s.adId, list);
  }

  const groups = new Map<string, { ads: Set<string>; snapshots: typeof snapshots }>();
  const keyFor = (ad: (typeof linkedAds)[number]): string | null => {
    const link = ad.creativeLink!;
    if (input.groupBy === "hook") return link.hookId;
    if (input.groupBy === "angle") return link.creativeAngleId;
    if (input.groupBy === "format") return link.format;
    return link.ctaType;
  };
  for (const ad of linkedAds) {
    const key = keyFor(ad);
    if (!key) continue;
    const bucket = groups.get(key) ?? { ads: new Set<string>(), snapshots: [] };
    bucket.ads.add(ad.id);
    bucket.snapshots.push(...(snapshotsByAdId.get(ad.id) ?? []));
    groups.set(key, bucket);
  }

  // Resolve human labels only for the dimensions that reference a real row.
  const labelById = new Map<string, string>();
  if (input.groupBy === "hook") {
    const rows = await db.hook.findMany({ where: { id: { in: [...groups.keys()] } } });
    for (const r of rows) labelById.set(r.id, r.text.slice(0, 80));
  } else if (input.groupBy === "angle") {
    const rows = await db.creativeAngle.findMany({ where: { id: { in: [...groups.keys()] } } });
    for (const r of rows) labelById.set(r.id, r.angleName);
  }

  const result: CreativeRollupRow[] = [];
  for (const [key, bucket] of groups) {
    const aggregate = aggregateSnapshots(bucket.snapshots);
    result.push({
      groupKey: key,
      groupLabel: labelById.get(key) ?? key,
      adCount: bucket.ads.size,
      aggregate,
      derived: deriveMetrics(aggregate),
    });
  }
  return result;
}

// --- Creative Fatigue Signals (spec sections 35, 63) -----------------------

export const FATIGUE_SIGNAL_DEFAULTS = {
  minFrequency: 3.0,
  ctrDeclinePct: 20, // current CTR at least this % lower than the prior period
  minDaysRunning: 3,
};

export interface FatigueCheckResult {
  adId: string;
  flagged: boolean;
  reason?: string;
  currentFrequency: number | null;
  currentCtr: number | null;
  priorCtr: number | null;
  daysRunning: number;
}

export async function checkCreativeFatigue(input: { adAccountId: string; actorUserId: string; thresholds?: Partial<typeof FATIGUE_SIGNAL_DEFAULTS> }): Promise<FatigueCheckResult[]> {
  const thresholds = { ...FATIGUE_SIGNAL_DEFAULTS, ...input.thresholds };
  const ads = await db.ad.findMany({ where: { adSet: { campaign: { adAccountId: input.adAccountId } } }, include: { adSet: { include: { campaign: true } } } });
  const results: FatigueCheckResult[] = [];

  const now = new Date();
  const currentFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const priorTo = new Date(currentFrom.getTime() - 24 * 60 * 60 * 1000);
  const priorFrom = new Date(priorTo.getTime() - 7 * 24 * 60 * 60 * 1000);

  for (const ad of ads) {
    const [currentSnapshots, priorSnapshots, firstSnapshot] = await Promise.all([
      db.adPerformanceSnapshot.findMany({ where: { adId: ad.id, dateFrom: { gte: currentFrom } } }),
      db.adPerformanceSnapshot.findMany({ where: { adId: ad.id, dateFrom: { gte: priorFrom }, dateTo: { lte: priorTo } } }),
      db.adPerformanceSnapshot.findFirst({ where: { adId: ad.id }, orderBy: { dateFrom: "asc" } }),
    ]);
    if (currentSnapshots.length === 0) {
      results.push({ adId: ad.id, flagged: false, currentFrequency: null, currentCtr: null, priorCtr: null, daysRunning: 0 });
      continue;
    }

    const currentAgg = aggregateSnapshots(currentSnapshots);
    const currentDerived = deriveMetrics(currentAgg);
    const priorAgg = aggregateSnapshots(priorSnapshots);
    const priorDerived = deriveMetrics(priorAgg);
    const daysRunning = firstSnapshot ? Math.floor((now.getTime() - firstSnapshot.dateFrom.getTime()) / (24 * 60 * 60 * 1000)) : 0;

    let flagged = false;
    let reason: string | undefined;
    const freq = currentAgg.impressions !== null && currentAgg.reach !== null && currentAgg.reach > 0 ? currentAgg.impressions / currentAgg.reach : null;

    if (freq !== null && freq >= thresholds.minFrequency && currentDerived.ctr !== null && priorDerived.ctr !== null && priorDerived.ctr > 0 && daysRunning >= thresholds.minDaysRunning) {
      const declinePct = ((priorDerived.ctr - currentDerived.ctr) / priorDerived.ctr) * 100;
      if (declinePct >= thresholds.ctrDeclinePct) {
        flagged = true;
        reason = `Frequency ${freq.toFixed(2)} (>= ${thresholds.minFrequency}), CTR declined ${declinePct.toFixed(1)}% vs the prior 7 days (${(priorDerived.ctr * 100).toFixed(2)}% -> ${(currentDerived.ctr * 100).toFixed(2)}%), running ${daysRunning} days.`;
      }
    }

    if (flagged) {
      const campaign = ad.adSet.campaign;
      await db.adRecommendation.create({
        data: {
          recommendationDisplayId: await generateAdRecommendationDisplayId(),
          studentId: campaign.studentId,
          businessId: campaign.businessId,
          adCampaignId: campaign.id,
          adId: ad.id,
          category: "CREATIVE_FATIGUE",
          title: "POSSIBLE CREATIVE FATIGUE — REVIEW RECOMMENDED",
          bodyJson: {
            observedFacts: [reason ?? ""],
            potentialStrengths: [],
            potentialWeaknesses: ["CTR trending down while frequency is elevated."],
            possibleExplanations: ["Creative fatigue is one possible explanation — not confirmed."],
            recommendedTests: ["Test a new hook or visual variant for this ad."],
            risks: ["Other factors (audience saturation, seasonality, tracking changes) could also explain this pattern."],
          } as unknown as Prisma.InputJsonValue,
          status: "OPEN",
        },
      });
    }

    results.push({ adId: ad.id, flagged, reason, currentFrequency: freq, currentCtr: currentDerived.ctr, priorCtr: priorDerived.ctr, daysRunning });
  }

  if (results.some((r) => r.flagged)) {
    await writeAuditLog({ action: "Ad Recommendation Actioned", summary: `Creative fatigue check flagged ${results.filter((r) => r.flagged).length} ad(s)`, actorUserId: input.actorUserId, entityType: "AdAccount", entityId: input.adAccountId });
  }

  return results;
}

// --- Testing Lab comparison (spec sections 39-40) --------------------------

export interface VariantComparisonRow {
  variantId: string;
  label: string;
  adId: string | null;
  aggregate: AggregatedMetrics | null;
  derived: DerivedMetrics | null;
}

export async function compareTestVariants(testPlanId: string, dateFrom: Date, dateTo: Date): Promise<VariantComparisonRow[]> {
  const variants = await db.adTestVariant.findMany({ where: { testPlanId } });
  const rows: VariantComparisonRow[] = [];
  for (const variant of variants) {
    if (!variant.adId) {
      rows.push({ variantId: variant.id, label: variant.label, adId: null, aggregate: null, derived: null });
      continue;
    }
    const snapshots = await db.adPerformanceSnapshot.findMany({ where: { adId: variant.adId, dateFrom: { gte: dateFrom }, dateTo: { lte: dateTo } } });
    const aggregate = aggregateSnapshots(snapshots);
    rows.push({ variantId: variant.id, label: variant.label, adId: variant.adId, aggregate, derived: deriveMetrics(aggregate) });
  }
  return rows;
}
