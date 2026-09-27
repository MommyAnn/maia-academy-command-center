// Refund workflow (Production Phase 17, spec sections 108-113). A refund
// is never AI-decided and never provider-automated in this build (no real
// gateway is connected) — every transition here is an explicit, audited
// human action. Approving a refund records the DECISION; "processed"
// records that a human actually returned the money (manually, or via a
// provider's refund API in a future connected build) — this route never
// itself moves money.

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db.js";
import { requireAuth, requirePermission, requireStudentSelfOrPermission } from "../rbac/middleware.js";
import { writeAuditLog } from "../audit/log.js";
import { generateRefundDisplayId } from "../modules/sequence.js";
import { setFulfillmentStatus } from "./order.js";

export async function refundRoutes(app: FastifyInstance) {
  const requestSchema = z.object({ purchaseId: z.string().min(1), amount: z.number().positive(), reason: z.string().min(1) });

  app.post("/api/students/:studentId/refund-requests", { preHandler: [requireAuth, requireStudentSelfOrPermission("Commerce", "CREATE")] }, async (request, reply) => {
    const { studentId } = request.params as { studentId: string };
    const parsed = requestSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid request." });

    const purchase = await db.purchase.findUnique({ where: { id: parsed.data.purchaseId } });
    if (!purchase || purchase.studentId !== studentId) return reply.code(404).send({ error: "Order not found." });
    if (purchase.status !== "PAID") return reply.code(409).send({ error: `Cannot request a refund for an Order with payment status ${purchase.status}.` });
    if (parsed.data.amount > Number(purchase.priceAtPurchase)) return reply.code(400).send({ error: "Refund amount cannot exceed the Order's total." });

    const ctx = request.authContext!;
    const refund = await db.refundRequest.create({
      data: { refundDisplayId: await generateRefundDisplayId(), purchaseId: purchase.id, studentId, amount: parsed.data.amount, reason: parsed.data.reason, requestedById: ctx.userId },
    });
    await writeAuditLog({ action: "Refund Requested", summary: `Refund ${refund.refundDisplayId} requested for Order ${purchase.purchaseDisplayId} (₱${parsed.data.amount}): ${parsed.data.reason}`, actorUserId: ctx.userId, entityType: "RefundRequest", entityId: refund.id });
    return reply.code(201).send({ refundRequest: refund });
  });

  app.get("/api/admin/refund-requests", { preHandler: [requireAuth, requirePermission("Commerce", "VIEW")] }, async (request, reply) => {
    const { status } = request.query as { status?: string };
    const refunds = await db.refundRequest.findMany({ where: { status: status || undefined }, include: { purchase: { include: { product: true } }, student: true }, orderBy: { createdAt: "desc" } });
    return reply.send({ refundRequests: refunds });
  });

  const reviewSchema = z.object({ decision: z.enum(["APPROVED", "REJECTED"]), reviewNotes: z.string().optional() });

  // Surfaces the applicable facts for an authorized human to decide (spec
  // section 110: "Do not automatically decide refund eligibility with
  // AI") — this route only records whatever decision the human makes.
  app.post("/api/admin/refund-requests/:id/review", { preHandler: [requireAuth, requirePermission("Commerce", "VERIFY")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const refund = await db.refundRequest.findUnique({ where: { id } });
    if (!refund) return reply.code(404).send({ error: "Refund request not found." });
    if (!["REQUESTED", "UNDER_REVIEW"].includes(refund.status)) return reply.code(409).send({ error: `Cannot review a refund request with status ${refund.status}.` });
    const parsed = reviewSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid request." });

    const ctx = request.authContext!;
    const updated = await db.refundRequest.update({ where: { id }, data: { status: parsed.data.decision, reviewedById: ctx.userId, reviewedAt: new Date(), reviewNotes: parsed.data.reviewNotes } });
    await writeAuditLog({ action: "Refund Reviewed", summary: `Refund ${refund.refundDisplayId} ${parsed.data.decision.toLowerCase()}${parsed.data.reviewNotes ? `: ${parsed.data.reviewNotes}` : ""}`, actorUserId: ctx.userId, entityType: "RefundRequest", entityId: id });
    return reply.send({ refundRequest: updated });
  });

  const processSchema = z.object({ providerRefundRef: z.string().optional(), accessPolicy: z.enum(["REVOKE_ACCESS", "RETAIN_ACCESS"]) });

  // Processing is a SEPARATE step from approval (spec section 111: "If
  // provider supports refund API: require explicit authorized
  // confirmation") — approval is the eligibility decision, processing is
  // the confirmation that the money actually moved.
  app.post("/api/admin/refund-requests/:id/process", { preHandler: [requireAuth, requirePermission("Commerce", "VERIFY")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const refund = await db.refundRequest.findUnique({ where: { id }, include: { purchase: true } });
    if (!refund) return reply.code(404).send({ error: "Refund request not found." });
    if (refund.status !== "APPROVED") return reply.code(409).send({ error: "Only an APPROVED refund request can be processed." });
    const parsed = processSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid request." });

    const ctx = request.authContext!;
    const isFullRefund = Number(refund.amount) >= Number(refund.purchase.priceAtPurchase);
    const newOrderStatus = isFullRefund ? "REFUNDED" : "PARTIALLY_REFUNDED";

    const [updatedRefund] = await db.$transaction([
      db.refundRequest.update({ where: { id }, data: { status: "REFUNDED", providerRefundRef: parsed.data.providerRefundRef, processedAt: new Date() } }),
      db.purchase.update({ where: { id: refund.purchaseId }, data: { status: newOrderStatus } }),
    ]);

    // Access-after-refund uses a configurable, explicit policy (spec
    // section 112) — never an automatic data deletion either way.
    if (parsed.data.accessPolicy === "REVOKE_ACCESS") {
      const entitlements = await db.entitlement.findMany({ where: { studentId: refund.studentId, sourceRecordId: refund.purchaseId, status: "ACTIVE" } });
      for (const e of entitlements) {
        const { revokeEntitlement } = await import("../entitlements/grant.js");
        await revokeEntitlement(e.id, `Refund ${refund.refundDisplayId} processed — access revoked per policy`, ctx.userId);
      }
      if (refund.purchase.fulfillmentStatus !== "REVOKED") await setFulfillmentStatus(refund.purchaseId, "REVOKED", ctx.userId);
    }

    const { reverseCommissionForRefund } = await import("./affiliate.js");
    await reverseCommissionForRefund(refund.purchaseId, `Refund ${refund.refundDisplayId}`, ctx.userId);

    await writeAuditLog({ action: "Refund Processed", summary: `Refund ${refund.refundDisplayId} processed (₱${refund.amount}, ${parsed.data.accessPolicy})`, actorUserId: ctx.userId, entityType: "RefundRequest", entityId: id });
    return reply.send({ refundRequest: updatedRefund });
  });
}
