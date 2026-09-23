// M.A.I.A. Ads Command Center routes (Phase 14). Every route enforces the
// same real server-side ownership/permission rules as every other module —
// a Student session only ever reaches their own AdConnections/AdAccounts/
// AdCampaigns; a tampered id resolves to 403/404, never a cross-business
// leak (spec sections 2, 7, 105).

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../../db.js";
import { requireAuth, requirePermission, requireStudentSelfOrPermission, assertBusinessOwnedByStudent } from "../../rbac/middleware.js";
import { writeAuditLog } from "../../audit/log.js";
import type { Prisma } from "@prisma/client";
import { generateAdConnectionDisplayId, generateAdAccountDisplayId, generateAdCampaignDisplayId, generateAdSetDisplayId, generateAdDisplayId } from "../sequence.js";
import { ADS_PROVIDERS, CONNECTION_MODES, isAdsProvider, testProviderConnection, getCapabilities, type AdsProvider } from "./provider.js";
import { syncAdAccount } from "./sync.js";
import { validateCsvRows, commitCsvImport, rollbackImportBatch, type CsvRow } from "./import.js";
import { DATE_RANGE_PRESETS, resolveDateRange } from "./date-range.js";
import { aggregateSnapshots, deriveMetrics } from "./metrics.js";
import { analyzeAdCampaign } from "./analyzer.js";
import { linkAdCreative, getCreativePerformanceRollup, checkCreativeFatigue, compareTestVariants, type CreativeGroupBy } from "./creative.js";
import { generateAdTestPlanDisplayId } from "../sequence.js";
import { recomputeAttributionForCampaign, getAttributionCoverage, getRevenueAttribution, getMarketingFunnelView } from "./attribution.js";
import { getBudgetCenterOverview, checkBudgetAlerts } from "./budget.js";
import { requestOptimizationAction, decideOptimizationAction, runFullFunnelDiagnostic } from "./optimization.js";
import { generateCampaignPlan } from "./planner.js";
import { buildUtmCampaignSlug, buildUtmUrl, validateCampaignTracking, getPreLaunchChecklist } from "./utm.js";
import { askMaiaAds } from "./ask.js";
import { buildAdsBrief } from "./brief.js";

async function assertBusinessAccessible(request: { authContext?: { kind: string; studentId?: string } }, businessId: string): Promise<boolean> {
  const ctx = request.authContext;
  if (!ctx) return false;
  if (ctx.kind === "staff") return true;
  if (ctx.kind === "student" && ctx.studentId) return assertBusinessOwnedByStudent(businessId, ctx.studentId);
  return false;
}

function ownedByRequester(request: { authContext?: { kind: string; studentId?: string } }, row: { studentId: string }): boolean {
  const ctx = request.authContext;
  if (!ctx) return false;
  if (ctx.kind === "staff") return true;
  return ctx.kind === "student" && ctx.studentId === row.studentId;
}

export async function adsCommandCenterRoutes(app: FastifyInstance) {
  // --- Connections (spec sections 3-8) ------------------------------------

  const connectionCreateSchema = z.object({ businessId: z.string().min(1), provider: z.enum(ADS_PROVIDERS), mode: z.enum(CONNECTION_MODES).default("READ_ONLY") });

  app.post("/api/students/:studentId/ad-connections", { preHandler: [requireAuth, requireStudentSelfOrPermission("Ads Command Center", "CREATE")] }, async (request, reply) => {
    const { studentId } = request.params as { studentId: string };
    const parsed = connectionCreateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid connection.", details: parsed.error.flatten() });
    if (!(await assertBusinessOwnedByStudent(parsed.data.businessId, studentId))) return reply.code(403).send({ error: "Forbidden: this business does not belong to you." });

    // Live Action mode requires the same explicit-approval scaffolding as
    // any budget/pause mutation would (spec sections 9-12) — this build has
    // no write-capable provider connection at all, so a Student may never
    // request LIVE_ACTION directly; only staff holding VERIFY may enable it
    // later via PATCH, and even then no real mutation call exists yet.
    if (parsed.data.mode === "LIVE_ACTION" && request.authContext!.kind !== "staff") {
      return reply.code(403).send({ error: "Only staff may configure a Live Action connection, and no write-capable provider is available in this build regardless." });
    }

    const connection = await db.adConnection.create({
      data: {
        connectionDisplayId: await generateAdConnectionDisplayId(),
        studentId,
        businessId: parsed.data.businessId,
        provider: parsed.data.provider,
        mode: parsed.data.mode,
        status: "NOT_CONNECTED",
        createdById: request.authContext!.userId,
      },
    });
    await writeAuditLog({ action: "Ad Connection Added", summary: `Ad connection (${connection.provider}) added`, actorUserId: request.authContext!.userId, entityType: "AdConnection", entityId: connection.id });
    return reply.code(201).send({ connection, capabilities: getCapabilities(connection.provider as AdsProvider) });
  });

  app.get("/api/businesses/:businessId/ad-connections", { preHandler: [requireAuth] }, async (request, reply) => {
    const { businessId } = request.params as { businessId: string };
    if (!(await assertBusinessAccessible(request, businessId))) return reply.code(403).send({ error: "Forbidden: this business does not belong to you." });
    const connections = await db.adConnection.findMany({ where: { businessId }, orderBy: { createdAt: "desc" } });
    return reply.send({ connections: connections.map((c) => ({ ...c, capabilities: isAdsProvider(c.provider) ? getCapabilities(c.provider) : {} })) });
  });

  app.get("/api/ad-connections/:id", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const connection = await db.adConnection.findUnique({ where: { id }, include: { adAccounts: true } });
    if (!connection) return reply.code(404).send({ error: "Connection not found." });
    if (!ownedByRequester(request, connection)) return reply.code(403).send({ error: "Forbidden." });
    return reply.send({ connection, capabilities: isAdsProvider(connection.provider) ? getCapabilities(connection.provider) : {} });
  });

  // Real connection test — never fabricates CONNECTED (spec section 5).
  app.post("/api/ad-connections/:id/test", { preHandler: [requireAuth], config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const connection = await db.adConnection.findUnique({ where: { id } });
    if (!connection) return reply.code(404).send({ error: "Connection not found." });
    if (!ownedByRequester(request, connection)) return reply.code(403).send({ error: "Forbidden." });
    if (!isAdsProvider(connection.provider)) return reply.code(500).send({ error: "Unknown provider on this connection." });

    const result = await testProviderConnection(connection.provider);
    const updated = await db.adConnection.update({
      where: { id },
      data: {
        status: result.status,
        lastError: result.ok ? null : (result.reason ?? null),
        lastSyncedAt: result.ok ? new Date() : connection.lastSyncedAt,
        credentialsConfigured: connection.provider === "META" ? result.status !== "CONFIGURATION_REQUIRED" : connection.credentialsConfigured,
      },
    });
    if (updated.status !== connection.status) {
      await writeAuditLog({ action: "Ad Connection Status Changed", summary: `Ad connection status ${connection.status} -> ${updated.status}`, actorUserId: request.authContext!.userId, entityType: "AdConnection", entityId: id });
    }
    return reply.send({ connection: updated, testResult: result });
  });

  app.post("/api/ad-connections/:id/disable", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const connection = await db.adConnection.findUnique({ where: { id } });
    if (!connection) return reply.code(404).send({ error: "Connection not found." });
    if (!ownedByRequester(request, connection)) return reply.code(403).send({ error: "Forbidden." });
    const updated = await db.adConnection.update({ where: { id }, data: { status: "DISABLED" } });
    await writeAuditLog({ action: "Ad Connection Status Changed", summary: `Ad connection disabled`, actorUserId: request.authContext!.userId, entityType: "AdConnection", entityId: id });
    return reply.send({ connection: updated });
  });

  app.delete("/api/ad-connections/:id", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const connection = await db.adConnection.findUnique({ where: { id } });
    if (!connection) return reply.code(404).send({ error: "Connection not found." });
    if (!ownedByRequester(request, connection)) return reply.code(403).send({ error: "Forbidden." });
    const accountCount = await db.adAccount.count({ where: { connectionId: id } });
    if (accountCount > 0) return reply.code(409).send({ error: "Remove this connection's ad accounts first." });
    await db.adConnection.delete({ where: { id } });
    await writeAuditLog({ action: "Ad Connection Removed", summary: `Ad connection (${connection.provider}) removed`, actorUserId: request.authContext!.userId, entityType: "AdConnection", entityId: id });
    return reply.send({ ok: true });
  });

  // --- Ad Accounts (spec section 8) ---------------------------------------

  const adAccountCreateSchema = z.object({ externalAccountId: z.string().optional(), name: z.string().min(1), currency: z.string().min(1), timezone: z.string().min(1) });

  app.post("/api/ad-connections/:id/ad-accounts", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const connection = await db.adConnection.findUnique({ where: { id } });
    if (!connection) return reply.code(404).send({ error: "Connection not found." });
    if (!ownedByRequester(request, connection)) return reply.code(403).send({ error: "Forbidden." });
    const parsed = adAccountCreateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid ad account.", details: parsed.error.flatten() });

    if (connection.provider === "META" && connection.status !== "CONNECTED") {
      return reply.code(422).send({ error: "This Meta connection is not CONNECTED — a real ad account can only be selected once the connection succeeds a real authentication check." });
    }

    const account = await db.adAccount.create({
      data: {
        adAccountDisplayId: await generateAdAccountDisplayId(),
        connectionId: id,
        studentId: connection.studentId,
        businessId: connection.businessId,
        externalAccountId: parsed.data.externalAccountId ?? null,
        name: parsed.data.name,
        currency: parsed.data.currency,
        timezone: parsed.data.timezone,
      },
    });
    return reply.code(201).send({ adAccount: account });
  });

  app.get("/api/ad-connections/:id/ad-accounts", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const connection = await db.adConnection.findUnique({ where: { id } });
    if (!connection) return reply.code(404).send({ error: "Connection not found." });
    if (!ownedByRequester(request, connection)) return reply.code(403).send({ error: "Forbidden." });
    const accounts = await db.adAccount.findMany({ where: { connectionId: id }, orderBy: { createdAt: "desc" } });
    return reply.send({ adAccounts: accounts });
  });

  app.get("/api/ad-accounts/:id", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const account = await db.adAccount.findUnique({ where: { id } });
    if (!account) return reply.code(404).send({ error: "Ad account not found." });
    if (!ownedByRequester(request, account)) return reply.code(403).send({ error: "Forbidden." });
    return reply.send({ adAccount: account });
  });

  app.patch("/api/ad-accounts/:id", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const account = await db.adAccount.findUnique({ where: { id } });
    if (!account) return reply.code(404).send({ error: "Ad account not found." });
    if (!ownedByRequester(request, account)) return reply.code(403).send({ error: "Forbidden." });
    const parsed = z.object({ isActive: z.boolean().optional(), name: z.string().min(1).optional() }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid update.", details: parsed.error.flatten() });
    const updated = await db.adAccount.update({ where: { id }, data: parsed.data });
    return reply.send({ adAccount: updated });
  });

  // --- Sync (spec sections 15-17) -----------------------------------------

  app.post("/api/ad-accounts/:id/sync", { preHandler: [requireAuth], config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const account = await db.adAccount.findUnique({ where: { id } });
    if (!account) return reply.code(404).send({ error: "Ad account not found." });
    if (!ownedByRequester(request, account)) return reply.code(403).send({ error: "Forbidden." });
    const parsed = z.object({ preset: z.enum(DATE_RANGE_PRESETS).default("LAST_30_DAYS"), from: z.string().optional(), to: z.string().optional() }).safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: "Invalid request.", details: parsed.error.flatten() });

    let range;
    try {
      range = resolveDateRange(parsed.data.preset, { from: parsed.data.from, to: parsed.data.to });
    } catch (err) {
      return reply.code(400).send({ error: err instanceof Error ? err.message : "Invalid date range." });
    }

    const summary = await syncAdAccount(id, request.authContext!.userId, range.from, range.to);
    return reply.send({ summary });
  });

  // --- Campaigns (spec section 13) ----------------------------------------

  const campaignCreateSchema = z.object({
    name: z.string().min(1),
    objective: z.string().optional(),
    dailyBudget: z.number().nonnegative().optional(),
    lifetimeBudget: z.number().nonnegative().optional(),
    currency: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    offerId: z.string().optional(),
    creativePackageId: z.string().optional(),
    funnelId: z.string().optional(),
    journeyId: z.string().optional(),
    marketingCampaignId: z.string().optional(),
    utmCampaign: z.string().optional(),
  });

  app.post("/api/ad-accounts/:id/campaigns", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const account = await db.adAccount.findUnique({ where: { id } });
    if (!account) return reply.code(404).send({ error: "Ad account not found." });
    if (!ownedByRequester(request, account)) return reply.code(403).send({ error: "Forbidden." });
    const parsed = campaignCreateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid campaign.", details: parsed.error.flatten() });

    const campaign = await db.adCampaign.create({
      data: {
        campaignDisplayId: await generateAdCampaignDisplayId(),
        adAccountId: id,
        studentId: account.studentId,
        businessId: account.businessId,
        name: parsed.data.name,
        objective: parsed.data.objective ?? null,
        dailyBudget: parsed.data.dailyBudget ?? null,
        lifetimeBudget: parsed.data.lifetimeBudget ?? null,
        currency: parsed.data.currency ?? account.currency,
        startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : null,
        endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
        source: "MANUAL",
        status: "DRAFT",
        offerId: parsed.data.offerId ?? null,
        creativePackageId: parsed.data.creativePackageId ?? null,
        funnelId: parsed.data.funnelId ?? null,
        journeyId: parsed.data.journeyId ?? null,
        marketingCampaignId: parsed.data.marketingCampaignId ?? null,
        utmCampaign: parsed.data.utmCampaign ?? null,
        createdById: request.authContext!.userId,
      },
    });
    await writeAuditLog({ action: "Ad Campaign Created", summary: `Ad campaign "${campaign.name}" created (MANUAL)`, actorUserId: request.authContext!.userId, entityType: "AdCampaign", entityId: campaign.id });
    return reply.code(201).send({ campaign });
  });

  app.get("/api/ad-accounts/:id/campaigns", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const account = await db.adAccount.findUnique({ where: { id } });
    if (!account) return reply.code(404).send({ error: "Ad account not found." });
    if (!ownedByRequester(request, account)) return reply.code(403).send({ error: "Forbidden." });
    const campaigns = await db.adCampaign.findMany({ where: { adAccountId: id }, orderBy: { createdAt: "desc" } });
    return reply.send({ campaigns });
  });

  app.get("/api/ad-campaigns/:id", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const campaign = await db.adCampaign.findUnique({ where: { id }, include: { adSets: true } });
    if (!campaign) return reply.code(404).send({ error: "Campaign not found." });
    if (!ownedByRequester(request, campaign)) return reply.code(403).send({ error: "Forbidden." });
    return reply.send({ campaign });
  });

  app.patch("/api/ad-campaigns/:id", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const campaign = await db.adCampaign.findUnique({ where: { id } });
    if (!campaign) return reply.code(404).send({ error: "Campaign not found." });
    if (!ownedByRequester(request, campaign)) return reply.code(403).send({ error: "Forbidden." });
    if (campaign.source === "SYNCED") return reply.code(422).send({ error: "A SYNCED campaign's structure is managed by the provider — edit it there, then re-sync." });
    const parsed = campaignCreateSchema.partial().safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid update.", details: parsed.error.flatten() });
    const { startDate, endDate, ...rest } = parsed.data;
    const updated = await db.adCampaign.update({ where: { id }, data: { ...rest, startDate: startDate ? new Date(startDate) : undefined, endDate: endDate ? new Date(endDate) : undefined } });
    return reply.send({ campaign: updated });
  });

  app.post("/api/ad-campaigns/:id/status", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const campaign = await db.adCampaign.findUnique({ where: { id } });
    if (!campaign) return reply.code(404).send({ error: "Campaign not found." });
    if (!ownedByRequester(request, campaign)) return reply.code(403).send({ error: "Forbidden." });
    const parsed = z.object({ status: z.string().min(1) }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid status.", details: parsed.error.flatten() });
    const updated = await db.adCampaign.update({ where: { id }, data: { status: parsed.data.status } });
    return reply.send({ campaign: updated });
  });

  // --- Ad Sets + Ads (spec section 13) ------------------------------------

  app.post("/api/ad-campaigns/:id/ad-sets", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const campaign = await db.adCampaign.findUnique({ where: { id } });
    if (!campaign) return reply.code(404).send({ error: "Campaign not found." });
    if (!ownedByRequester(request, campaign)) return reply.code(403).send({ error: "Forbidden." });
    const parsed = z.object({ name: z.string().min(1), audience: z.record(z.string(), z.unknown()).optional(), placement: z.string().optional(), dailyBudget: z.number().nonnegative().optional() }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid ad set.", details: parsed.error.flatten() });
    const adSet = await db.adSet.create({
      data: { adSetDisplayId: await generateAdSetDisplayId(), campaignId: id, name: parsed.data.name, audienceJson: (parsed.data.audience as Prisma.InputJsonValue) ?? undefined, placement: parsed.data.placement ?? null, dailyBudget: parsed.data.dailyBudget ?? null, status: "DRAFT" },
    });
    return reply.code(201).send({ adSet });
  });

  app.get("/api/ad-campaigns/:id/ad-sets", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const campaign = await db.adCampaign.findUnique({ where: { id } });
    if (!campaign) return reply.code(404).send({ error: "Campaign not found." });
    if (!ownedByRequester(request, campaign)) return reply.code(403).send({ error: "Forbidden." });
    const adSets = await db.adSet.findMany({ where: { campaignId: id }, orderBy: { createdAt: "desc" } });
    return reply.send({ adSets });
  });

  app.post("/api/ad-sets/:id/ads", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const adSet = await db.adSet.findUnique({ where: { id }, include: { campaign: true } });
    if (!adSet) return reply.code(404).send({ error: "Ad set not found." });
    if (!ownedByRequester(request, adSet.campaign)) return reply.code(403).send({ error: "Forbidden." });
    const parsed = z.object({ name: z.string().min(1), landingPageId: z.string().optional(), utmCampaign: z.string().optional(), utmContent: z.string().optional() }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid ad.", details: parsed.error.flatten() });
    const ad = await db.ad.create({
      data: { adDisplayId: await generateAdDisplayId(), adSetId: id, name: parsed.data.name, landingPageId: parsed.data.landingPageId ?? null, utmCampaign: parsed.data.utmCampaign ?? null, utmContent: parsed.data.utmContent ?? null, status: "DRAFT" },
    });
    return reply.code(201).send({ ad });
  });

  app.get("/api/ad-sets/:id/ads", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const adSet = await db.adSet.findUnique({ where: { id }, include: { campaign: true } });
    if (!adSet) return reply.code(404).send({ error: "Ad set not found." });
    if (!ownedByRequester(request, adSet.campaign)) return reply.code(403).send({ error: "Forbidden." });
    const ads = await db.ad.findMany({ where: { adSetId: id }, orderBy: { createdAt: "desc" } });
    return reply.send({ ads });
  });

  app.get("/api/ads/:id", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const ad = await db.ad.findUnique({ where: { id }, include: { adSet: { include: { campaign: true } }, creativeLink: true } });
    if (!ad) return reply.code(404).send({ error: "Ad not found." });
    if (!ownedByRequester(request, ad.adSet.campaign)) return reply.code(403).send({ error: "Forbidden." });
    return reply.send({ ad });
  });

  // --- Manual metric entry (spec section 83) — clearly labeled MANUAL data.

  app.post("/api/ad-accounts/:id/snapshots/manual", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const account = await db.adAccount.findUnique({ where: { id } });
    if (!account) return reply.code(404).send({ error: "Ad account not found." });
    if (!ownedByRequester(request, account)) return reply.code(403).send({ error: "Forbidden." });
    const parsed = z
      .object({
        campaignId: z.string().optional(),
        date: z.string(),
        spend: z.number().nonnegative().optional(),
        impressions: z.number().nonnegative().optional(),
        reach: z.number().nonnegative().optional(),
        clicks: z.number().nonnegative().optional(),
        leads: z.number().nonnegative().optional(),
        messages: z.number().nonnegative().optional(),
        purchases: z.number().nonnegative().optional(),
        purchaseValue: z.number().nonnegative().optional(),
      })
      .safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid entry.", details: parsed.error.flatten() });

    if (parsed.data.campaignId) {
      const campaign = await db.adCampaign.findUnique({ where: { id: parsed.data.campaignId } });
      if (!campaign || campaign.adAccountId !== id) return reply.code(403).send({ error: "This campaign does not belong to this ad account." });
    }

    const dateFrom = new Date(`${parsed.data.date}T00:00:00.000Z`);
    const snapshot = await db.adPerformanceSnapshot.create({
      data: {
        adAccountId: id,
        campaignId: parsed.data.campaignId ?? null,
        provider: "MANUAL",
        dateFrom,
        dateTo: dateFrom,
        currency: account.currency,
        source: "MANUAL",
        spend: parsed.data.spend,
        impressions: parsed.data.impressions,
        reach: parsed.data.reach,
        clicks: parsed.data.clicks,
        leads: parsed.data.leads,
        messages: parsed.data.messages,
        purchases: parsed.data.purchases,
        purchaseValue: parsed.data.purchaseValue,
      },
    });
    return reply.code(201).send({ snapshot });
  });

  // --- CSV import (spec sections 84-87) -----------------------------------

  const csvRowSchema = z.object({ date: z.string(), campaignName: z.string(), spend: z.string().optional(), impressions: z.string().optional(), clicks: z.string().optional(), leads: z.string().optional(), purchases: z.string().optional(), purchaseValue: z.string().optional(), currency: z.string().optional() });

  app.post("/api/ad-accounts/:id/import/preview", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const account = await db.adAccount.findUnique({ where: { id } });
    if (!account) return reply.code(404).send({ error: "Ad account not found." });
    if (!ownedByRequester(request, account)) return reply.code(403).send({ error: "Forbidden." });
    const parsed = z.object({ rows: z.array(csvRowSchema).min(1).max(5000) }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid request.", details: parsed.error.flatten() });
    const preview = validateCsvRows(parsed.data.rows as CsvRow[]);
    return reply.send({ preview });
  });

  app.post("/api/ad-accounts/:id/import/commit", { preHandler: [requireAuth], config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const account = await db.adAccount.findUnique({ where: { id } });
    if (!account) return reply.code(404).send({ error: "Ad account not found." });
    if (!ownedByRequester(request, account)) return reply.code(403).send({ error: "Forbidden." });
    const parsed = z.object({ rows: z.array(csvRowSchema).min(1).max(5000), fileNameOriginal: z.string().optional() }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid request.", details: parsed.error.flatten() });

    const outcome = await commitCsvImport({ adAccountId: id, rows: parsed.data.rows as CsvRow[], fileNameOriginal: parsed.data.fileNameOriginal, actorUserId: request.authContext!.userId });
    if (!outcome.ok) return reply.code(outcome.httpStatus ?? 500).send({ error: outcome.reason, batchId: outcome.batchId });
    return reply.code(201).send(outcome);
  });

  app.get("/api/ad-accounts/:id/import-batches", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const account = await db.adAccount.findUnique({ where: { id } });
    if (!account) return reply.code(404).send({ error: "Ad account not found." });
    if (!ownedByRequester(request, account)) return reply.code(403).send({ error: "Forbidden." });
    const batches = await db.adImportBatch.findMany({ where: { adAccountId: id }, orderBy: { createdAt: "desc" } });
    return reply.send({ batches });
  });

  app.post("/api/ad-import-batches/:id/rollback", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const batch = await db.adImportBatch.findUnique({ where: { id } });
    if (!batch) return reply.code(404).send({ error: "Import batch not found." });
    if (!ownedByRequester(request, batch)) return reply.code(403).send({ error: "Forbidden." });
    const outcome = await rollbackImportBatch(id, request.authContext!.userId);
    if (!outcome.ok) return reply.code(outcome.httpStatus ?? 500).send({ error: outcome.reason });
    return reply.send(outcome);
  });

  // --- Overview (spec sections 24-26) — real numbers only, UNKNOWN when missing.

  app.get("/api/ad-accounts/:id/overview", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const account = await db.adAccount.findUnique({ where: { id } });
    if (!account) return reply.code(404).send({ error: "Ad account not found." });
    if (!ownedByRequester(request, account)) return reply.code(403).send({ error: "Forbidden." });
    const { preset, from, to } = request.query as { preset?: string; from?: string; to?: string };
    let range;
    try {
      range = resolveDateRange((preset as (typeof DATE_RANGE_PRESETS)[number]) ?? "LAST_30_DAYS", { from, to });
    } catch (err) {
      return reply.code(400).send({ error: err instanceof Error ? err.message : "Invalid date range." });
    }

    const snapshots = await db.adPerformanceSnapshot.findMany({ where: { adAccountId: id, dateFrom: { gte: range.from }, dateTo: { lte: range.to } } });
    const aggregate = aggregateSnapshots(snapshots);
    const derived = deriveMetrics(aggregate);
    return reply.send({ dateRange: { from: range.from, to: range.to }, currency: account.currency, aggregate, derived });
  });

  // --- Ads Analyzer + Ad Set / Ad Intelligence (spec sections 27-32) ------

  app.post("/api/ad-campaigns/:id/analyze", { preHandler: [requireAuth], config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const campaign = await db.adCampaign.findUnique({ where: { id } });
    if (!campaign) return reply.code(404).send({ error: "Campaign not found." });
    if (!ownedByRequester(request, campaign)) return reply.code(403).send({ error: "Forbidden." });
    const parsed = z.object({ preset: z.enum(DATE_RANGE_PRESETS).optional(), from: z.string().optional(), to: z.string().optional() }).safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: "Invalid request.", details: parsed.error.flatten() });

    const outcome = await analyzeAdCampaign({ studentId: campaign.studentId, businessId: campaign.businessId, adCampaignId: id, preset: parsed.data.preset, from: parsed.data.from, to: parsed.data.to, actorUserId: request.authContext!.userId });
    if (!outcome.ok) return reply.code(outcome.httpStatus).send({ error: outcome.reason });
    return reply.code(201).send(outcome);
  });

  app.get("/api/ad-sets/:id/performance", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const adSet = await db.adSet.findUnique({ where: { id }, include: { campaign: true } });
    if (!adSet) return reply.code(404).send({ error: "Ad set not found." });
    if (!ownedByRequester(request, adSet.campaign)) return reply.code(403).send({ error: "Forbidden." });
    const { preset, from, to } = request.query as { preset?: string; from?: string; to?: string };
    let range;
    try {
      range = resolveDateRange((preset as (typeof DATE_RANGE_PRESETS)[number]) ?? "LAST_30_DAYS", { from, to });
    } catch (err) {
      return reply.code(400).send({ error: err instanceof Error ? err.message : "Invalid date range." });
    }
    const snapshots = await db.adPerformanceSnapshot.findMany({ where: { adSetId: id, dateFrom: { gte: range.from }, dateTo: { lte: range.to } } });
    const aggregate = aggregateSnapshots(snapshots);
    return reply.send({ dateRange: range, audience: adSet.audienceJson, placement: adSet.placement, aggregate, derived: deriveMetrics(aggregate) });
  });

  app.get("/api/ads/:id/performance", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const ad = await db.ad.findUnique({ where: { id }, include: { adSet: { include: { campaign: true } } } });
    if (!ad) return reply.code(404).send({ error: "Ad not found." });
    if (!ownedByRequester(request, ad.adSet.campaign)) return reply.code(403).send({ error: "Forbidden." });
    const { preset, from, to } = request.query as { preset?: string; from?: string; to?: string };
    let range;
    try {
      range = resolveDateRange((preset as (typeof DATE_RANGE_PRESETS)[number]) ?? "LAST_30_DAYS", { from, to });
    } catch (err) {
      return reply.code(400).send({ error: err instanceof Error ? err.message : "Invalid date range." });
    }
    const snapshots = await db.adPerformanceSnapshot.findMany({ where: { adId: id, dateFrom: { gte: range.from }, dateTo: { lte: range.to } } });
    const aggregate = aggregateSnapshots(snapshots);
    return reply.send({ dateRange: range, aggregate, derived: deriveMetrics(aggregate) });
  });

  // --- Creative Performance (spec sections 32-35) -------------------------

  app.post("/api/ads/:id/creative-link", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const ad = await db.ad.findUnique({ where: { id }, include: { adSet: { include: { campaign: true } } } });
    if (!ad) return reply.code(404).send({ error: "Ad not found." });
    if (!ownedByRequester(request, ad.adSet.campaign)) return reply.code(403).send({ error: "Forbidden." });
    const parsed = z
      .object({ creativePackageId: z.string().optional(), hookId: z.string().optional(), creativeAngleId: z.string().optional(), scriptId: z.string().optional(), assetDocumentId: z.string().optional(), format: z.string().optional(), ctaType: z.string().optional() })
      .safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid request.", details: parsed.error.flatten() });
    const outcome = await linkAdCreative({ studentId: ad.adSet.campaign.studentId, businessId: ad.adSet.campaign.businessId, adId: id, ...parsed.data });
    if (!outcome.ok) return reply.code(outcome.httpStatus ?? 500).send({ error: outcome.reason });
    return reply.send(outcome);
  });

  app.get("/api/ad-accounts/:id/creative-performance", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const account = await db.adAccount.findUnique({ where: { id } });
    if (!account) return reply.code(404).send({ error: "Ad account not found." });
    if (!ownedByRequester(request, account)) return reply.code(403).send({ error: "Forbidden." });
    const { groupBy, preset, from, to } = request.query as { groupBy?: string; preset?: string; from?: string; to?: string };
    if (!groupBy || !["hook", "angle", "format", "ctaType"].includes(groupBy)) return reply.code(400).send({ error: "groupBy must be one of hook, angle, format, ctaType." });
    let range;
    try {
      range = resolveDateRange((preset as (typeof DATE_RANGE_PRESETS)[number]) ?? "LAST_30_DAYS", { from, to });
    } catch (err) {
      return reply.code(400).send({ error: err instanceof Error ? err.message : "Invalid date range." });
    }
    const rollup = await getCreativePerformanceRollup({ adAccountId: id, groupBy: groupBy as CreativeGroupBy, dateFrom: range.from, dateTo: range.to });
    return reply.send({ dateRange: range, groupBy, rollup });
  });

  app.post("/api/ad-accounts/:id/creative-fatigue-check", { preHandler: [requireAuth], config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const account = await db.adAccount.findUnique({ where: { id } });
    if (!account) return reply.code(404).send({ error: "Ad account not found." });
    if (!ownedByRequester(request, account)) return reply.code(403).send({ error: "Forbidden." });
    const results = await checkCreativeFatigue({ adAccountId: id, actorUserId: request.authContext!.userId });
    return reply.send({ results });
  });

  // --- Creative Testing Lab (spec sections 36-40) -------------------------

  const testPlanCreateSchema = z.object({ businessId: z.string().min(1), adCampaignId: z.string().optional(), name: z.string().min(1), hypothesis: z.string().min(1), variable: z.enum(["HOOK", "VISUAL", "COPY", "CTA", "AUDIENCE", "OTHER"]), audience: z.string().optional(), metricFocus: z.string().optional() });

  app.post("/api/students/:studentId/ad-test-plans", { preHandler: [requireAuth, requireStudentSelfOrPermission("Ads Command Center", "CREATE")] }, async (request, reply) => {
    const { studentId } = request.params as { studentId: string };
    const parsed = testPlanCreateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid test plan.", details: parsed.error.flatten() });
    if (!(await assertBusinessOwnedByStudent(parsed.data.businessId, studentId))) return reply.code(403).send({ error: "Forbidden: this business does not belong to you." });

    const plan = await db.adTestPlan.create({
      data: {
        testDisplayId: await generateAdTestPlanDisplayId(),
        studentId,
        businessId: parsed.data.businessId,
        adCampaignId: parsed.data.adCampaignId ?? null,
        name: parsed.data.name,
        hypothesis: parsed.data.hypothesis,
        variable: parsed.data.variable,
        audience: parsed.data.audience ?? null,
        metricFocus: parsed.data.metricFocus ?? null,
        createdById: request.authContext!.userId,
      },
    });
    await writeAuditLog({ action: "Ad Test Plan Created", summary: `Test plan "${plan.name}" created (variable: ${plan.variable})`, actorUserId: request.authContext!.userId, entityType: "AdTestPlan", entityId: plan.id });
    return reply.code(201).send({ testPlan: plan });
  });

  app.get("/api/businesses/:businessId/ad-test-plans", { preHandler: [requireAuth] }, async (request, reply) => {
    const { businessId } = request.params as { businessId: string };
    if (!(await assertBusinessAccessible(request, businessId))) return reply.code(403).send({ error: "Forbidden: this business does not belong to you." });
    const plans = await db.adTestPlan.findMany({ where: { businessId }, orderBy: { createdAt: "desc" } });
    return reply.send({ testPlans: plans });
  });

  app.get("/api/ad-test-plans/:id", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const plan = await db.adTestPlan.findUnique({ where: { id }, include: { variants: true } });
    if (!plan) return reply.code(404).send({ error: "Test plan not found." });
    if (!ownedByRequester(request, plan)) return reply.code(403).send({ error: "Forbidden." });
    return reply.send({ testPlan: plan });
  });

  app.post("/api/ad-test-plans/:id/variants", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const plan = await db.adTestPlan.findUnique({ where: { id } });
    if (!plan) return reply.code(404).send({ error: "Test plan not found." });
    if (!ownedByRequester(request, plan)) return reply.code(403).send({ error: "Forbidden." });
    const parsed = z.object({ label: z.string().min(1), adId: z.string().optional(), creativeLinkId: z.string().optional(), notes: z.string().optional() }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid variant.", details: parsed.error.flatten() });
    const variant = await db.adTestVariant.create({ data: { testPlanId: id, label: parsed.data.label, adId: parsed.data.adId ?? null, creativeLinkId: parsed.data.creativeLinkId ?? null, notes: parsed.data.notes ?? null } });
    return reply.code(201).send({ variant });
  });

  app.post("/api/ad-test-plans/:id/status", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const plan = await db.adTestPlan.findUnique({ where: { id } });
    if (!plan) return reply.code(404).send({ error: "Test plan not found." });
    if (!ownedByRequester(request, plan)) return reply.code(403).send({ error: "Forbidden." });
    const parsed = z.object({ status: z.enum(["PLANNED", "RUNNING", "INSUFFICIENT_DATA", "READY_FOR_REVIEW", "COMPLETED", "CANCELLED"]) }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid status.", details: parsed.error.flatten() });
    const updated = await db.adTestPlan.update({ where: { id }, data: { status: parsed.data.status } });
    await writeAuditLog({ action: "Ad Test Plan Status Changed", summary: `Test plan "${plan.name}" status ${plan.status} -> ${parsed.data.status}`, actorUserId: request.authContext!.userId, entityType: "AdTestPlan", entityId: id });
    return reply.send({ testPlan: updated });
  });

  // Real comparison only — never declares a winner from early/thin data
  // (spec section 39); labels are always factual ("TOP-PERFORMING BY CTR"),
  // never "WINNER" (spec section 40).
  app.get("/api/ad-test-plans/:id/comparison", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const plan = await db.adTestPlan.findUnique({ where: { id } });
    if (!plan) return reply.code(404).send({ error: "Test plan not found." });
    if (!ownedByRequester(request, plan)) return reply.code(403).send({ error: "Forbidden." });
    const { preset, from, to } = request.query as { preset?: string; from?: string; to?: string };
    let range;
    try {
      range = resolveDateRange((preset as (typeof DATE_RANGE_PRESETS)[number]) ?? "LAST_30_DAYS", { from, to });
    } catch (err) {
      return reply.code(400).send({ error: err instanceof Error ? err.message : "Invalid date range." });
    }
    const variants = await compareTestVariants(id, range.from, range.to);
    return reply.send({ dateRange: range, variants });
  });

  // --- Attribution + Revenue + Marketing Funnel (spec sections 41-55) -----

  app.post("/api/ad-campaigns/:id/attribution/recompute", { preHandler: [requireAuth], config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const campaign = await db.adCampaign.findUnique({ where: { id } });
    if (!campaign) return reply.code(404).send({ error: "Campaign not found." });
    if (!ownedByRequester(request, campaign)) return reply.code(403).send({ error: "Forbidden." });
    if (!campaign.utmCampaign) return reply.code(422).send({ error: "This campaign has no utmCampaign value configured — nothing to match against." });
    const result = await recomputeAttributionForCampaign(id);
    return reply.send({ result });
  });

  app.get("/api/ad-campaigns/:id/revenue-attribution", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const campaign = await db.adCampaign.findUnique({ where: { id } });
    if (!campaign) return reply.code(404).send({ error: "Campaign not found." });
    if (!ownedByRequester(request, campaign)) return reply.code(403).send({ error: "Forbidden." });
    const { preset, from, to } = request.query as { preset?: string; from?: string; to?: string };
    let range;
    try {
      range = resolveDateRange((preset as (typeof DATE_RANGE_PRESETS)[number]) ?? "LAST_30_DAYS", { from, to });
    } catch (err) {
      return reply.code(400).send({ error: err instanceof Error ? err.message : "Invalid date range." });
    }
    const revenue = await getRevenueAttribution(id, range.from, range.to);
    return reply.send({ dateRange: range, revenue });
  });

  app.get("/api/ad-campaigns/:id/marketing-funnel", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const campaign = await db.adCampaign.findUnique({ where: { id } });
    if (!campaign) return reply.code(404).send({ error: "Campaign not found." });
    if (!ownedByRequester(request, campaign)) return reply.code(403).send({ error: "Forbidden." });
    const { preset, from, to } = request.query as { preset?: string; from?: string; to?: string };
    let range;
    try {
      range = resolveDateRange((preset as (typeof DATE_RANGE_PRESETS)[number]) ?? "LAST_30_DAYS", { from, to });
    } catch (err) {
      return reply.code(400).send({ error: err instanceof Error ? err.message : "Invalid date range." });
    }
    const stages = await getMarketingFunnelView(id, range.from, range.to);
    return reply.send({ dateRange: range, stages });
  });

  app.get("/api/businesses/:businessId/attribution-coverage", { preHandler: [requireAuth] }, async (request, reply) => {
    const { businessId } = request.params as { businessId: string };
    if (!(await assertBusinessAccessible(request, businessId))) return reply.code(403).send({ error: "Forbidden: this business does not belong to you." });
    const { preset, from, to } = request.query as { preset?: string; from?: string; to?: string };
    let range;
    try {
      range = resolveDateRange((preset as (typeof DATE_RANGE_PRESETS)[number]) ?? "LAST_30_DAYS", { from, to });
    } catch (err) {
      return reply.code(400).send({ error: err instanceof Error ? err.message : "Invalid date range." });
    }
    const coverage = await getAttributionCoverage(businessId, range.from, range.to);
    return reply.send({ dateRange: range, coverage });
  });

  // --- Budget Center + Guardrails (spec sections 56-59) -------------------

  app.get("/api/ad-accounts/:id/budget-overview", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const account = await db.adAccount.findUnique({ where: { id } });
    if (!account) return reply.code(404).send({ error: "Ad account not found." });
    if (!ownedByRequester(request, account)) return reply.code(403).send({ error: "Forbidden." });
    const { preset, from, to } = request.query as { preset?: string; from?: string; to?: string };
    let range;
    try {
      range = resolveDateRange((preset as (typeof DATE_RANGE_PRESETS)[number]) ?? "LAST_30_DAYS", { from, to });
    } catch (err) {
      return reply.code(400).send({ error: err instanceof Error ? err.message : "Invalid date range." });
    }
    const rows = await getBudgetCenterOverview(id, range.from, range.to);
    return reply.send({ dateRange: range, rows });
  });

  const alertRuleCreateSchema = z.object({ businessId: z.string().min(1), adCampaignId: z.string().optional(), metric: z.enum(["DAILY_SPEND", "CAMPAIGN_SPEND", "CPL", "COST_PER_CONVERSATION", "ROAS"]), comparator: z.enum(["ABOVE", "BELOW"]), threshold: z.number() });

  app.post("/api/students/:studentId/ad-budget-alert-rules", { preHandler: [requireAuth, requireStudentSelfOrPermission("Ads Command Center", "CREATE")] }, async (request, reply) => {
    const { studentId } = request.params as { studentId: string };
    const parsed = alertRuleCreateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid rule.", details: parsed.error.flatten() });
    if (!(await assertBusinessOwnedByStudent(parsed.data.businessId, studentId))) return reply.code(403).send({ error: "Forbidden: this business does not belong to you." });
    const rule = await db.adBudgetAlertRule.create({ data: { studentId, businessId: parsed.data.businessId, adCampaignId: parsed.data.adCampaignId ?? null, metric: parsed.data.metric, comparator: parsed.data.comparator, threshold: parsed.data.threshold, createdById: request.authContext!.userId } });
    await writeAuditLog({ action: "Ad Budget Alert Rule Changed", summary: `Budget alert rule created (${rule.metric} ${rule.comparator} ${rule.threshold})`, actorUserId: request.authContext!.userId, entityType: "AdBudgetAlertRule", entityId: rule.id });
    return reply.code(201).send({ rule });
  });

  app.get("/api/businesses/:businessId/ad-budget-alert-rules", { preHandler: [requireAuth] }, async (request, reply) => {
    const { businessId } = request.params as { businessId: string };
    if (!(await assertBusinessAccessible(request, businessId))) return reply.code(403).send({ error: "Forbidden: this business does not belong to you." });
    const rules = await db.adBudgetAlertRule.findMany({ where: { businessId }, orderBy: { createdAt: "desc" } });
    return reply.send({ rules });
  });

  app.patch("/api/ad-budget-alert-rules/:id", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const rule = await db.adBudgetAlertRule.findUnique({ where: { id } });
    if (!rule) return reply.code(404).send({ error: "Rule not found." });
    if (!ownedByRequester(request, rule)) return reply.code(403).send({ error: "Forbidden." });
    const parsed = z.object({ threshold: z.number().optional(), isActive: z.boolean().optional() }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid update.", details: parsed.error.flatten() });
    const updated = await db.adBudgetAlertRule.update({ where: { id }, data: parsed.data });
    await writeAuditLog({ action: "Ad Budget Alert Rule Changed", summary: `Budget alert rule updated`, actorUserId: request.authContext!.userId, entityType: "AdBudgetAlertRule", entityId: id });
    return reply.send({ rule: updated });
  });

  // Alert only — never mutates spend/budget (spec section 58).
  app.post("/api/ad-campaigns/:id/budget-alerts/check", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const campaign = await db.adCampaign.findUnique({ where: { id } });
    if (!campaign) return reply.code(404).send({ error: "Campaign not found." });
    if (!ownedByRequester(request, campaign)) return reply.code(403).send({ error: "Forbidden." });
    const { preset, from, to } = (request.body as { preset?: string; from?: string; to?: string }) ?? {};
    let range;
    try {
      range = resolveDateRange((preset as (typeof DATE_RANGE_PRESETS)[number]) ?? "TODAY", { from, to });
    } catch (err) {
      return reply.code(400).send({ error: err instanceof Error ? err.message : "Invalid date range." });
    }
    const results = await checkBudgetAlerts(id, range.from, range.to);
    return reply.send({ results });
  });

  // --- Optimization Center (spec sections 60-66, 78-82) -------------------

  app.post("/api/ad-campaigns/:id/optimization-actions", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const campaign = await db.adCampaign.findUnique({ where: { id } });
    if (!campaign) return reply.code(404).send({ error: "Campaign not found." });
    if (!ownedByRequester(request, campaign)) return reply.code(403).send({ error: "Forbidden." });
    const parsed = z.object({ actionType: z.enum(["BUDGET_CHANGE_REQUESTED", "PAUSE_REQUESTED", "RESUME_REQUESTED"]), currentValue: z.unknown().optional(), proposedValue: z.unknown().optional(), reason: z.string().optional(), recommendationId: z.string().optional() }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid request.", details: parsed.error.flatten() });
    const outcome = await requestOptimizationAction({ studentId: campaign.studentId, businessId: campaign.businessId, adCampaignId: id, ...parsed.data, requestedById: request.authContext!.userId });
    if (!outcome.ok) return reply.code(outcome.httpStatus).send({ error: outcome.reason });
    return reply.code(201).send(outcome);
  });

  app.get("/api/ad-campaigns/:id/optimization-actions", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const campaign = await db.adCampaign.findUnique({ where: { id } });
    if (!campaign) return reply.code(404).send({ error: "Campaign not found." });
    if (!ownedByRequester(request, campaign)) return reply.code(403).send({ error: "Forbidden." });
    const actions = await db.adOptimizationAction.findMany({ where: { adCampaignId: id }, orderBy: { createdAt: "desc" } });
    return reply.send({ actions });
  });

  // Only staff holding Ads Command Center / VERIFY may decide — a Student
  // may never approve their own budget/pause/resume request (spec 11, 78).
  app.post("/api/ad-optimization-actions/:id/decide", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const action = await db.adOptimizationAction.findUnique({ where: { id } });
    if (!action) return reply.code(404).send({ error: "Optimization action not found." });
    if (!ownedByRequester(request, action)) return reply.code(403).send({ error: "Forbidden." });
    if (request.authContext!.kind !== "staff") return reply.code(403).send({ error: "Only staff may approve or reject an optimization action." });
    const { checkPermission } = await import("../../rbac/middleware.js");
    if (!(await checkPermission(request.authContext!.userId, "Ads Command Center", "VERIFY"))) {
      return reply.code(403).send({ error: "Forbidden: requires Ads Command Center / VERIFY." });
    }
    const parsed = z.object({ decision: z.enum(["APPROVED", "REJECTED"]) }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid request.", details: parsed.error.flatten() });
    const outcome = await decideOptimizationAction({ actionId: id, decision: parsed.data.decision, approvedById: request.authContext!.userId });
    if (!outcome.ok) return reply.code(outcome.httpStatus).send({ error: outcome.reason });
    return reply.send(outcome);
  });

  app.post("/api/ad-campaigns/:id/full-funnel-diagnostic", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const campaign = await db.adCampaign.findUnique({ where: { id } });
    if (!campaign) return reply.code(404).send({ error: "Campaign not found." });
    if (!ownedByRequester(request, campaign)) return reply.code(403).send({ error: "Forbidden." });
    const { preset, from, to } = (request.body as { preset?: string; from?: string; to?: string }) ?? {};
    let range;
    try {
      range = resolveDateRange((preset as (typeof DATE_RANGE_PRESETS)[number]) ?? "LAST_30_DAYS", { from, to });
    } catch (err) {
      return reply.code(400).send({ error: err instanceof Error ? err.message : "Invalid date range." });
    }
    const diagnostic = await runFullFunnelDiagnostic(id, range.from, range.to);
    return reply.send({ dateRange: range, ...diagnostic });
  });

  // --- Recommendations (spec sections 15-16 of Optimization Center) ------

  app.get("/api/businesses/:businessId/ad-recommendations", { preHandler: [requireAuth] }, async (request, reply) => {
    const { businessId } = request.params as { businessId: string };
    if (!(await assertBusinessAccessible(request, businessId))) return reply.code(403).send({ error: "Forbidden: this business does not belong to you." });
    const { status, category } = request.query as { status?: string; category?: string };
    const recommendations = await db.adRecommendation.findMany({ where: { businessId, status: status || undefined, category: category || undefined }, orderBy: { createdAt: "desc" }, take: 200 });
    return reply.send({ recommendations });
  });

  app.post("/api/ad-recommendations/:id/action", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const recommendation = await db.adRecommendation.findUnique({ where: { id } });
    if (!recommendation) return reply.code(404).send({ error: "Recommendation not found." });
    if (!ownedByRequester(request, recommendation)) return reply.code(403).send({ error: "Forbidden." });
    const parsed = z.object({ status: z.enum(["ACTIONED", "DISMISSED"]), note: z.string().optional() }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid request.", details: parsed.error.flatten() });
    const updated = await db.adRecommendation.update({ where: { id }, data: { status: parsed.data.status, actionedById: request.authContext!.userId, actionedAt: new Date(), actionNote: parsed.data.note ?? null } });
    await writeAuditLog({ action: "Ad Recommendation Actioned", summary: `Recommendation "${recommendation.title}" marked ${parsed.data.status}`, actorUserId: request.authContext!.userId, entityType: "AdRecommendation", entityId: id });
    return reply.send({ recommendation: updated });
  });

  // --- Campaign Planner (spec sections 68-73) ------------------------------

  app.post("/api/students/:studentId/ad-campaign-plans", { preHandler: [requireAuth, requireStudentSelfOrPermission("Ads Command Center", "CREATE")], config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, async (request, reply) => {
    const { studentId } = request.params as { studentId: string };
    const parsed = z.object({ businessId: z.string().min(1), objective: z.string().min(1), offerId: z.string().optional(), offerContext: z.string().optional(), audienceNotes: z.string().optional(), budgetContext: z.string().optional() }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid request.", details: parsed.error.flatten() });
    if (!(await assertBusinessOwnedByStudent(parsed.data.businessId, studentId))) return reply.code(403).send({ error: "Forbidden: this business does not belong to you." });

    const outcome = await generateCampaignPlan({ studentId, businessId: parsed.data.businessId, objective: parsed.data.objective, offerId: parsed.data.offerId, offerContext: parsed.data.offerContext, audienceNotes: parsed.data.audienceNotes, budgetContext: parsed.data.budgetContext, actorUserId: request.authContext!.userId });
    if (!outcome.ok) return reply.code(outcome.httpStatus).send({ error: outcome.reason });
    const plan = await db.adCampaignPlan.findUniqueOrThrow({ where: { id: outcome.planId } });
    return reply.code(201).send({ generationId: outcome.generationId, plan });
  });

  app.get("/api/businesses/:businessId/ad-campaign-plans", { preHandler: [requireAuth] }, async (request, reply) => {
    const { businessId } = request.params as { businessId: string };
    if (!(await assertBusinessAccessible(request, businessId))) return reply.code(403).send({ error: "Forbidden: this business does not belong to you." });
    const plans = await db.adCampaignPlan.findMany({ where: { businessId }, orderBy: { createdAt: "desc" } });
    return reply.send({ plans });
  });

  app.get("/api/ad-campaign-plans/:id", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const plan = await db.adCampaignPlan.findUnique({ where: { id } });
    if (!plan) return reply.code(404).send({ error: "Plan not found." });
    if (!ownedByRequester(request, plan)) return reply.code(403).send({ error: "Forbidden." });
    return reply.send({ plan });
  });

  app.post("/api/ad-campaign-plans/:id/status", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const plan = await db.adCampaignPlan.findUnique({ where: { id } });
    if (!plan) return reply.code(404).send({ error: "Plan not found." });
    if (!ownedByRequester(request, plan)) return reply.code(403).send({ error: "Forbidden." });
    const parsed = z.object({ status: z.enum(["DRAFT", "APPROVED", "ARCHIVED"]) }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid status.", details: parsed.error.flatten() });
    const updated = await db.adCampaignPlan.update({ where: { id }, data: { status: parsed.data.status } });
    return reply.send({ plan: updated });
  });

  // --- UTM Builder + Tracking Validator + Pre-Launch Checklist (spec 74-77)

  app.post("/api/utm/build", { preHandler: [requireAuth] }, async (request, reply) => {
    const parsed = z.object({ business: z.string().min(1), objective: z.string().min(1), offer: z.string().optional(), audience: z.string().optional(), baseUrl: z.string().url().optional(), source: z.string().default("facebook"), medium: z.string().default("paid_social"), content: z.string().optional() }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid request.", details: parsed.error.flatten() });
    const campaign = buildUtmCampaignSlug({ business: parsed.data.business, objective: parsed.data.objective, offer: parsed.data.offer, audience: parsed.data.audience });
    const utm = { source: parsed.data.source, medium: parsed.data.medium, campaign, content: parsed.data.content };
    const url = parsed.data.baseUrl ? buildUtmUrl(parsed.data.baseUrl, utm) : null;
    return reply.send({ utm, url });
  });

  app.get("/api/ad-campaigns/:id/tracking-validation", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const campaign = await db.adCampaign.findUnique({ where: { id } });
    if (!campaign) return reply.code(404).send({ error: "Campaign not found." });
    if (!ownedByRequester(request, campaign)) return reply.code(403).send({ error: "Forbidden." });
    const issues = await validateCampaignTracking(id);
    return reply.send({ issues, blocking: issues.some((i) => i.severity === "BLOCKING") });
  });

  app.get("/api/ad-campaigns/:id/pre-launch-checklist", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const campaign = await db.adCampaign.findUnique({ where: { id } });
    if (!campaign) return reply.code(404).send({ error: "Campaign not found." });
    if (!ownedByRequester(request, campaign)) return reply.code(403).send({ error: "Forbidden." });
    const checklist = await getPreLaunchChecklist(id);
    return reply.send({ checklist, allReady: Object.values(checklist).every(Boolean) });
  });

  // --- Ask M.A.I.A. Ads (spec sections 91-95) ------------------------------

  app.post("/api/ad-accounts/:id/ask", { preHandler: [requireAuth], config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const account = await db.adAccount.findUnique({ where: { id } });
    if (!account) return reply.code(404).send({ error: "Ad account not found." });
    if (!ownedByRequester(request, account)) return reply.code(403).send({ error: "Forbidden." });
    const parsed = z.object({ question: z.string().min(1) }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid request.", details: parsed.error.flatten() });
    const result = await askMaiaAds(parsed.data.question, { studentId: account.studentId, businessId: account.businessId, adAccountId: id });
    if (!result.ok) return reply.code(422).send({ error: "This question isn't one Ask M.A.I.A. Ads can answer yet. Try asking about performance, CPL, best creative, verified enrollments, or what to test next." });
    return reply.send(result);
  });

  // --- Ads Brief (spec sections 89-90) -------------------------------------

  app.get("/api/ad-accounts/:id/brief", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const account = await db.adAccount.findUnique({ where: { id } });
    if (!account) return reply.code(404).send({ error: "Ad account not found." });
    if (!ownedByRequester(request, account)) return reply.code(403).send({ error: "Forbidden." });
    const { preset, from, to } = request.query as { preset?: string; from?: string; to?: string };
    let range;
    try {
      range = resolveDateRange((preset as (typeof DATE_RANGE_PRESETS)[number]) ?? "LAST_7_DAYS", { from, to });
    } catch (err) {
      return reply.code(400).send({ error: err instanceof Error ? err.message : "Invalid date range." });
    }
    const brief = await buildAdsBrief(id, range.from, range.to);
    return reply.send({ brief });
  });

  // --- Admin oversight -----------------------------------------------------

  app.get("/api/ads-command-center/connections", { preHandler: [requireAuth, requirePermission("Ads Command Center", "VIEW")] }, async (request, reply) => {
    const { studentId, businessId, provider, status } = request.query as { studentId?: string; businessId?: string; provider?: string; status?: string };
    const connections = await db.adConnection.findMany({
      where: { studentId: studentId || undefined, businessId: businessId || undefined, provider: provider || undefined, status: status || undefined },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return reply.send({ connections });
  });
}
