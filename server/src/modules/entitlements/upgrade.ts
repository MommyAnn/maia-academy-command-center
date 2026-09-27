// Upgrade Engine + safe downgrade + Package History (Production Phase 16,
// spec sections 61-68). Upgrading reuses the SAME Purchase/checkout
// pipeline as a normal purchase (checkout.ts) — this module's job is only
// to price the upgrade correctly via the configured UpgradeRule, never
// assuming price = newPrice - oldPrice unless the rule explicitly says so
// (spec section 64).

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../../db.js";
import { requireAuth, requireStudentSelfOrPermission } from "../../rbac/middleware.js";
import { writeAuditLog } from "../../audit/log.js";
import { expandProductFeatures } from "../../entitlements/grant.js";
import { createOrder } from "../../commerce/order.js";

type CommerceProductRow = Awaited<ReturnType<typeof db.commerceProduct.findUniqueOrThrow>>;
type UpgradeRuleRow = Awaited<ReturnType<typeof db.upgradeRule.findUniqueOrThrow>>;

interface PriceComputation {
  price: number;
  note: string;
}

function computeUpgradePrice(fromProduct: CommerceProductRow | null, toProduct: CommerceProductRow, rule: UpgradeRuleRow | null): PriceComputation {
  if (!rule) {
    return { price: Number(toProduct.basePrice ?? 0), note: "No upgrade rule configured for this pair — full price of the new product applies (spec section 64: never assumed as a price difference)." };
  }
  const priceRule = rule.upgradePriceRuleJson as { mode: string; amount?: number; note?: string };
  let price: number;
  if (priceRule.mode === "FIXED") price = priceRule.amount ?? 0;
  else if (priceRule.mode === "DIFFERENCE") price = Math.max(0, Number(toProduct.basePrice ?? 0) - Number(fromProduct?.basePrice ?? 0));
  else price = priceRule.amount ?? Number(toProduct.basePrice ?? 0); // CUSTOM

  const creditRule = rule.creditRuleJson as { mode: string; amount?: number } | null;
  if (creditRule) {
    if (creditRule.mode === "FIXED_CREDIT") price -= creditRule.amount ?? 0;
    else if (creditRule.mode === "FULL_ELIGIBLE_CREDIT") price -= Number(fromProduct?.basePrice ?? 0);
    else if (creditRule.mode === "PERCENTAGE") price -= price * ((creditRule.amount ?? 0) / 100);
    else if (creditRule.mode === "CUSTOM") price -= creditRule.amount ?? 0;
  }
  return { price: Math.max(0, price), note: priceRule.note ?? `Priced via configured upgrade rule (${priceRule.mode}).` };
}

export async function upgradeRoutes(app: FastifyInstance) {
  const previewQuerySchema = z.object({ fromProductId: z.string().optional(), toProductId: z.string().min(1) });

  app.get("/api/students/:studentId/upgrade-preview", { preHandler: [requireAuth, requireStudentSelfOrPermission("Product Catalog", "VIEW")] }, async (request, reply) => {
    const parsed = previewQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid request." });

    const toProduct = await db.commerceProduct.findUnique({ where: { id: parsed.data.toProductId } });
    if (!toProduct) return reply.code(404).send({ error: "Target product not found." });
    const fromProduct = parsed.data.fromProductId ? await db.commerceProduct.findUnique({ where: { id: parsed.data.fromProductId } }) : null;

    const rule = fromProduct ? await db.upgradeRule.findUnique({ where: { fromProductId_toProductId: { fromProductId: fromProduct.id, toProductId: toProduct.id } } }) : null;
    const [currentFeatures, newFeatures] = await Promise.all([fromProduct ? expandProductFeatures(fromProduct.id) : Promise.resolve([]), expandProductFeatures(toProduct.id)]);
    const currentKeys = new Set(currentFeatures.map((f) => f.featureKey));
    const addedFeatures = newFeatures.filter((f) => !currentKeys.has(f.featureKey));
    const retainedFeatures = newFeatures.filter((f) => currentKeys.has(f.featureKey));
    const pricing = computeUpgradePrice(fromProduct, toProduct, rule);

    return reply.send({ currentProduct: fromProduct, newProduct: toProduct, currentFeatures, newFeatures, addedFeatures, retainedFeatures, upgradePrice: pricing.price, priceNote: pricing.note });
  });

  const executeSchema = z.object({ fromProductId: z.string().optional(), toProductId: z.string().min(1) });

  // Creates a real Purchase priced via the upgrade rule — the SAME
  // checkout pipeline (submit-payment/verify/activate) as any other
  // purchase then grants the actual entitlements once paid.
  app.post("/api/students/:studentId/upgrade", { preHandler: [requireAuth, requireStudentSelfOrPermission("Product Catalog", "CREATE")] }, async (request, reply) => {
    const { studentId } = request.params as { studentId: string };
    const parsed = executeSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid request." });

    const toProduct = await db.commerceProduct.findUnique({ where: { id: parsed.data.toProductId } });
    if (!toProduct) return reply.code(404).send({ error: "Target product not found." });
    const fromProduct = parsed.data.fromProductId ? await db.commerceProduct.findUnique({ where: { id: parsed.data.fromProductId } }) : null;
    const rule = fromProduct ? await db.upgradeRule.findUnique({ where: { fromProductId_toProductId: { fromProductId: fromProduct.id, toProductId: toProduct.id } } }) : null;
    const pricing = computeUpgradePrice(fromProduct, toProduct, rule);

    const ctx = request.authContext!;
    // Routed through the same createOrder() every other checkout path
    // uses (spec section 44) — source: "UPGRADE_FLOW" is the only thing
    // that distinguishes this Order's origin from a fresh purchase.
    const purchase = await createOrder({
      studentId,
      product: toProduct,
      price: { subtotal: Number(toProduct.basePrice ?? 0), discountAmount: Math.max(0, Number(toProduct.basePrice ?? 0) - pricing.price), creditsApplied: 0, total: pricing.price, currency: toProduct.currency },
      checkoutMode: "MANUAL_PAYMENT",
      source: "UPGRADE_FLOW",
      createdById: ctx.userId,
    });
    await writeAuditLog({ action: "Upgrade Completed", summary: `Upgrade purchase ${purchase.purchaseDisplayId} created for "${toProduct.name}" at ₱${pricing.price} (${pricing.note})`, actorUserId: ctx.userId, entityType: "Purchase", entityId: purchase.id });
    return reply.code(201).send({ purchase, priceNote: pricing.note });
  });

  // --- Downgrade (spec sections 60, 67) ---------------------------------------

  const downgradeQuerySchema = z.object({ toProductId: z.string().min(1) });

  app.get("/api/students/:studentId/downgrade-preview", { preHandler: [requireAuth, requireStudentSelfOrPermission("Product Catalog", "VIEW")] }, async (request, reply) => {
    const { studentId } = request.params as { studentId: string };
    const parsed = downgradeQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid request." });

    const toProduct = await db.commerceProduct.findUnique({ where: { id: parsed.data.toProductId } });
    if (!toProduct) return reply.code(404).send({ error: "Target product not found." });
    const newFeatures = await expandProductFeatures(toProduct.id);
    const newBusinessLimit = newFeatures.find((f) => f.featureKey === "MULTIPLE_BUSINESSES")?.usageLimit ?? null;
    const currentBusinessCount = await db.business.count({ where: { studentId } });

    const warnings: string[] = [];
    if (newBusinessLimit != null && currentBusinessCount > newBusinessLimit) {
      warnings.push(`You currently have ${currentBusinessCount} business(es); the new plan allows ${newBusinessLimit}. Nothing will be deleted automatically — you'll need to choose which business(es) stay active.`);
    }

    return reply.send({ newProduct: toProduct, newFeatures, currentBusinessCount, newBusinessLimit, warnings, safeToApply: warnings.length === 0 });
  });

  const downgradeExecuteSchema = z.object({ fromProductId: z.string().min(1), toProductId: z.string().min(1), acknowledgeDataRetained: z.boolean() });

  app.post("/api/students/:studentId/downgrade", { preHandler: [requireAuth, requireStudentSelfOrPermission("Product Catalog", "EDIT")] }, async (request, reply) => {
    const { studentId } = request.params as { studentId: string };
    const parsed = downgradeExecuteSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid request." });
    if (!parsed.data.acknowledgeDataRetained) return reply.code(400).send({ error: "Must explicitly acknowledge that no Business/Master Brain/data is deleted by this downgrade." });

    const [fromProduct, toProduct] = await Promise.all([db.commerceProduct.findUnique({ where: { id: parsed.data.fromProductId } }), db.commerceProduct.findUnique({ where: { id: parsed.data.toProductId } })]);
    if (!fromProduct || !toProduct) return reply.code(404).send({ error: "Product not found." });

    const ctx = request.authContext!;
    // Revoke the OLD product's grants first — otherwise the resolver's
    // "most generous active row wins" rule would keep the higher limit
    // alive and the downgrade would have no real effect.
    const oldEntitlements = await db.entitlement.findMany({ where: { studentId, sourceProductId: fromProduct.id, status: "ACTIVE" } });
    for (const e of oldEntitlements) await db.entitlement.update({ where: { id: e.id }, data: { status: "REVOKED" } });

    const { grantProductEntitlements } = await import("../../entitlements/grant.js");
    const newEntitlements = await grantProductEntitlements({ studentId, product: toProduct, source: "PACKAGE", createdById: ctx.userId });
    await writeAuditLog({ action: "Downgrade Completed", summary: `Downgraded from "${fromProduct.name}" to "${toProduct.name}" — no Business/data deleted`, actorUserId: ctx.userId, entityType: "Entitlement", entityId: newEntitlements[0]?.id });
    return reply.send({ revokedCount: oldEntitlements.length, newEntitlements });
  });

  // --- Package History (spec section 68) --------------------------------------

  app.get("/api/students/:studentId/package-history", { preHandler: [requireAuth, requireStudentSelfOrPermission("Product Catalog", "VIEW")] }, async (request, reply) => {
    const { studentId } = request.params as { studentId: string };
    const [purchases, subscriptions, entitlements] = await Promise.all([
      db.purchase.findMany({ where: { studentId }, select: { id: true } }),
      db.subscription.findMany({ where: { studentId }, select: { id: true } }),
      db.entitlement.findMany({ where: { studentId }, select: { id: true } }),
    ]);
    const entityIds = [...purchases, ...subscriptions, ...entitlements].map((r) => r.id);
    if (entityIds.length === 0) return reply.send({ events: [] });
    const events = await db.activityLog.findMany({ where: { entityId: { in: entityIds } }, orderBy: { occurredAt: "asc" } });
    return reply.send({ events });
  });
}
