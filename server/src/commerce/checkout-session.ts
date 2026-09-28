// M.A.I.A. Checkout Engine — secure server-side Checkout Session
// (Production Phase 17, spec sections 10-13). The price is computed and
// LOCKED into the session the moment it's created; consuming the session
// re-validates its state (not expired, not already consumed) and then
// creates the real Order from that locked snapshot — the client is never
// asked for, and never able to supply, its own price.

import type { FastifyInstance } from "fastify";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "../db.js";
import { requireAuth, requireStudentSelfOrPermission } from "../rbac/middleware.js";
import { writeAuditLog } from "../audit/log.js";
import { computeOrderPrice } from "./pricing.js";
import { createOrder } from "./order.js";
import { isCheckoutEnabled } from "../safety/control.js";

const SESSION_TTL_MINUTES = 30;

const createSessionSchema = z.object({
  productId: z.string().min(1),
  promotionCode: z.string().optional(),
  quantity: z.number().int().positive().max(50).optional(),
  affiliateReferralCode: z.string().optional(),
});

export async function checkoutSessionRoutes(app: FastifyInstance) {
  app.post("/api/students/:studentId/checkout-sessions", { preHandler: [requireAuth, requireStudentSelfOrPermission("Commerce", "CREATE")] }, async (request, reply) => {
    const { studentId } = request.params as { studentId: string };

    // Pre-Pilot Safety Hardening Task 1 — the global Commerce checkout
    // kill switch. Checked first, before anything else, so a DISABLED
    // state blocks a new CheckoutSession from ever being created — no
    // price is computed, no row is written. This gates ONLY this
    // self-service Commerce flow; it never touches the separate, older
    // Finance/Enrollment manual-payment path (Phase 2), so existing
    // financial history and manual Finance records are entirely
    // unaffected by this switch either way.
    if (!(await isCheckoutEnabled())) {
      return reply.code(503).send({ error: "Checkout is currently disabled by an administrator. No new checkout session can be created." });
    }

    const parsed = createSessionSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid request." });

    // Server-side price computation ONLY — nothing in this request body
    // can supply a price (spec sections 11-13). A tampered browser price
    // simply has no field to travel in.
    const priceResult = await computeOrderPrice({ productId: parsed.data.productId, studentId, promotionCode: parsed.data.promotionCode, quantity: parsed.data.quantity });
    if (!priceResult.ok) return reply.code(400).send({ error: priceResult.error });

    const sessionToken = randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + SESSION_TTL_MINUTES * 60 * 1000);
    const session = await db.checkoutSession.create({
      data: {
        sessionToken,
        studentId,
        productId: parsed.data.productId,
        quantity: parsed.data.quantity ?? 1,
        promotionCode: parsed.data.promotionCode,
        affiliateReferralCode: parsed.data.affiliateReferralCode,
        computedPriceJson: priceResult.price as unknown as Prisma.InputJsonValue,
        status: "OPEN",
        expiresAt,
      },
    });
    await writeAuditLog({ action: "Checkout Session Created", summary: `Checkout session for "${priceResult.product.name}" created (locked total ₱${priceResult.price.total})`, actorUserId: request.authContext!.userId, entityType: "CheckoutSession", entityId: session.id });
    return reply.code(201).send({ session: { id: session.id, sessionToken: session.sessionToken, expiresAt: session.expiresAt, price: priceResult.price, product: { id: priceResult.product.id, name: priceResult.product.name, type: priceResult.product.type } } });
  });

  app.get("/api/checkout-sessions/:token", { preHandler: [requireAuth] }, async (request, reply) => {
    const { token } = request.params as { token: string };
    const session = await db.checkoutSession.findUnique({ where: { sessionToken: token }, include: { product: true } });
    if (!session) return reply.code(404).send({ error: "Checkout session not found." });
    const ctx = request.authContext!;
    if (ctx.kind === "student" && ctx.studentId !== session.studentId) return reply.code(403).send({ error: "Forbidden." });

    const isExpired = session.status === "OPEN" && session.expiresAt < new Date();
    if (isExpired && session.status === "OPEN") {
      await db.checkoutSession.update({ where: { id: session.id }, data: { status: "EXPIRED" } });
      await writeAuditLog({ action: "Checkout Session Expired", summary: `Checkout session ${session.id} expired`, actorUserId: ctx.userId, entityType: "CheckoutSession", entityId: session.id });
    }
    return reply.send({ session: { ...session, status: isExpired ? "EXPIRED" : session.status } });
  });

  const consumeSchema = z.object({ checkoutMode: z.enum(["MANUAL_PAYMENT", "ADMIN_ASSISTED"]).default("MANUAL_PAYMENT") });

  app.post("/api/checkout-sessions/:token/consume", { preHandler: [requireAuth] }, async (request, reply) => {
    const { token } = request.params as { token: string };
    const session = await db.checkoutSession.findUnique({ where: { sessionToken: token }, include: { product: true } });
    if (!session) return reply.code(404).send({ error: "Checkout session not found." });
    const ctx = request.authContext!;
    if (ctx.kind === "student" && ctx.studentId !== session.studentId) return reply.code(403).send({ error: "Forbidden." });

    if (session.status !== "OPEN") return reply.code(409).send({ error: `This checkout session is ${session.status.toLowerCase()} and cannot be used.` });
    if (session.expiresAt < new Date()) {
      await db.checkoutSession.update({ where: { id: session.id }, data: { status: "EXPIRED" } });
      return reply.code(409).send({ error: "This checkout session has expired. Start a new checkout." });
    }

    const parsed = consumeSchema.safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: "Invalid request." });

    // Re-derive the referral event (if any) recorded at session-create
    // time, so an Order created from a session carries the SAME
    // attribution the session locked in — never recomputed at consume
    // time, which could otherwise let a stale/expired code apply later.
    let affiliateId: string | undefined;
    let affiliateAttributionJson: Record<string, unknown> | undefined;
    if (session.affiliateReferralCode) {
      const affiliate = await db.affiliate.findUnique({ where: { referralCode: session.affiliateReferralCode } });
      if (affiliate && affiliate.status === "ACTIVE") {
        affiliateId = affiliate.id;
        affiliateAttributionJson = { method: "EXPLICIT_CODE", referralCode: session.affiliateReferralCode };
      }
    }

    const price = session.computedPriceJson as unknown as { subtotal: number; discountAmount: number; creditsApplied: number; total: number; currency: string; promotionId?: string };
    const purchase = await createOrder({
      studentId: session.studentId,
      product: session.product,
      price,
      quantity: session.quantity,
      checkoutMode: parsed.data.checkoutMode,
      source: "CHECKOUT",
      checkoutSessionId: session.id,
      affiliateId,
      affiliateAttributionJson,
      createdById: ctx.userId,
    });

    if (affiliateId) {
      await db.referralEvent.create({ data: { affiliateId, kind: "ORDER", personId: ctx.personId, purchaseId: purchase.id, metadataJson: { checkoutSessionId: session.id } } });
    }

    await db.checkoutSession.update({ where: { id: session.id }, data: { status: "CONSUMED" } });
    return reply.code(201).send({ purchase });
  });
}
