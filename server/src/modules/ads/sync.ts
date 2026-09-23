// Idempotent Ads sync engine (spec sections 15-17). Repeated syncs never
// duplicate a Campaign/AdSet/Ad (matched on the real provider's own
// external id within its real parent scope) or a performance snapshot
// (matched on scope + date range + source, at the application layer — see
// schema.prisma's AdPerformanceSnapshot comment for why this isn't a DB
// unique constraint).
//
// This has never actually synced against a live Meta connection in this
// build (see provider.ts/meta-client.ts) — every real code path below is
// reachable only once a real "CONNECTED" Meta AdConnection exists, which
// requires real credentials this sandbox does not have. The early-return
// FAILED paths (not connected / MANUAL provider / no external account id)
// are the ones this build's tests actually exercise.

import type { Prisma } from "@prisma/client";
import { db } from "../../db.js";
import { writeAuditLog } from "../../audit/log.js";
import { hasCapability, type AdsProvider } from "./provider.js";
import { fetchMetaCampaigns, fetchMetaAdSets, fetchMetaAds, fetchMetaInsights, type MetaInsightRow } from "./meta-client.js";
import { generateAdCampaignDisplayId, generateAdSetDisplayId, generateAdDisplayId } from "../sequence.js";

export interface SyncSummary {
  status: "SYNCED" | "PARTIAL" | "FAILED";
  campaignsSynced: number;
  adSetsSynced: number;
  adsSynced: number;
  snapshotsSynced: number;
  errors: string[];
}

function toDecimalCents(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n / 100 : undefined;
}

function extractActionValue(actions: { action_type: string; value: string }[] | undefined, types: string[]): number | undefined {
  if (!actions) return undefined;
  const row = actions.find((a) => types.includes(a.action_type));
  if (!row) return undefined;
  const n = Number(row.value);
  return Number.isFinite(n) ? n : undefined;
}

/** Idempotent upsert keyed on (scope, dateFrom, dateTo, source) — see schema comment. */
async function upsertSnapshot(input: {
  adAccountId: string;
  campaignId?: string | null;
  adSetId?: string | null;
  adId?: string | null;
  provider: string;
  dateFrom: Date;
  dateTo: Date;
  currency?: string | null;
  source: string;
  row: MetaInsightRow;
}): Promise<boolean> {
  const existing = await db.adPerformanceSnapshot.findFirst({
    where: {
      adAccountId: input.adAccountId,
      campaignId: input.campaignId ?? null,
      adSetId: input.adSetId ?? null,
      adId: input.adId ?? null,
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
      source: input.source,
    },
  });

  const data = {
    spend: input.row.spend ? Number(input.row.spend) : undefined,
    impressions: input.row.impressions ? Number(input.row.impressions) : undefined,
    reach: input.row.reach ? Number(input.row.reach) : undefined,
    frequency: input.row.frequency ? Number(input.row.frequency) : undefined,
    cpm: input.row.cpm ? Number(input.row.cpm) : undefined,
    clicks: input.row.clicks ? Number(input.row.clicks) : undefined,
    linkClicks: input.row.inline_link_clicks ? Number(input.row.inline_link_clicks) : undefined,
    ctr: input.row.ctr ? Number(input.row.ctr) : undefined,
    cpc: input.row.cpc ? Number(input.row.cpc) : undefined,
    messages: extractActionValue(input.row.actions, ["onsite_conversion.messaging_conversation_started_7d"]),
    leads: extractActionValue(input.row.actions, ["lead", "onsite_conversion.lead_grouped"]),
    purchases: extractActionValue(input.row.actions, ["purchase", "offsite_conversion.fb_pixel_purchase"]),
    purchaseValue: extractActionValue(input.row.action_values as { action_type: string; value: string }[] | undefined, ["purchase", "offsite_conversion.fb_pixel_purchase"]),
    rawMetricsJson: input.row as unknown as Prisma.InputJsonValue,
    currency: input.currency ?? undefined,
    retrievedAt: new Date(),
  };

  if (existing) {
    await db.adPerformanceSnapshot.update({ where: { id: existing.id }, data });
    return false;
  }
  await db.adPerformanceSnapshot.create({
    data: {
      adAccountId: input.adAccountId,
      campaignId: input.campaignId ?? null,
      adSetId: input.adSetId ?? null,
      adId: input.adId ?? null,
      provider: input.provider,
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
      source: input.source,
      ...data,
    },
  });
  return true;
}

export async function syncAdAccount(adAccountId: string, actorUserId: string, dateFrom: Date, dateTo: Date): Promise<SyncSummary> {
  const account = await db.adAccount.findUnique({ where: { id: adAccountId }, include: { connection: true } });
  if (!account) return { status: "FAILED", campaignsSynced: 0, adSetsSynced: 0, adsSynced: 0, snapshotsSynced: 0, errors: ["Ad account not found."] };

  const provider = account.connection.provider as AdsProvider;
  const fail = async (reason: string): Promise<SyncSummary> => {
    await db.adAccount.update({ where: { id: adAccountId }, data: { syncStatus: "FAILED", lastSyncError: reason, lastSyncedAt: new Date() } });
    return { status: "FAILED", campaignsSynced: 0, adSetsSynced: 0, adsSynced: 0, snapshotsSynced: 0, errors: [reason] };
  };

  if (provider !== "META") {
    return fail("Sync is only meaningful for a provider-connected account. MANUAL accounts use CSV import or direct entry instead of sync.");
  }
  if (account.connection.status !== "CONNECTED" || !hasCapability(provider, "READ_CAMPAIGNS")) {
    return fail(`This connection is not CONNECTED (current status: ${account.connection.status}) — cannot sync.`);
  }
  if (!account.externalAccountId) {
    return fail("No external ad account id configured on this account.");
  }

  await db.adAccount.update({ where: { id: adAccountId }, data: { syncStatus: "SYNCING" } });

  const errors: string[] = [];
  let campaignsSynced = 0;
  let adSetsSynced = 0;
  let adsSynced = 0;
  let snapshotsSynced = 0;
  const isoFrom = dateFrom.toISOString().slice(0, 10);
  const isoTo = dateTo.toISOString().slice(0, 10);

  try {
    const metaCampaigns = await fetchMetaCampaigns(account.externalAccountId);
    for (const mc of metaCampaigns) {
      try {
        const existingCampaign = await db.adCampaign.findFirst({ where: { adAccountId, externalCampaignId: mc.id } });
        const campaign = existingCampaign
          ? await db.adCampaign.update({
              where: { id: existingCampaign.id },
              data: { name: mc.name, objective: mc.objective ?? null, status: mc.status ?? existingCampaign.status, dailyBudget: toDecimalCents(mc.daily_budget), lifetimeBudget: toDecimalCents(mc.lifetime_budget) },
            })
          : await db.adCampaign.create({
              data: {
                campaignDisplayId: await generateAdCampaignDisplayId(),
                adAccountId,
                studentId: account.studentId,
                businessId: account.businessId,
                externalCampaignId: mc.id,
                name: mc.name,
                objective: mc.objective ?? null,
                status: mc.status ?? "DRAFT",
                dailyBudget: toDecimalCents(mc.daily_budget),
                lifetimeBudget: toDecimalCents(mc.lifetime_budget),
                currency: account.currency,
                source: "SYNCED",
                createdById: actorUserId,
              },
            });
        campaignsSynced++;

        try {
          const insights = await fetchMetaInsights(mc.id, isoFrom, isoTo);
          for (const row of insights) {
            const created = await upsertSnapshot({ adAccountId, campaignId: campaign.id, provider: "META", dateFrom, dateTo, currency: account.currency, source: "SYNCED", row });
            if (created) snapshotsSynced++;
          }
        } catch (err) {
          errors.push(`Campaign ${mc.id} insights: ${err instanceof Error ? err.message : "unknown error"}`);
        }

        const metaAdSets = await fetchMetaAdSets(mc.id);
        for (const mas of metaAdSets) {
          const existingAdSet = await db.adSet.findFirst({ where: { campaignId: campaign.id, externalAdSetId: mas.id } });
          const adSet = existingAdSet
            ? await db.adSet.update({ where: { id: existingAdSet.id }, data: { name: mas.name, status: mas.status ?? existingAdSet.status, dailyBudget: toDecimalCents(mas.daily_budget), audienceJson: (mas.targeting as Prisma.InputJsonValue) ?? undefined, placement: mas.publisher_platforms?.join(", ") ?? undefined } })
            : await db.adSet.create({
                data: {
                  adSetDisplayId: await generateAdSetDisplayId(),
                  campaignId: campaign.id,
                  externalAdSetId: mas.id,
                  name: mas.name,
                  status: mas.status ?? "DRAFT",
                  dailyBudget: toDecimalCents(mas.daily_budget),
                  audienceJson: (mas.targeting as Prisma.InputJsonValue) ?? undefined,
                  placement: mas.publisher_platforms?.join(", ") ?? undefined,
                },
              });
          adSetsSynced++;

          const metaAds = await fetchMetaAds(mas.id);
          for (const ma of metaAds) {
            const existingAd = await db.ad.findFirst({ where: { adSetId: adSet.id, externalAdId: ma.id } });
            if (existingAd) {
              await db.ad.update({ where: { id: existingAd.id }, data: { name: ma.name, status: ma.status ?? existingAd.status } });
            } else {
              await db.ad.create({ data: { adDisplayId: await generateAdDisplayId(), adSetId: adSet.id, externalAdId: ma.id, name: ma.name, status: ma.status ?? "DRAFT" } });
            }
            adsSynced++;
          }
        }
      } catch (err) {
        errors.push(`Campaign ${mc.id}: ${err instanceof Error ? err.message : "unknown error"}`);
      }
    }
  } catch (err) {
    errors.push(err instanceof Error ? err.message : "Unknown sync error.");
  }

  const status: SyncSummary["status"] = errors.length === 0 ? "SYNCED" : campaignsSynced > 0 ? "PARTIAL" : "FAILED";
  await db.adAccount.update({ where: { id: adAccountId }, data: { syncStatus: status, lastSyncedAt: new Date(), lastSyncError: errors[0] ?? null } });
  await db.adConnection.update({ where: { id: account.connectionId }, data: { lastSyncedAt: new Date() } });
  await writeAuditLog({
    action: "Ad Account Sync",
    summary: `Sync ${status} for ad account "${account.name}" — ${campaignsSynced} campaigns, ${adSetsSynced} ad sets, ${adsSynced} ads, ${snapshotsSynced} snapshots.`,
    actorUserId,
    entityType: "AdAccount",
    entityId: adAccountId,
  });

  return { status, campaignsSynced, adSetsSynced, adsSynced, snapshotsSynced, errors };
}
