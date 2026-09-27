// M.A.I.A. Productization / Entitlements (Production Phase 16) — route
// aggregator. Each concern lives in its own file; this only registers them.

import type { FastifyInstance } from "fastify";
import { productCatalogRoutes } from "./catalog.js";
import { accessRoutes } from "./access.js";
import { checkoutRoutes } from "./checkout.js";
import { upgradeRoutes } from "./upgrade.js";
import { migrationRoutes } from "./migration.js";

export async function entitlementRoutes(app: FastifyInstance) {
  await app.register(productCatalogRoutes);
  await app.register(accessRoutes);
  await app.register(checkoutRoutes);
  await app.register(upgradeRoutes);
  await app.register(migrationRoutes);
}
