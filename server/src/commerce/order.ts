// Order creation (Production Phase 17) — the ONE place a real Purchase/
// Order row is inserted from a computed price, used by every checkout
// path (direct purchase, CheckoutSession consumption, upgrade) so there
// is exactly one order-creation code path, never several that could drift.

import { db } from "../db.js";
import type { CommerceProduct, Prisma } from "@prisma/client";
import { generatePurchaseDisplayId } from "../modules/sequence.js";
import { writeAuditLog } from "../audit/log.js";
import type { PriceComputation } from "./pricing.js";
import { buildProductSnapshot } from "./pricing.js";

export interface CreateOrderInput {
  studentId: string;
  businessId?: string;
  product: CommerceProduct;
  price: PriceComputation;
  quantity?: number;
  checkoutMode: string;
  // CHECKOUT | ADMIN_ASSISTED | UPGRADE_FLOW | AFFILIATE_LINK (spec section 3)
  source: string;
  checkoutSessionId?: string;
  affiliateId?: string;
  affiliateAttributionJson?: Record<string, unknown>;
  createdById: string;
}

export async function createOrder(input: CreateOrderInput) {
  const snapshot = await buildProductSnapshot(input.product);
  const purchase = await db.purchase.create({
    data: {
      purchaseDisplayId: await generatePurchaseDisplayId(),
      studentId: input.studentId,
      businessId: input.businessId,
      productId: input.product.id,
      quantity: input.quantity ?? 1,
      subtotal: input.price.subtotal,
      creditsApplied: input.price.creditsApplied,
      productSnapshotJson: snapshot as unknown as Prisma.InputJsonValue,
      priceAtPurchase: input.price.total,
      currency: input.price.currency,
      promotionId: input.price.promotionId,
      discountAmount: input.price.discountAmount,
      source: input.source,
      affiliateId: input.affiliateId,
      affiliateAttributionJson: input.affiliateAttributionJson as Prisma.InputJsonValue | undefined,
      checkoutSessionId: input.checkoutSessionId,
      checkoutMode: input.checkoutMode,
      fulfillmentStatus: "NOT_READY",
      createdById: input.createdById,
    },
  });
  if (input.price.promotionId) {
    await db.promotion.update({ where: { id: input.price.promotionId }, data: { redeemedCount: { increment: 1 } } });
    await writeAuditLog({ action: "Coupon Redeemed", summary: `Promotion applied to Order ${purchase.purchaseDisplayId}`, actorUserId: input.createdById, entityType: "Purchase", entityId: purchase.id });
  }
  await writeAuditLog({ action: "Purchase Created", summary: `Order ${purchase.purchaseDisplayId} for "${input.product.name}" created (₱${input.price.total}, source: ${input.source})`, actorUserId: input.createdById, entityType: "Purchase", entityId: purchase.id });
  return purchase;
}

// Fulfillment status is deliberately separate from payment status (spec
// sections 6-7) — this is the single place that transitions it, so the
// state machine can't drift between routes.
const FULFILLMENT_TRANSITIONS: Record<string, string[]> = {
  // NOT_READY -> READY directly is valid for a provider-verified webhook
  // payment (spec section 34) — a real gateway's own confirmation
  // supersedes the manual staff-verification step MANUAL payments need.
  NOT_READY: ["PENDING_VERIFICATION", "READY", "SUSPENDED"],
  PENDING_VERIFICATION: ["READY", "NOT_READY", "SUSPENDED"],
  READY: ["FULFILLED", "PARTIALLY_FULFILLED", "SUSPENDED"],
  PARTIALLY_FULFILLED: ["FULFILLED", "SUSPENDED"],
  FULFILLED: ["SUSPENDED", "REVOKED"],
  SUSPENDED: ["READY", "REVOKED", "NOT_READY"],
  REVOKED: [],
};

// actorUserId is null for a system/webhook-driven transition (spec
// section 34: a provider-confirmed event, never a human) — ActivityLog's
// actorUserId is a real FK to User, so a placeholder string like
// "system-webhook" would violate it; null is the honest, safe value.
export async function setFulfillmentStatus(purchaseId: string, next: string, actorUserId: string | null) {
  const purchase = await db.purchase.findUniqueOrThrow({ where: { id: purchaseId } });
  const allowed = FULFILLMENT_TRANSITIONS[purchase.fulfillmentStatus] ?? [];
  if (purchase.fulfillmentStatus !== next && !allowed.includes(next)) {
    throw Object.assign(new Error(`Cannot move fulfillment status from ${purchase.fulfillmentStatus} to ${next}.`), { httpStatus: 409 });
  }
  const updated = await db.purchase.update({ where: { id: purchaseId }, data: { fulfillmentStatus: next } });
  await writeAuditLog({ action: "Order Fulfillment Status Changed", summary: `Order ${purchase.purchaseDisplayId} fulfillment ${purchase.fulfillmentStatus} -> ${next}${actorUserId ? "" : " (system/webhook-driven)"}`, actorUserId, entityType: "Purchase", entityId: purchaseId });
  return updated;
}
