// M.A.I.A. Business OS (Production Phase 15) — route aggregator. Each
// concern lives in its own file (team/crm/goals/plan/finance/catalog/
// operations/home); this file only registers them plus the two remaining
// cross-cutting endpoints (Ask M.A.I.A. Business Copilot, Daily Brief).

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../../db.js";
import { requireAuth, assertBusinessAccess, type AuthContext } from "../../rbac/middleware.js";
import { businessTeamRoutes } from "./team.js";
import { businessCrmRoutes } from "./crm.js";
import { businessGoalsRoutes } from "./goals.js";
import { businessPlanRoutes } from "./plan.js";
import { businessFinanceRoutes } from "./finance.js";
import { businessCatalogRoutes } from "./catalog.js";
import { businessOperationsRoutes } from "./operations.js";
import { businessHomeRoutes, computeBusinessHealth, computeActionCenter } from "./home.js";
import { askMaiaBusiness } from "./copilot.js";
import { requireFeatureEntitlement } from "../../entitlements/middleware.js";

async function authorize(request: { authContext?: AuthContext }, businessId: string): Promise<boolean> {
  const ctx = request.authContext;
  if (!ctx) return false;
  return assertBusinessAccess(businessId, ctx, "VIEW");
}

function getBusinessIdFromRequest(request: { params: unknown; body: unknown }): string | undefined {
  const params = request.params as { businessId?: string };
  if (params?.businessId) return params.businessId;
  const body = request.body as { businessId?: string } | undefined;
  return body?.businessId;
}

export async function businessOsRoutes(app: FastifyInstance) {
  // Production Phase 16 backend feature gate (spec section 101) — every
  // route in this plugin (including every nested sub-plugin registered
  // below) requires the real BUSINESS_OS entitlement server-side, not just
  // a hidden nav link. requireAuth runs again here even though every route
  // below also lists it individually — idempotent, and necessary because a
  // plugin-level preHandler added via addHook runs BEFORE route-specific
  // preHandlers in Fastify's lifecycle, so this hook cannot rely on a
  // route's own requireAuth having already populated request.authContext.
  app.addHook("preHandler", requireAuth);
  app.addHook("preHandler", requireFeatureEntitlement("BUSINESS_OS", getBusinessIdFromRequest));

  await app.register(businessTeamRoutes);
  await app.register(businessCrmRoutes);
  await app.register(businessGoalsRoutes);
  await app.register(businessPlanRoutes);
  await app.register(businessFinanceRoutes);
  await app.register(businessCatalogRoutes);
  await app.register(businessOperationsRoutes);
  await app.register(businessHomeRoutes);

  const askSchema = z.object({ question: z.string().min(1).max(500) });

  app.post("/api/businesses/:businessId/ask", { preHandler: [requireAuth], config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, async (request, reply) => {
    const { businessId } = request.params as { businessId: string };
    if (!(await authorize(request, businessId))) return reply.code(403).send({ error: "Forbidden: this business does not belong to you." });
    const parsed = askSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid request." });

    const result = await askMaiaBusiness(parsed.data.question, { businessId });
    if (!result.ok) return reply.code(422).send({ ok: false, error: "M.A.I.A. doesn't have a specific answer for that yet. Try asking about today's priorities, leads needing follow-up, business health, or open opportunities." });
    return reply.send(result);
  });

  // Daily Business Brief (spec section 87) — every section below is a real
  // query, never an invented narrative. Sections stay empty rather than
  // fabricate content when a business has no data yet.
  app.get("/api/businesses/:businessId/daily-brief", { preHandler: [requireAuth] }, async (request, reply) => {
    const { businessId } = request.params as { businessId: string };
    if (!(await authorize(request, businessId))) return reply.code(403).send({ error: "Forbidden: this business does not belong to you." });

    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [health, actionItems, newContacts, revenueToday, openOpportunities, activeAutomations] = await Promise.all([
      computeBusinessHealth(businessId),
      computeActionCenter(businessId),
      db.businessContact.count({ where: { businessId, createdAt: { gte: since24h } } }),
      db.businessRevenueRecord.aggregate({ where: { businessId, occurredAt: { gte: since24h } }, _sum: { amount: true } }),
      db.opportunity.count({ where: { businessId, status: "OPEN" } }),
      db.automation.count({ where: { businessId, status: "ACTIVE" } }),
    ]);

    return reply.send({
      generatedAt: new Date().toISOString(),
      whatChanged: { newContactsLast24h: newContacts, revenueRecordedLast24h: Number(revenueToday._sum.amount ?? 0) },
      todaysPriorities: actionItems.slice(0, 10),
      leads: { newLast24h: newContacts },
      sales: { openOpportunities },
      automation: { activeAutomations },
      risks: health.filter((c) => c.status === "NEEDS_ATTENTION"),
      opportunities: health.filter((c) => c.status === "SETUP_REQUIRED"),
      recommendedActions: actionItems.slice(0, 5).map((i) => i.title),
    });
  });
}
