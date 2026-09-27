// Seeds the Feature Catalog + starter Level 1/2/3/Build-With-You Products
// (spec sections 2, 19-20, 23-25) and an admin-confirmable (never
// auto-applied) mapping from the existing Premium/VIP/Dual VIP Packages
// (spec section 22). None of this is a permanent, hard-coded commercial
// rule — every Product here stays fully editable through the Product
// Catalog admin routes, and the PackageMapping rows are created
// UNCONFIRMED; nothing about a real Student's access changes until an
// Owner/Admin explicitly reviews and confirms one (spec section 100).

import type { Prisma } from "@prisma/client";
import { db } from "../db.js";
import { FEATURE_CATALOG_SEED } from "./features.js";
import { generateCommerceProductDisplayId } from "../modules/sequence.js";

export async function seedEntitlementCatalog(createdById: string) {
  for (const f of FEATURE_CATALOG_SEED) {
    await db.feature.upsert({ where: { featureKey: f.featureKey }, update: { name: f.name, description: f.description, category: f.category }, create: f });
  }

  async function upsertProduct(name: string, fields: { type: string; billingType?: string; entitlementsJson: Prisma.InputJsonValue; includesProductIds?: string[]; basePrice?: number }) {
    const existing = await db.commerceProduct.findFirst({ where: { name } });
    if (existing) {
      return db.commerceProduct.update({ where: { id: existing.id }, data: { entitlementsJson: fields.entitlementsJson, includesProductIds: fields.includesProductIds ?? [] } });
    }
    return db.commerceProduct.create({
      data: {
        productDisplayId: await generateCommerceProductDisplayId(),
        name,
        type: fields.type,
        status: "ACTIVE",
        billingType: fields.billingType ?? "ONE_TIME",
        basePrice: fields.basePrice,
        entitlementsJson: fields.entitlementsJson,
        includesProductIds: fields.includesProductIds ?? [],
        createdById,
      },
    });
  }

  const level1 = await upsertProduct("M.A.I.A. Level 1", {
    type: "PACKAGE",
    basePrice: 25000,
    entitlementsJson: [{ featureKey: "BUSINESS_OS" }, { featureKey: "MULTIPLE_BUSINESSES", usageLimit: 1 }, { featureKey: "CREATIVE_STUDIO" }],
  });
  const level2 = await upsertProduct("M.A.I.A. Level 2", {
    type: "PACKAGE",
    basePrice: 45000,
    includesProductIds: [level1.id],
    entitlementsJson: [{ featureKey: "AUTOMATION_STUDIO" }, { featureKey: "WEBSITE_BUILDER" }, { featureKey: "FUNNEL_BUILDER" }],
  });
  const level3 = await upsertProduct("M.A.I.A. Level 3", {
    type: "PACKAGE",
    basePrice: 65000,
    includesProductIds: [level2.id],
    entitlementsJson: [
      { featureKey: "ADS_INTELLIGENCE" },
      { featureKey: "ADVANCED_ANALYTICS" },
      { featureKey: "MULTIPLE_BUSINESSES", usageLimit: 3 },
      { featureKey: "VIDEO_DIRECTOR", usageLimit: 10, usagePeriod: "MONTHLY" },
    ],
  });
  // Deliberately standalone (spec section 25: "Service != Software
  // Access") — Build With You is purchased/granted independently of any
  // Level, so the service entitlement can expire without touching
  // whatever software-level access the Student separately has.
  const buildWithYou = await upsertProduct("Build With You", {
    type: "BUILD_WITH_YOU",
    billingType: "MANUAL",
    entitlementsJson: [{ featureKey: "BUILD_WITH_YOU" }],
  });

  const packages = await db.package.findMany({ where: { name: { in: ["Premium", "VIP", "Dual VIP"] } } });
  const mappingTarget: Record<string, string> = { Premium: level1.id, VIP: level2.id, "Dual VIP": level3.id };
  for (const pkg of packages) {
    const mappedProductId = mappingTarget[pkg.name];
    if (!mappedProductId) continue;
    await db.packageMapping.upsert({
      where: { legacyPackageId: pkg.id },
      update: {},
      create: { legacyPackageId: pkg.id, mappedProductId, confirmed: false, createdById },
    });
  }

  return { level1, level2, level3, buildWithYou };
}
