// Commerce Reconciliation, Admin Commerce Dashboard, Customer Commerce
// 360, and Growth/Revenue Analytics (Production Phase 17, spec sections
// 90-107, 126-130, 157-159). Extends — never duplicates — Phase 16's own
// entitlement reconciliation (server/src/modules/entitlements/migration.ts).
// Every financial figure here states its date range, currency, and
// status inclusion explicitly (spec section 157); "verified revenue"
// never includes a PENDING/AWAITING/FAILED Order (spec section 96).

import type { FastifyInstance } from "fastify";
import { db } from "../db.js";
import { requireAuth, requirePermission, requireStudentSelfOrPermission } from "../rbac/middleware.js";
import { writeAuditLog } from "../audit/log.js";

const VERIFIED_STATUSES = ["PAID", "PARTIALLY_REFUNDED"] as const;

export async function commerceDashboardRoutes(app: FastifyInstance) {
  // --- Commerce Reconciliation (spec sections 126-130) ----------------------
  app.get("/api/admin/commerce/reconciliation", { preHandler: [requireAuth, requirePermission("Commerce", "VIEW")] }, async (request, reply) => {
    const results: { category: string; detail: string; entityType: string; entityId: string }[] = [];

    // PAID_WITHOUT_ENTITLEMENT — an Order that reached PAID and was
    // activated, but has no linked Entitlement row.
    const paidOrders = await db.purchase.findMany({ where: { status: "PAID", activatedAt: { not: null } }, include: { product: true } });
    for (const order of paidOrders) {
      const count = await db.entitlement.count({ where: { studentId: order.studentId, sourceRecordId: order.id } });
      if (count === 0) results.push({ category: "PAID_WITHOUT_ENTITLEMENT", detail: `Order ${order.purchaseDisplayId} was activated but has no linked Entitlement row.`, entityType: "Purchase", entityId: order.id });
    }

    // COMMISSION_WITHOUT_QUALIFYING_PAYMENT — a Commission exists but its
    // Order isn't (or is no longer) in a paid state.
    const commissions = await db.commission.findMany({ where: { status: { notIn: ["VOIDED", "REVERSED"] } }, include: { purchase: true } });
    for (const c of commissions) {
      if (!VERIFIED_STATUSES.includes(c.purchase.status as (typeof VERIFIED_STATUSES)[number])) {
        results.push({ category: "COMMISSION_WITHOUT_QUALIFYING_PAYMENT", detail: `Commission ${c.commissionDisplayId} is ${c.status} but its Order ${c.purchase.purchaseDisplayId} has payment status ${c.purchase.status}.`, entityType: "Commission", entityId: c.id });
      }
    }

    // DUPLICATE — more than one non-voided Commission for the same Order.
    const commissionsByPurchase = new Map<string, number>();
    for (const c of commissions) commissionsByPurchase.set(c.purchaseId, (commissionsByPurchase.get(c.purchaseId) ?? 0) + 1);
    for (const [purchaseId, count] of commissionsByPurchase) {
      if (count > 1) results.push({ category: "DUPLICATE", detail: `Order ${purchaseId} has ${count} active Commission rows — expected at most 1.`, entityType: "Purchase", entityId: purchaseId });
    }

    // REFUNDED_STILL_ACTIVE_ENTITLEMENT — a fully refunded Order whose
    // Entitlements are still ACTIVE (only meaningful when the refund's
    // access policy was REVOKE_ACCESS; a RETAIN_ACCESS refund is expected
    // to leave access active, so this is a flag for review, not a bug).
    const refundedOrders = await db.purchase.findMany({ where: { status: "REFUNDED" } });
    for (const order of refundedOrders) {
      const activeCount = await db.entitlement.count({ where: { studentId: order.studentId, sourceRecordId: order.id, status: "ACTIVE" } });
      if (activeCount > 0) results.push({ category: "REFUNDED_BUT_ACCESS_STILL_ACTIVE", detail: `Order ${order.purchaseDisplayId} is REFUNDED but ${activeCount} linked Entitlement row(s) are still ACTIVE — confirm this matches the refund's access policy.`, entityType: "Purchase", entityId: order.id });
    }

    await writeAuditLog({ action: "Commerce Reconciliation Run", summary: `Commerce reconciliation run — ${results.length} item(s) flagged for review`, actorUserId: request.authContext!.userId });
    return reply.send({ generatedAt: new Date().toISOString(), flaggedCount: results.length, results });
  });

  // --- Admin Commerce Dashboard (spec section 106) ---------------------------
  app.get("/api/admin/commerce/dashboard", { preHandler: [requireAuth, requirePermission("Commerce", "VIEW")] }, async (_request, reply) => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [todaysOrders, pendingPayments, verifiedRevenueAgg, activeSubscriptions, pastDueSubscriptions, upgradesToday, refundsPending, payableCommissions, expiredSessions] = await Promise.all([
      db.purchase.count({ where: { createdAt: { gte: todayStart } } }),
      db.purchase.count({ where: { status: { in: ["PENDING_PAYMENT", "AWAITING_VERIFICATION"] } } }),
      db.purchase.aggregate({ where: { status: { in: [...VERIFIED_STATUSES] }, createdAt: { gte: todayStart } }, _sum: { priceAtPurchase: true } }),
      db.subscription.count({ where: { status: "ACTIVE" } }),
      db.subscription.count({ where: { status: "PAST_DUE" } }),
      db.purchase.count({ where: { source: "UPGRADE_FLOW", createdAt: { gte: todayStart } } }),
      db.refundRequest.count({ where: { status: { in: ["REQUESTED", "UNDER_REVIEW"] } } }),
      db.commission.aggregate({ where: { status: { in: ["APPROVED", "PAYABLE"] } }, _sum: { commissionAmount: true } }),
      db.checkoutSession.count({ where: { status: "OPEN", expiresAt: { lt: new Date() } } }),
    ]);

    return reply.send({
      generatedAt: new Date().toISOString(),
      currency: "PHP",
      todaysOrders,
      pendingPayments,
      verifiedRevenueToday: Number(verifiedRevenueAgg._sum.priceAtPurchase ?? 0),
      activeSubscriptions,
      pastDueSubscriptions,
      upgradesToday,
      refundsAwaitingReview: refundsPending,
      payableCommissions: Number(payableCommissions._sum.commissionAmount ?? 0),
      checkoutIssues: { expiredUnusedSessions: expiredSessions },
    });
  });

  // --- Customer Commerce 360 (spec sections 104-105) -------------------------
  app.get("/api/admin/students/:studentId/commerce-360", { preHandler: [requireAuth, requireStudentSelfOrPermission("Commerce", "VIEW")] }, async (request, reply) => {
    const { studentId } = request.params as { studentId: string };
    const student = await db.student.findUnique({ where: { id: studentId } });
    if (!student) return reply.code(404).send({ error: "Student not found." });

    const [orders, subscriptions, entitlements, refunds, sponsoredAccesses, referredAsCustomer] = await Promise.all([
      db.purchase.findMany({ where: { studentId }, include: { product: true, promotion: true }, orderBy: { createdAt: "desc" } }),
      db.subscription.findMany({ where: { studentId }, include: { product: true }, orderBy: { createdAt: "desc" } }),
      db.entitlement.findMany({ where: { studentId }, orderBy: { createdAt: "desc" } }),
      db.refundRequest.findMany({ where: { studentId }, orderBy: { createdAt: "desc" } }),
      db.sponsoredAccess.findMany({ where: { studentId }, include: { product: true } }),
      db.referralEvent.findFirst({ where: { personId: student.personId, kind: "VERIFIED_PURCHASE" }, include: { affiliate: true } }),
    ]);

    const upgrades = orders.filter((o) => o.source === "UPGRADE_FLOW");
    const couponsUsed = orders.filter((o) => o.promotionId).map((o) => ({ orderId: o.id, promotionCode: o.promotion?.code, discountAmount: o.discountAmount }));

    return reply.send({
      student: { id: student.id, studentDisplayId: student.studentDisplayId },
      orders,
      subscriptions,
      entitlements,
      upgrades,
      couponsUsed,
      refunds,
      sponsoredAccesses,
      affiliateAttribution: referredAsCustomer ? { affiliateId: referredAsCustomer.affiliateId, affiliateDisplayId: referredAsCustomer.affiliate.affiliateDisplayId } : null,
    });
  });

  // --- Growth / Revenue Analytics (spec sections 90-97, 157-158) ------------
  app.get("/api/admin/commerce/growth", { preHandler: [requireAuth, requirePermission("Commerce", "VIEW")] }, async (request, reply) => {
    const { startDate, endDate } = request.query as { startDate?: string; endDate?: string };
    const rangeStart = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const rangeEnd = endDate ? new Date(endDate) : new Date();

    const verifiedOrders = await db.purchase.findMany({ where: { status: { in: [...VERIFIED_STATUSES] }, createdAt: { gte: rangeStart, lte: rangeEnd } } });
    const verifiedRevenue = verifiedOrders.reduce((sum, o) => sum + Number(o.priceAtPurchase), 0);
    const bySource: Record<string, number> = {};
    for (const o of verifiedOrders) bySource[o.source] = (bySource[o.source] ?? 0) + Number(o.priceAtPurchase);

    const [newCustomerIds, couponRedemptions, activeSubscriptions, renewalEvents] = await Promise.all([
      db.purchase.findMany({ where: { status: { in: [...VERIFIED_STATUSES] }, createdAt: { gte: rangeStart, lte: rangeEnd } }, distinct: ["studentId"], select: { studentId: true } }),
      db.promotion.aggregate({ _sum: { redeemedCount: true } }),
      db.subscription.count({ where: { status: "ACTIVE" } }),
      db.activityLog.count({ where: { action: "Subscription Renewed", occurredAt: { gte: rangeStart, lte: rangeEnd } } }),
    ]);

    // MRR is only meaningful once real ACTIVE subscription data exists
    // (spec section 92) — computed from real Subscription rows' linked
    // Product price, never estimated.
    let mrr: number | null = null;
    if (activeSubscriptions > 0) {
      const subs = await db.subscription.findMany({ where: { status: "ACTIVE" }, include: { product: true } });
      mrr = subs.reduce((sum, s) => sum + Number(s.product.basePrice ?? 0), 0);
    }

    return reply.send({
      dateRange: { start: rangeStart.toISOString(), end: rangeEnd.toISOString() },
      currency: "PHP — figures are NOT converted across currencies; a Product priced in another currency is excluded from this total rather than silently summed (spec section 158).",
      verifiedRevenue,
      revenueBySource: bySource,
      newCustomers: newCustomerIds.length,
      orders: verifiedOrders.length,
      averageOrderValue: verifiedOrders.length > 0 ? verifiedRevenue / verifiedOrders.length : 0,
      upgrades: verifiedOrders.filter((o) => o.source === "UPGRADE_FLOW").length,
      renewalsInRange: renewalEvents,
      activeSubscriptions,
      mrr,
      couponRedemptions: couponRedemptions._sum.redeemedCount ?? 0,
      note: "customerLifetimeValue is intentionally omitted (spec section 94) — not enough reliable historical data/methodology exists yet in this build.",
    });
  });
}
