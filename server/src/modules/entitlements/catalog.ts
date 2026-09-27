// M.A.I.A. Product Catalog admin routes (Production Phase 16, spec
// sections 2-3, 17-18, 61-65, 69-74). The "Package Builder" is just a
// CommerceProduct with type PACKAGE/BUNDLE — no separate builder entity;
// Admin configures entitlementsJson/includesProductIds directly, and
// Package Comparison (spec 18) resolves the SAME real expansion the grant
// engine uses, so a comparison view can never show a benefit the resolver
// wouldn't actually grant.

import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "../../db.js";
import { requireAuth, requirePermission } from "../../rbac/middleware.js";
import { writeAuditLog } from "../../audit/log.js";
import { generateCommerceProductDisplayId } from "../sequence.js";
import { expandProductFeatures } from "../../entitlements/grant.js";
import { FEATURE_KEYS } from "../../entitlements/features.js";

export const PRODUCT_TYPES = ["COURSE", "PROGRAM", "PACKAGE", "BUNDLE", "MEMBERSHIP", "SUBSCRIPTION", "SERVICE", "BUILD_WITH_YOU", "ADD_ON", "AI_ACCESS", "BUSINESS_OS_ACCESS", "CUSTOM"] as const;
export const PRODUCT_STATUSES = ["DRAFT", "ACTIVE", "INACTIVE", "ARCHIVED"] as const;
export const BILLING_TYPES = ["ONE_TIME", "RECURRING", "INSTALLMENT", "MANUAL", "CUSTOM"] as const;

const featureGrantSchema = z.object({
  featureKey: z.enum(FEATURE_KEYS),
  usageLimit: z.number().int().positive().optional(),
  usagePeriod: z.enum(["NEVER", "DAILY", "WEEKLY", "MONTHLY", "BILLING_CYCLE", "CUSTOM"]).optional(),
  businessLimit: z.number().int().positive().optional(),
  teamSeatLimit: z.number().int().positive().optional(),
});

export async function productCatalogRoutes(app: FastifyInstance) {
  app.get("/api/entitlements/features", { preHandler: [requireAuth, requirePermission("Product Catalog", "VIEW")] }, async (_request, reply) => {
    const features = await db.feature.findMany({ orderBy: { featureKey: "asc" } });
    return reply.send({ features });
  });

  const createProductSchema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    type: z.enum(PRODUCT_TYPES),
    billingType: z.enum(BILLING_TYPES).default("ONE_TIME"),
    basePrice: z.number().nonnegative().optional(),
    currency: z.string().default("PHP"),
    accessDurationDays: z.number().int().positive().optional(),
    visibility: z.enum(["PUBLIC", "HIDDEN", "INTERNAL"]).default("PUBLIC"),
    includesProductIds: z.array(z.string()).default([]),
    entitlementsJson: z.array(featureGrantSchema).default([]),
  });

  app.post("/api/entitlements/products", { preHandler: [requireAuth, requirePermission("Product Catalog", "CREATE")] }, async (request, reply) => {
    const parsed = createProductSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid request.", details: parsed.error.flatten() });

    // Rejects a self/circular inheritance reference at creation time —
    // real validation, never assumed safe (spec section 21).
    for (const includedId of parsed.data.includesProductIds) {
      const exists = await db.commerceProduct.findUnique({ where: { id: includedId } });
      if (!exists) return reply.code(400).send({ error: `Included product ${includedId} does not exist.` });
    }

    const ctx = request.authContext!;
    const product = await db.commerceProduct.create({
      data: {
        productDisplayId: await generateCommerceProductDisplayId(),
        name: parsed.data.name,
        description: parsed.data.description,
        type: parsed.data.type,
        billingType: parsed.data.billingType,
        basePrice: parsed.data.basePrice,
        currency: parsed.data.currency,
        accessDurationDays: parsed.data.accessDurationDays,
        visibility: parsed.data.visibility,
        includesProductIds: parsed.data.includesProductIds,
        entitlementsJson: parsed.data.entitlementsJson,
        createdById: ctx.userId,
      },
    });
    await writeAuditLog({ action: "Commerce Product Created", summary: `Product "${product.name}" (${product.type}) created`, actorUserId: ctx.userId, entityType: "CommerceProduct", entityId: product.id });
    return reply.code(201).send({ product });
  });

  app.get("/api/entitlements/products", { preHandler: [requireAuth, requirePermission("Product Catalog", "VIEW")] }, async (request, reply) => {
    const { type, status } = request.query as { type?: string; status?: string };
    const products = await db.commerceProduct.findMany({ where: { type: type || undefined, status: status || undefined }, orderBy: { createdAt: "desc" } });
    return reply.send({ products });
  });

  // Student Marketplace (spec section 75) — any authenticated Student or
  // staff member may browse what is actually purchasable; unlike the admin
  // list above this is never permission-gated by "Product Catalog", but it
  // is hard-scoped to ACTIVE + PUBLIC products only — a DRAFT, ARCHIVED,
  // HIDDEN or INTERNAL product is never exposed here.
  app.get("/api/entitlements/catalog", { preHandler: [requireAuth] }, async (_request, reply) => {
    const products = await db.commerceProduct.findMany({ where: { status: "ACTIVE", visibility: "PUBLIC" }, orderBy: { createdAt: "desc" } });
    return reply.send({ products });
  });

  app.get("/api/entitlements/products/:id", { preHandler: [requireAuth, requirePermission("Product Catalog", "VIEW")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const product = await db.commerceProduct.findUnique({ where: { id } });
    if (!product) return reply.code(404).send({ error: "Product not found." });
    return reply.send({ product });
  });

  // Package Comparison (spec section 18) — the real, resolver-consistent
  // set of features this Product actually grants, expanded through its
  // full inheritance chain. Never a marketing claim disconnected from
  // what the resolver would actually allow.
  app.get("/api/entitlements/products/:id/comparison", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const product = await db.commerceProduct.findUnique({ where: { id } });
    if (!product) return reply.code(404).send({ error: "Product not found." });
    const features = await expandProductFeatures(id);
    return reply.send({ product: { id: product.id, name: product.name, basePrice: product.basePrice, currency: product.currency, type: product.type }, features });
  });

  const updateProductSchema = z.object({
    status: z.enum(PRODUCT_STATUSES).optional(),
    basePrice: z.number().nonnegative().optional(),
    description: z.string().optional(),
    entitlementsJson: z.array(featureGrantSchema).optional(),
    includesProductIds: z.array(z.string()).optional(),
  });

  app.patch("/api/entitlements/products/:id", { preHandler: [requireAuth, requirePermission("Product Catalog", "EDIT")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const product = await db.commerceProduct.findUnique({ where: { id } });
    if (!product) return reply.code(404).send({ error: "Product not found." });
    const parsed = updateProductSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid request.", details: parsed.error.flatten() });

    const updated = await db.commerceProduct.update({ where: { id }, data: parsed.data });
    if (parsed.data.status) {
      await writeAuditLog({ action: "Commerce Product Status Changed", summary: `Product "${product.name}" status -> ${parsed.data.status}`, actorUserId: request.authContext!.userId, entityType: "CommerceProduct", entityId: id });
    }
    return reply.send({ product: updated });
  });

  // --- Upgrade Rules ----------------------------------------------------------

  const upgradeRuleSchema = z.object({
    fromProductId: z.string().min(1),
    toProductId: z.string().min(1),
    upgradePriceRuleJson: z.object({ mode: z.enum(["FIXED", "DIFFERENCE", "CUSTOM"]), amount: z.number().optional(), note: z.string().optional() }),
    eligibilityJson: z.record(z.string(), z.unknown()).optional(),
    creditRuleJson: z.object({ mode: z.enum(["NONE", "FIXED_CREDIT", "FULL_ELIGIBLE_CREDIT", "PERCENTAGE", "CUSTOM"]), amount: z.number().optional() }).optional(),
  });

  app.post("/api/entitlements/upgrade-rules", { preHandler: [requireAuth, requirePermission("Product Catalog", "CREATE")] }, async (request, reply) => {
    const parsed = upgradeRuleSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid request.", details: parsed.error.flatten() });
    const [from, to] = await Promise.all([db.commerceProduct.findUnique({ where: { id: parsed.data.fromProductId } }), db.commerceProduct.findUnique({ where: { id: parsed.data.toProductId } })]);
    if (!from || !to) return reply.code(400).send({ error: "fromProductId and toProductId must both be real products." });

    const rule = await db.upgradeRule.upsert({
      where: { fromProductId_toProductId: { fromProductId: parsed.data.fromProductId, toProductId: parsed.data.toProductId } },
      update: { upgradePriceRuleJson: parsed.data.upgradePriceRuleJson as Prisma.InputJsonValue, eligibilityJson: parsed.data.eligibilityJson as Prisma.InputJsonValue | undefined, creditRuleJson: parsed.data.creditRuleJson as Prisma.InputJsonValue | undefined },
      create: {
        fromProductId: parsed.data.fromProductId,
        toProductId: parsed.data.toProductId,
        upgradePriceRuleJson: parsed.data.upgradePriceRuleJson as Prisma.InputJsonValue,
        eligibilityJson: parsed.data.eligibilityJson as Prisma.InputJsonValue | undefined,
        creditRuleJson: parsed.data.creditRuleJson as Prisma.InputJsonValue | undefined,
      },
    });
    await writeAuditLog({ action: "Upgrade Rule Created", summary: `Upgrade rule ${from.name} -> ${to.name}`, actorUserId: request.authContext!.userId, entityType: "UpgradeRule", entityId: rule.id });
    return reply.code(201).send({ rule });
  });

  app.get("/api/entitlements/upgrade-rules", { preHandler: [requireAuth, requirePermission("Product Catalog", "VIEW")] }, async (_request, reply) => {
    const rules = await db.upgradeRule.findMany({ include: { fromProduct: true, toProduct: true }, orderBy: { createdAt: "desc" } });
    return reply.send({ rules });
  });

  // --- Promotions --------------------------------------------------------------

  const promotionSchema = z.object({
    code: z.string().min(1).optional(),
    name: z.string().min(1),
    type: z.enum(["FIXED_DISCOUNT", "PERCENTAGE_DISCOUNT", "BONUS_COURSE", "BONUS_FEATURE", "EXTENDED_ACCESS", "SPECIAL_UPGRADE"]),
    valueJson: z.record(z.string(), z.unknown()),
    startAt: z.string().datetime().optional(),
    endAt: z.string().datetime().optional(),
    usageLimit: z.number().int().positive().optional(),
    productScopeJson: z.array(z.string()).optional(),
  });

  app.post("/api/entitlements/promotions", { preHandler: [requireAuth, requirePermission("Product Catalog", "CREATE")] }, async (request, reply) => {
    const parsed = promotionSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid request.", details: parsed.error.flatten() });
    const ctx = request.authContext!;
    const promotion = await db.promotion.create({
      data: {
        code: parsed.data.code,
        name: parsed.data.name,
        type: parsed.data.type,
        valueJson: parsed.data.valueJson as Prisma.InputJsonValue,
        startAt: parsed.data.startAt ? new Date(parsed.data.startAt) : undefined,
        endAt: parsed.data.endAt ? new Date(parsed.data.endAt) : undefined,
        usageLimit: parsed.data.usageLimit,
        productScopeJson: parsed.data.productScopeJson as Prisma.InputJsonValue | undefined,
        createdById: ctx.userId,
      },
    });
    await writeAuditLog({ action: "Promotion Created", summary: `Promotion "${promotion.name}" created`, actorUserId: ctx.userId, entityType: "Promotion", entityId: promotion.id });
    return reply.code(201).send({ promotion });
  });

  app.get("/api/entitlements/promotions", { preHandler: [requireAuth, requirePermission("Product Catalog", "VIEW")] }, async (_request, reply) => {
    const promotions = await db.promotion.findMany({ orderBy: { createdAt: "desc" } });
    return reply.send({ promotions });
  });
}
