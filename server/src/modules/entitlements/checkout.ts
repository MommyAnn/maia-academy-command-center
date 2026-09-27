// Checkout abstraction + payment-verified access activation + Subscription
// lifecycle (Production Phase 16, spec sections 44-59). No real payment
// gateway is connected in this environment — CONNECTED_GATEWAY is
// rejected honestly (spec section 46), and Subscription.provider stays
// "MANUAL" (staff-tracked renewal) until a real one is wired (spec 54).
// Purchase truth is its OWN new ledger (see schema.prisma's Purchase
// model comment) — Academy tuition truth stays exclusively in
// PaymentTransaction, never touched here.

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../../db.js";
import { requireAuth, requireStudentSelfOrPermission, requirePermission } from "../../rbac/middleware.js";
import { writeAuditLog } from "../../audit/log.js";
import { generatePurchaseDisplayId, generateSubscriptionDisplayId } from "../sequence.js";
import { grantProductEntitlements } from "../../entitlements/grant.js";

const REAL_CHECKOUT_MODES = ["MANUAL_PAYMENT", "ADMIN_ASSISTED"] as const;
const ARCHITECTURE_ONLY_CHECKOUT_MODES = ["PAYMENT_LINK", "CONNECTED_GATEWAY", "INVOICE"] as const;

export async function checkoutRoutes(app: FastifyInstance) {
  app.get("/api/entitlements/billing-status", { preHandler: [requireAuth] }, async (_request, reply) => {
    return reply.send({
      provider: "MANUAL",
      connected: false,
      realCheckoutModes: REAL_CHECKOUT_MODES,
      architectureOnlyModes: ARCHITECTURE_ONLY_CHECKOUT_MODES,
      message: "No real payment gateway or recurring-billing provider is connected in this environment. Manual payment (staff-verified proof) and admin-assisted checkout are the only real modes; recurring billing is architecture-ready, never claimed as live (spec section 6).",
    });
  });

  const createPurchaseSchema = z.object({ businessId: z.string().optional(), productId: z.string().min(1), promotionCode: z.string().optional(), checkoutMode: z.enum([...REAL_CHECKOUT_MODES, ...ARCHITECTURE_ONLY_CHECKOUT_MODES]).default("MANUAL_PAYMENT") });

  app.post("/api/students/:studentId/purchases", { preHandler: [requireAuth, requireStudentSelfOrPermission("Product Catalog", "CREATE")] }, async (request, reply) => {
    const { studentId } = request.params as { studentId: string };
    const parsed = createPurchaseSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid request.", details: parsed.error.flatten() });

    if ((ARCHITECTURE_ONLY_CHECKOUT_MODES as readonly string[]).includes(parsed.data.checkoutMode)) {
      return reply.code(422).send({ error: `Checkout mode ${parsed.data.checkoutMode} is architecture-ready but not connected to a real provider yet. Use MANUAL_PAYMENT or ADMIN_ASSISTED.` });
    }

    const product = await db.commerceProduct.findUnique({ where: { id: parsed.data.productId } });
    if (!product || product.status !== "ACTIVE") return reply.code(404).send({ error: "Product not found or not currently available." });

    let discountAmount: number | undefined;
    let promotionId: string | undefined;
    if (parsed.data.promotionCode) {
      const promo = await db.promotion.findUnique({ where: { code: parsed.data.promotionCode } });
      const now = new Date();
      if (!promo) return reply.code(400).send({ error: "Invalid promotion code." });
      if (promo.startAt && promo.startAt > now) return reply.code(400).send({ error: "This promotion is not active yet." });
      if (promo.endAt && promo.endAt < now) return reply.code(400).send({ error: "This promotion has expired." });
      // Real tracked capacity — never a fabricated "slots remaining" (spec 72).
      if (promo.usageLimit != null && promo.redeemedCount >= promo.usageLimit) return reply.code(400).send({ error: "This promotion has reached its redemption limit." });
      const scope = promo.productScopeJson as string[] | null;
      if (scope && !scope.includes(product.id)) return reply.code(400).send({ error: "This promotion does not apply to this product." });
      const value = promo.valueJson as { amount?: number; percent?: number };
      const basePrice = Number(product.basePrice ?? 0);
      discountAmount = value.percent != null ? basePrice * (value.percent / 100) : value.amount != null ? value.amount : 0;
      promotionId = promo.id;
    }

    const ctx = request.authContext!;
    const priceAtPurchase = Math.max(0, Number(product.basePrice ?? 0) - (discountAmount ?? 0));
    const purchase = await db.purchase.create({
      data: {
        purchaseDisplayId: await generatePurchaseDisplayId(),
        studentId,
        productId: product.id,
        priceAtPurchase,
        currency: product.currency,
        promotionId,
        discountAmount,
        checkoutMode: parsed.data.checkoutMode,
        createdById: ctx.userId,
      },
    });
    if (promotionId) await db.promotion.update({ where: { id: promotionId }, data: { redeemedCount: { increment: 1 } } });
    await writeAuditLog({ action: "Purchase Created", summary: `Purchase ${purchase.purchaseDisplayId} for "${product.name}" created (₱${priceAtPurchase})`, actorUserId: ctx.userId, entityType: "Purchase", entityId: purchase.id });
    return reply.code(201).send({ purchase });
  });

  app.get("/api/students/:studentId/purchases", { preHandler: [requireAuth, requireStudentSelfOrPermission("Product Catalog", "VIEW")] }, async (request, reply) => {
    const { studentId } = request.params as { studentId: string };
    const purchases = await db.purchase.findMany({ where: { studentId }, include: { product: true }, orderBy: { createdAt: "desc" } });
    return reply.send({ purchases });
  });

  const submitPaymentSchema = z.object({ paymentMethod: z.string().min(1), referenceNumber: z.string().optional(), proofDocumentId: z.string().optional() });

  // Failed/pending checkout never grants access (spec sections 115-116) —
  // this only ever moves PENDING_PAYMENT -> AWAITING_VERIFICATION.
  app.post("/api/purchases/:id/submit-payment", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const purchase = await db.purchase.findUnique({ where: { id } });
    if (!purchase) return reply.code(404).send({ error: "Purchase not found." });
    const ctx = request.authContext!;
    if (ctx.kind === "student" && ctx.studentId !== purchase.studentId) return reply.code(403).send({ error: "Forbidden." });
    if (purchase.status !== "PENDING_PAYMENT") return reply.code(409).send({ error: `Cannot submit payment for a purchase with status ${purchase.status}.` });

    const parsed = submitPaymentSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid request." });
    const updated = await db.purchase.update({ where: { id }, data: { ...parsed.data, status: "AWAITING_VERIFICATION" } });
    await writeAuditLog({ action: "Purchase Payment Submitted", summary: `Payment submitted for purchase ${purchase.purchaseDisplayId}`, actorUserId: ctx.userId, entityType: "Purchase", entityId: id });
    return reply.send({ purchase: updated });
  });

  app.post("/api/purchases/:id/verify", { preHandler: [requireAuth, requirePermission("Product Catalog", "VERIFY")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const purchase = await db.purchase.findUnique({ where: { id } });
    if (!purchase) return reply.code(404).send({ error: "Purchase not found." });
    if (purchase.status !== "AWAITING_VERIFICATION") return reply.code(409).send({ error: `Cannot verify a purchase with status ${purchase.status}.` });

    const ctx = request.authContext!;
    const updated = await db.purchase.update({ where: { id }, data: { status: "PAID", verifiedById: ctx.userId, verifiedAt: new Date() } });
    await writeAuditLog({ action: "Purchase Payment Verified", summary: `Purchase ${purchase.purchaseDisplayId} payment verified`, actorUserId: ctx.userId, entityType: "Purchase", entityId: id });
    return reply.send({ purchase: updated });
  });

  // Idempotent activation (spec section 51) — calling this twice on an
  // already-activated purchase is a safe no-op, never a duplicate grant.
  app.post("/api/purchases/:id/activate", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const purchase = await db.purchase.findUnique({ where: { id }, include: { product: true } });
    if (!purchase) return reply.code(404).send({ error: "Purchase not found." });
    const ctx = request.authContext!;
    if (ctx.kind === "student" && ctx.studentId !== purchase.studentId) return reply.code(403).send({ error: "Forbidden." });

    if (purchase.activatedAt) {
      const entitlements = await db.entitlement.findMany({ where: { studentId: purchase.studentId, sourceProductId: purchase.productId, sourceRecordId: purchase.id } });
      return reply.send({ purchase, entitlements, alreadyActivated: true });
    }
    if (purchase.status !== "PAID") return reply.code(409).send({ error: `Cannot activate a purchase with status ${purchase.status} — payment must be verified first.` });

    // Source label reflects what was actually purchased (spec section 11)
    // — never a single generic label for every product type.
    const purchaseSource = purchase.product.type === "COURSE" ? "COURSE_PURCHASE" : purchase.product.type === "BUILD_WITH_YOU" ? "BUILD_WITH_YOU" : "PACKAGE";
    const entitlements = await grantProductEntitlements({ studentId: purchase.studentId, businessId: undefined, product: purchase.product, source: purchaseSource, sourceRecordId: purchase.id, createdById: ctx.userId });
    const updated = await db.purchase.update({ where: { id }, data: { activatedAt: new Date() } });
    await writeAuditLog({ action: "Purchase Activated", summary: `Purchase ${purchase.purchaseDisplayId} activated — ${entitlements.length} entitlement(s) granted`, actorUserId: ctx.userId, entityType: "Purchase", entityId: id });
    return reply.send({ purchase: updated, entitlements, alreadyActivated: false });
  });

  const cancelSchema = z.object({ reason: z.string().min(1) });

  app.post("/api/purchases/:id/cancel", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const purchase = await db.purchase.findUnique({ where: { id } });
    if (!purchase) return reply.code(404).send({ error: "Purchase not found." });
    const ctx = request.authContext!;
    if (ctx.kind === "student" && ctx.studentId !== purchase.studentId) return reply.code(403).send({ error: "Forbidden." });
    if (!["PENDING_PAYMENT", "AWAITING_VERIFICATION"].includes(purchase.status)) return reply.code(409).send({ error: `Cannot cancel a purchase with status ${purchase.status}.` });

    const parsed = cancelSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "A reason is required." });
    const updated = await db.purchase.update({ where: { id }, data: { status: "CANCELLED", rejectedReason: parsed.data.reason } });
    await writeAuditLog({ action: "Purchase Cancelled", summary: `Purchase ${purchase.purchaseDisplayId} cancelled: ${parsed.data.reason}`, actorUserId: ctx.userId, entityType: "Purchase", entityId: id });
    return reply.send({ purchase: updated });
  });

  // --- Subscriptions (spec sections 52-59) — MANUAL provider only; a real
  // recurring-billing gateway would replace these staff actions with
  // provider-confirmed webhook events (never AI-determined, spec 54). ---

  const createSubscriptionSchema = z.object({ studentId: z.string().min(1), productId: z.string().min(1), currentPeriodEnd: z.string().datetime() });

  app.post("/api/admin/subscriptions", { preHandler: [requireAuth, requirePermission("Product Catalog", "CREATE")] }, async (request, reply) => {
    const parsed = createSubscriptionSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid request.", details: parsed.error.flatten() });
    const [student, product] = await Promise.all([db.student.findUnique({ where: { id: parsed.data.studentId } }), db.commerceProduct.findUnique({ where: { id: parsed.data.productId } })]);
    if (!student || !product) return reply.code(404).send({ error: "Student or product not found." });

    const ctx = request.authContext!;
    const subscription = await db.subscription.create({
      data: { subscriptionDisplayId: await generateSubscriptionDisplayId(), studentId: parsed.data.studentId, productId: parsed.data.productId, currentPeriodEnd: new Date(parsed.data.currentPeriodEnd), createdById: ctx.userId },
    });
    await grantProductEntitlements({ studentId: parsed.data.studentId, product, source: "SUBSCRIPTION", sourceRecordId: subscription.id, createdById: ctx.userId });
    await writeAuditLog({ action: "Subscription Created", summary: `Subscription ${subscription.subscriptionDisplayId} for "${product.name}" created`, actorUserId: ctx.userId, entityType: "Subscription", entityId: subscription.id });
    return reply.code(201).send({ subscription });
  });

  app.get("/api/students/:studentId/subscriptions", { preHandler: [requireAuth, requireStudentSelfOrPermission("Product Catalog", "VIEW")] }, async (request, reply) => {
    const { studentId } = request.params as { studentId: string };
    const subscriptions = await db.subscription.findMany({ where: { studentId }, include: { product: true }, orderBy: { createdAt: "desc" } });
    return reply.send({ subscriptions });
  });

  const renewSchema = z.object({ newPeriodEnd: z.string().datetime() });

  app.post("/api/admin/subscriptions/:id/renew", { preHandler: [requireAuth, requirePermission("Product Catalog", "EDIT")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const subscription = await db.subscription.findUnique({ where: { id } });
    if (!subscription) return reply.code(404).send({ error: "Subscription not found." });
    const parsed = renewSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid request." });

    const updated = await db.subscription.update({ where: { id }, data: { status: "ACTIVE", currentPeriodStart: subscription.currentPeriodEnd, currentPeriodEnd: new Date(parsed.data.newPeriodEnd), gracePeriodEndsAt: null } });
    await writeAuditLog({ action: "Subscription Renewed", summary: `Subscription ${subscription.subscriptionDisplayId} renewed to ${parsed.data.newPeriodEnd}`, actorUserId: request.authContext!.userId, entityType: "Subscription", entityId: id });
    return reply.send({ subscription: updated });
  });

  // Failed payment never immediately destroys data (spec sections 56-57) —
  // PAST_DUE + a configurable grace period, nothing deleted.
  app.post("/api/admin/subscriptions/:id/mark-past-due", { preHandler: [requireAuth, requirePermission("Product Catalog", "EDIT")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const subscription = await db.subscription.findUnique({ where: { id } });
    if (!subscription) return reply.code(404).send({ error: "Subscription not found." });
    const gracePeriodEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const updated = await db.subscription.update({ where: { id }, data: { status: "PAST_DUE", gracePeriodEndsAt } });
    await writeAuditLog({ action: "Subscription Past Due", summary: `Subscription ${subscription.subscriptionDisplayId} marked PAST_DUE — grace period until ${gracePeriodEndsAt.toISOString()}`, actorUserId: request.authContext!.userId, entityType: "Subscription", entityId: id });
    return reply.send({ subscription: updated });
  });

  const cancelSubscriptionSchema = z.object({ atPeriodEnd: z.boolean().default(true) });

  // Cancellation never deletes Business/Master Brain/Projects/Creative
  // Assets/historical data (spec section 59) — only the Subscription and
  // its granted Entitlement rows are affected.
  app.post("/api/admin/subscriptions/:id/cancel", { preHandler: [requireAuth, requirePermission("Product Catalog", "EDIT")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const subscription = await db.subscription.findUnique({ where: { id } });
    if (!subscription) return reply.code(404).send({ error: "Subscription not found." });
    const parsed = cancelSubscriptionSchema.safeParse(request.body ?? {});
    const ctx = request.authContext!;

    if (parsed.data?.atPeriodEnd) {
      const updated = await db.subscription.update({ where: { id }, data: { cancelAtPeriodEnd: true } });
      await writeAuditLog({ action: "Subscription Cancelled", summary: `Subscription ${subscription.subscriptionDisplayId} set to cancel at period end`, actorUserId: ctx.userId, entityType: "Subscription", entityId: id });
      return reply.send({ subscription: updated });
    }

    const updated = await db.subscription.update({ where: { id }, data: { status: "CANCELLED", cancelAtPeriodEnd: true } });
    const relatedEntitlements = await db.entitlement.findMany({ where: { studentId: subscription.studentId, sourceRecordId: id, status: "ACTIVE" } });
    for (const e of relatedEntitlements) await db.entitlement.update({ where: { id: e.id }, data: { status: "REVOKED" } });
    await writeAuditLog({ action: "Subscription Cancelled", summary: `Subscription ${subscription.subscriptionDisplayId} cancelled immediately`, actorUserId: ctx.userId, entityType: "Subscription", entityId: id });
    return reply.send({ subscription: updated });
  });
}
