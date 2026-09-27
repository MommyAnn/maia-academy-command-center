// Server-side price computation — the ONLY place an Order's price is ever
// calculated (Production Phase 17, spec sections 11-12, 50-55). The
// frontend never supplies a price; every checkout path (direct purchase,
// CheckoutSession, upgrade) must route through this function so a
// tampered client value can never reach an Order. Extends, never
// duplicates, Phase 16's Promotion model.

import { db } from "../db.js";
import type { CommerceProduct, Promotion } from "@prisma/client";

export interface PriceComputation {
  subtotal: number;
  discountAmount: number;
  creditsApplied: number;
  total: number;
  currency: string;
  promotionId?: string;
}

export type PriceResult = { ok: true; price: PriceComputation; product: CommerceProduct; promotion: Promotion | null } | { ok: false; error: string };

// Store credits are not a built system in this codebase yet (no credit
// ledger exists anywhere) — creditsApplied is always 0 today. Kept as a
// real field (not removed) so the Order snapshot and this function's
// shape are already correct the day a real credit system is added,
// rather than requiring another schema migration then.
const CREDITS_APPLIED_TODAY = 0;

export async function computeOrderPrice(input: { productId: string; studentId: string; promotionCode?: string; quantity?: number }): Promise<PriceResult> {
  const quantity = input.quantity && input.quantity > 0 ? input.quantity : 1;
  const product = await db.commerceProduct.findUnique({ where: { id: input.productId } });
  if (!product || product.status !== "ACTIVE") return { ok: false, error: "Product not found or not currently available." };

  const basePrice = Number(product.basePrice ?? 0);
  const subtotal = basePrice * quantity;

  let discountAmount = 0;
  let promotion: Promotion | null = null;

  if (input.promotionCode) {
    promotion = await db.promotion.findUnique({ where: { code: input.promotionCode } });
    const now = new Date();
    if (!promotion) return { ok: false, error: "Invalid promotion code." };
    if (promotion.startAt && promotion.startAt > now) return { ok: false, error: "This promotion is not active yet." };
    if (promotion.endAt && promotion.endAt < now) return { ok: false, error: "This promotion has expired." };
    // Real tracked capacity — never a fabricated "slots remaining" (spec 72).
    if (promotion.usageLimit != null && promotion.redeemedCount >= promotion.usageLimit) return { ok: false, error: "This promotion has reached its redemption limit." };
    const scope = promotion.productScopeJson as string[] | null;
    if (scope && !scope.includes(product.id)) return { ok: false, error: "This promotion does not apply to this product." };
    if (promotion.minimumPurchaseAmount != null && subtotal < Number(promotion.minimumPurchaseAmount)) {
      return { ok: false, error: `This promotion requires a minimum purchase of ${promotion.minimumPurchaseAmount}.` };
    }
    if (promotion.perCustomerLimit != null) {
      const usedByThisStudent = await db.purchase.count({
        where: { studentId: input.studentId, promotionId: promotion.id, status: { notIn: ["CANCELLED", "FAILED"] } },
      });
      if (usedByThisStudent >= promotion.perCustomerLimit) return { ok: false, error: "You have already used this promotion the maximum number of times allowed." };
    }
    const value = promotion.valueJson as { amount?: number; percent?: number };
    discountAmount = value.percent != null ? subtotal * (value.percent / 100) : value.amount != null ? value.amount : 0;
  }

  // The schema stores exactly one promotionId per Order (spec section 53:
  // "do not accidentally stack promotions") — that structural limit is
  // itself the stacking guard, not an ad hoc runtime check that could
  // drift from the data model. `Promotion.stackable` exists for forward
  // compatibility with a future multi-promotion checkout, and is not yet
  // load-bearing since there is nothing to stack against today.

  const total = Math.max(0, subtotal - discountAmount - CREDITS_APPLIED_TODAY);
  return {
    ok: true,
    product,
    promotion,
    price: { subtotal, discountAmount, creditsApplied: CREDITS_APPLIED_TODAY, total, currency: product.currency, promotionId: promotion?.id },
  };
}

// Product Name / Type / configured price / expected entitlements at Order
// creation time (spec section 4) — read back later even if the live
// CommerceProduct is edited or archived.
export async function buildProductSnapshot(product: CommerceProduct) {
  const { expandProductFeatures } = await import("../entitlements/grant.js");
  const entitlementsExpected = await expandProductFeatures(product.id);
  return {
    name: product.name,
    type: product.type,
    configuredPriceAtSnapshotTime: product.basePrice != null ? Number(product.basePrice) : null,
    entitlementsExpected,
  };
}
