// M.A.I.A. Commerce & Growth Engine (Production Phase 17) — route
// aggregator. Each concern lives in its own file; this only registers
// them. Reuses Phase 16's entitlement/product/subscription routes
// (server/src/modules/entitlements/*) rather than duplicating them.

import type { FastifyInstance } from "fastify";
import { checkoutSessionRoutes } from "./checkout-session.js";
import { webhookRoutes } from "./webhooks.js";
import { scholarshipRoutes } from "./scholarship.js";
import { affiliateRoutes } from "./affiliate.js";
import { refundRoutes } from "./refund.js";
import { commerceDashboardRoutes } from "./dashboard.js";

export async function commerceRoutes(app: FastifyInstance) {
  await app.register(checkoutSessionRoutes);
  await app.register(webhookRoutes);
  await app.register(scholarshipRoutes);
  await app.register(affiliateRoutes);
  await app.register(refundRoutes);
  await app.register(commerceDashboardRoutes);
}
