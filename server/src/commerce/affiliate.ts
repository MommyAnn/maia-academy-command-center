// M.A.I.A. Affiliate Center (Production Phase 17, spec sections 61-89).
// Real referral tracking, real commission calculation from a snapshotted
// rule, and a human-approved Payout Batch that never itself moves money
// (spec section 84) — reaching PAID here records that a human Finance/
// Admin paid the affiliate OUTSIDE this system; no payout provider is
// connected.

import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { db } from "../db.js";
import { requireAuth, requirePermission } from "../rbac/middleware.js";
import { writeAuditLog } from "../audit/log.js";
import { generateAffiliateDisplayId, generateCommissionDisplayId, generatePayoutBatchDisplayId } from "../modules/sequence.js";

async function generateReferralCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = randomBytes(5).toString("hex").toUpperCase();
    const existing = await db.affiliate.findUnique({ where: { referralCode: code } });
    if (!existing) return code;
  }
  throw new Error("Could not generate a unique referral code — please retry.");
}

const AFFILIATE_STATUS_TRANSITIONS: Record<string, string[]> = {
  APPLIED: ["PENDING_REVIEW", "REJECTED"],
  PENDING_REVIEW: ["ACTIVE", "REJECTED"],
  ACTIVE: ["SUSPENDED", "INACTIVE"],
  SUSPENDED: ["ACTIVE", "INACTIVE"],
  REJECTED: [],
  INACTIVE: ["ACTIVE"],
};

export async function affiliateRoutes(app: FastifyInstance) {
  // --- Application + admin lifecycle ---------------------------------------

  app.post("/api/affiliates/apply", { preHandler: [requireAuth] }, async (request, reply) => {
    const ctx = request.authContext!;
    const existing = await db.affiliate.findUnique({ where: { personId: ctx.personId } });
    if (existing) return reply.code(409).send({ error: "An affiliate application already exists for this account.", affiliate: existing });

    const referralCode = await generateReferralCode();
    const affiliate = await db.affiliate.create({
      data: { affiliateDisplayId: await generateAffiliateDisplayId(), personId: ctx.personId, referralCode, status: "APPLIED" },
    });
    await writeAuditLog({ action: "Affiliate Applied", summary: `Affiliate application ${affiliate.affiliateDisplayId} submitted`, actorUserId: ctx.userId, entityType: "Affiliate", entityId: affiliate.id });
    return reply.code(201).send({ affiliate });
  });

  app.get("/api/admin/affiliates", { preHandler: [requireAuth, requirePermission("Affiliate Program", "VIEW")] }, async (request, reply) => {
    const { status } = request.query as { status?: string };
    const affiliates = await db.affiliate.findMany({ where: { status: status || undefined }, include: { person: true, commissionPlan: true }, orderBy: { createdAt: "desc" } });
    return reply.send({ affiliates });
  });

  const statusChangeSchema = z.object({ status: z.enum(["PENDING_REVIEW", "ACTIVE", "SUSPENDED", "REJECTED", "INACTIVE"]), commissionPlanId: z.string().optional() });

  // Admin approval before commission eligibility, unless configured
  // otherwise (spec section 64) — this codebase's default configuration
  // always requires it; there is no auto-approve path.
  app.post("/api/admin/affiliates/:id/status", { preHandler: [requireAuth, requirePermission("Affiliate Program", "EDIT")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const affiliate = await db.affiliate.findUnique({ where: { id } });
    if (!affiliate) return reply.code(404).send({ error: "Affiliate not found." });
    const parsed = statusChangeSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid request." });

    const allowed = AFFILIATE_STATUS_TRANSITIONS[affiliate.status] ?? [];
    if (!allowed.includes(parsed.data.status)) return reply.code(409).send({ error: `Cannot move affiliate from ${affiliate.status} to ${parsed.data.status}.` });

    const ctx = request.authContext!;
    const updated = await db.affiliate.update({
      where: { id },
      data: {
        status: parsed.data.status,
        commissionPlanId: parsed.data.commissionPlanId,
        approvedById: parsed.data.status === "ACTIVE" ? ctx.userId : affiliate.approvedById,
        approvedAt: parsed.data.status === "ACTIVE" ? new Date() : affiliate.approvedAt,
      },
    });
    const action = parsed.data.status === "ACTIVE" ? "Affiliate Approved" : parsed.data.status === "SUSPENDED" ? "Affiliate Suspended" : parsed.data.status === "REJECTED" ? "Affiliate Rejected" : "Affiliate Applied";
    await writeAuditLog({ action, summary: `Affiliate ${affiliate.affiliateDisplayId} status ${affiliate.status} -> ${parsed.data.status}`, actorUserId: ctx.userId, entityType: "Affiliate", entityId: id });
    return reply.send({ affiliate: updated });
  });

  // --- Self-service dashboard (spec sections 78-79) -------------------------
  // Never exposes another Student's payment info, sensitive data, or
  // private documents — only this affiliate's own referral/commission
  // aggregates.

  app.get("/api/affiliates/me", { preHandler: [requireAuth] }, async (request, reply) => {
    const ctx = request.authContext!;
    const affiliate = await db.affiliate.findUnique({ where: { personId: ctx.personId } });
    if (!affiliate) return reply.code(404).send({ error: "No affiliate account found for this user." });

    const [clicks, leads, orders, verifiedPurchases, commissions] = await Promise.all([
      db.referralEvent.count({ where: { affiliateId: affiliate.id, kind: "CLICK" } }),
      db.referralEvent.count({ where: { affiliateId: affiliate.id, kind: { in: ["LEAD", "REGISTRATION"] } } }),
      db.referralEvent.count({ where: { affiliateId: affiliate.id, kind: "ORDER" } }),
      db.referralEvent.count({ where: { affiliateId: affiliate.id, kind: "VERIFIED_PURCHASE" } }),
      db.commission.findMany({ where: { affiliateId: affiliate.id }, select: { status: true, commissionAmount: true } }),
    ]);

    const sum = (statuses: string[]) => commissions.filter((c) => statuses.includes(c.status)).reduce((acc, c) => acc + Number(c.commissionAmount), 0);
    return reply.send({
      affiliate,
      referralLink: `/r/${affiliate.referralCode}`,
      stats: { clicks, leads, orders, verifiedPurchases },
      commissions: { pending: sum(["PENDING", "QUALIFYING"]), payable: sum(["APPROVED", "PAYABLE"]), paid: sum(["PAID"]) },
    });
  });

  // --- Referral event tracking (spec sections 65-66) ------------------------
  // Public — a visitor is not logged in yet at CLICK/LANDING time. Only the
  // early-funnel event kinds are client-postable; ORDER/VERIFIED_PURCHASE
  // are created internally by the checkout/commission pipeline ONLY, so a
  // client can never fabricate a fake sale event for itself (spec 77).

  const trackSchema = z.object({ referralCode: z.string().min(1), kind: z.enum(["CLICK", "LANDING", "LEAD", "REGISTRATION"]), metadata: z.record(z.string(), z.unknown()).optional() });

  app.post("/api/referral-events", async (request, reply) => {
    const parsed = trackSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid request." });
    const affiliate = await db.affiliate.findUnique({ where: { referralCode: parsed.data.referralCode } });
    if (!affiliate || affiliate.status !== "ACTIVE") return reply.code(404).send({ error: "Invalid or inactive referral code." });

    const event = await db.referralEvent.create({
      data: { affiliateId: affiliate.id, kind: parsed.data.kind, metadataJson: parsed.data.metadata as Prisma.InputJsonValue | undefined },
    });
    await writeAuditLog({ action: "Referral Event Recorded", summary: `${parsed.data.kind} recorded for affiliate ${affiliate.affiliateDisplayId}`, entityType: "ReferralEvent", entityId: event.id });
    return reply.code(201).send({ ok: true });
  });

  // --- Commission Plans (spec section 73) -----------------------------------

  const planSchema = z.object({ name: z.string().min(1), type: z.enum(["PERCENTAGE", "FIXED_AMOUNT"]), rate: z.number().min(0).max(100).optional(), fixedAmount: z.number().nonnegative().optional(), productScopeJson: z.array(z.string()).optional() });

  app.post("/api/admin/commission-plans", { preHandler: [requireAuth, requirePermission("Affiliate Program", "CREATE")] }, async (request, reply) => {
    const parsed = planSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid request." });
    const ctx = request.authContext!;
    const plan = await db.commissionPlan.create({
      data: { name: parsed.data.name, type: parsed.data.type, rate: parsed.data.rate, fixedAmount: parsed.data.fixedAmount, productScopeJson: parsed.data.productScopeJson as Prisma.InputJsonValue | undefined, createdById: ctx.userId },
    });
    await writeAuditLog({ action: "Commission Plan Created", summary: `Commission plan "${plan.name}" created`, actorUserId: ctx.userId, entityType: "CommissionPlan", entityId: plan.id });
    return reply.code(201).send({ plan });
  });

  app.get("/api/admin/commission-plans", { preHandler: [requireAuth, requirePermission("Affiliate Program", "VIEW")] }, async (_request, reply) => {
    const plans = await db.commissionPlan.findMany({ orderBy: { createdAt: "desc" } });
    return reply.send({ plans });
  });

  // --- Commissions (spec sections 70-77) ------------------------------------

  app.get("/api/admin/commissions", { preHandler: [requireAuth, requirePermission("Affiliate Program", "VIEW")] }, async (request, reply) => {
    const { status } = request.query as { status?: string };
    const commissions = await db.commission.findMany({ where: { status: status || undefined }, include: { affiliate: true, purchase: true, student: true }, orderBy: { createdAt: "desc" } });
    return reply.send({ commissions });
  });

  const approveSchema = z.object({ note: z.string().optional() });

  app.post("/api/admin/commissions/:id/approve", { preHandler: [requireAuth, requirePermission("Affiliate Program", "EDIT")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const commission = await db.commission.findUnique({ where: { id } });
    if (!commission) return reply.code(404).send({ error: "Commission not found." });
    if (!["PENDING", "QUALIFYING", "DISPUTED"].includes(commission.status)) return reply.code(409).send({ error: `Cannot approve a commission with status ${commission.status}.` });

    const ctx = request.authContext!;
    const parsed = approveSchema.safeParse(request.body ?? {});
    const updated = await db.commission.update({ where: { id }, data: { status: "APPROVED", eligibleDate: new Date() } });
    await writeAuditLog({ action: "Commission Status Changed", summary: `Commission ${commission.commissionDisplayId} approved${parsed.success && parsed.data.note ? `: ${parsed.data.note}` : ""}`, actorUserId: ctx.userId, entityType: "Commission", entityId: id });
    return reply.send({ commission: updated });
  });

  const voidSchema = z.object({ reason: z.string().min(1) });

  app.post("/api/admin/commissions/:id/void", { preHandler: [requireAuth, requirePermission("Affiliate Program", "EDIT")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const commission = await db.commission.findUnique({ where: { id } });
    if (!commission) return reply.code(404).send({ error: "Commission not found." });
    if (commission.status === "PAID") return reply.code(409).send({ error: "Cannot void a commission that has already been paid — use a reversal process instead." });
    const parsed = voidSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "A reason is required." });

    const ctx = request.authContext!;
    const updated = await db.commission.update({ where: { id }, data: { status: "VOIDED" } });
    await writeAuditLog({ action: "Commission Status Changed", summary: `Commission ${commission.commissionDisplayId} voided: ${parsed.data.reason}`, actorUserId: ctx.userId, entityType: "Commission", entityId: id });
    return reply.send({ commission: updated });
  });

  // --- Payout Batches (spec sections 84-88) ---------------------------------
  // Every transition here is an explicit human action. Nothing in this
  // codebase can move a batch to PAID on its own (spec 88: "AI cannot
  // independently approve/send affiliate payouts").

  const createBatchSchema = z.object({ periodStart: z.string().datetime(), periodEnd: z.string().datetime() });

  app.post("/api/admin/payout-batches", { preHandler: [requireAuth, requirePermission("Affiliate Program", "CREATE")] }, async (request, reply) => {
    const parsed = createBatchSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid request." });
    const ctx = request.authContext!;
    const batch = await db.payoutBatch.create({
      data: { payoutBatchDisplayId: await generatePayoutBatchDisplayId(), periodStart: new Date(parsed.data.periodStart), periodEnd: new Date(parsed.data.periodEnd), createdById: ctx.userId },
    });
    await writeAuditLog({ action: "Payout Batch Created", summary: `Payout batch ${batch.payoutBatchDisplayId} created`, actorUserId: ctx.userId, entityType: "PayoutBatch", entityId: batch.id });
    return reply.code(201).send({ batch });
  });

  app.get("/api/admin/payout-batches", { preHandler: [requireAuth, requirePermission("Affiliate Program", "VIEW")] }, async (_request, reply) => {
    const batches = await db.payoutBatch.findMany({ include: { commissions: true }, orderBy: { createdAt: "desc" } });
    return reply.send({ batches });
  });

  const addCommissionsSchema = z.object({ commissionIds: z.array(z.string()).min(1) });

  app.post("/api/admin/payout-batches/:id/add-commissions", { preHandler: [requireAuth, requirePermission("Affiliate Program", "EDIT")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const batch = await db.payoutBatch.findUnique({ where: { id } });
    if (!batch) return reply.code(404).send({ error: "Payout batch not found." });
    if (batch.status !== "DRAFT") return reply.code(409).send({ error: "Can only add commissions to a DRAFT payout batch." });
    const parsed = addCommissionsSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid request." });

    const commissions = await db.commission.findMany({ where: { id: { in: parsed.data.commissionIds }, status: "APPROVED" } });
    if (commissions.length !== parsed.data.commissionIds.length) return reply.code(400).send({ error: "One or more commissions are not APPROVED or do not exist — only APPROVED commissions may be added to a payout batch." });

    await db.$transaction([
      db.commission.updateMany({ where: { id: { in: commissions.map((c) => c.id) } }, data: { status: "PAYABLE", payoutBatchId: id } }),
      db.payoutBatch.update({ where: { id }, data: { totalAmount: { increment: commissions.reduce((sum, c) => sum + Number(c.commissionAmount), 0) } } }),
    ]);
    return reply.send({ addedCount: commissions.length });
  });

  app.post("/api/admin/payout-batches/:id/submit-for-review", { preHandler: [requireAuth, requirePermission("Affiliate Program", "EDIT")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const batch = await db.payoutBatch.findUnique({ where: { id } });
    if (!batch) return reply.code(404).send({ error: "Payout batch not found." });
    if (batch.status !== "DRAFT") return reply.code(409).send({ error: `Cannot submit a batch with status ${batch.status}.` });
    const updated = await db.payoutBatch.update({ where: { id }, data: { status: "FOR_REVIEW" } });
    return reply.send({ batch: updated });
  });

  app.post("/api/admin/payout-batches/:id/approve", { preHandler: [requireAuth, requirePermission("Affiliate Program", "VERIFY")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const batch = await db.payoutBatch.findUnique({ where: { id } });
    if (!batch) return reply.code(404).send({ error: "Payout batch not found." });
    if (batch.status !== "FOR_REVIEW") return reply.code(409).send({ error: `Cannot approve a batch with status ${batch.status}.` });
    const ctx = request.authContext!;
    const updated = await db.payoutBatch.update({ where: { id }, data: { status: "APPROVED", approvedById: ctx.userId, approvedAt: new Date() } });
    await writeAuditLog({ action: "Payout Batch Approved", summary: `Payout batch ${batch.payoutBatchDisplayId} approved (₱${batch.totalAmount})`, actorUserId: ctx.userId, entityType: "PayoutBatch", entityId: id });
    return reply.send({ batch: updated });
  });

  const markPaidSchema = z.object({ referenceNote: z.string().min(1) });

  // Recording PAID here means a human ALREADY paid the affiliates outside
  // this system (bank transfer, e-wallet, etc.) — this route never itself
  // moves money (spec section 84).
  app.post("/api/admin/payout-batches/:id/mark-paid", { preHandler: [requireAuth, requirePermission("Affiliate Program", "VERIFY")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const batch = await db.payoutBatch.findUnique({ where: { id } });
    if (!batch) return reply.code(404).send({ error: "Payout batch not found." });
    if (batch.status !== "APPROVED") return reply.code(409).send({ error: `Cannot mark a batch with status ${batch.status} as paid — it must be APPROVED first.` });
    const parsed = markPaidSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "A payout reference note is required." });

    const ctx = request.authContext!;
    const [updated] = await db.$transaction([
      db.payoutBatch.update({ where: { id }, data: { status: "PAID", paidAt: new Date(), referenceNote: parsed.data.referenceNote } }),
      db.commission.updateMany({ where: { payoutBatchId: id }, data: { status: "PAID" } }),
    ]);
    await writeAuditLog({ action: "Payout Batch Marked Paid", summary: `Payout batch ${batch.payoutBatchDisplayId} marked paid: ${parsed.data.referenceNote}`, actorUserId: ctx.userId, entityType: "PayoutBatch", entityId: id });
    return reply.send({ batch: updated });
  });

  // --- Admin affiliate report (spec section 89) -----------------------------

  app.get("/api/admin/affiliates/report", { preHandler: [requireAuth, requirePermission("Affiliate Program", "VIEW")] }, async (_request, reply) => {
    const [activeAffiliates, totalClicks, attributedLeads, verifiedSales, pending, payable, paid] = await Promise.all([
      db.affiliate.count({ where: { status: "ACTIVE" } }),
      db.referralEvent.count({ where: { kind: "CLICK" } }),
      db.referralEvent.count({ where: { kind: { in: ["LEAD", "REGISTRATION"] } } }),
      db.referralEvent.count({ where: { kind: "VERIFIED_PURCHASE" } }),
      db.commission.aggregate({ where: { status: { in: ["PENDING", "QUALIFYING"] } }, _sum: { commissionAmount: true } }),
      db.commission.aggregate({ where: { status: { in: ["APPROVED", "PAYABLE"] } }, _sum: { commissionAmount: true } }),
      db.commission.aggregate({ where: { status: "PAID" }, _sum: { commissionAmount: true } }),
    ]);
    return reply.send({
      activeAffiliates,
      totalClicks,
      attributedLeads,
      verifiedSales,
      pendingCommissions: Number(pending._sum.commissionAmount ?? 0),
      payableCommissions: Number(payable._sum.commissionAmount ?? 0),
      paidCommissions: Number(paid._sum.commissionAmount ?? 0),
      generatedAt: new Date().toISOString(),
    });
  });
}

// Called from the checkout verify route once a payment is genuinely
// verified (spec section 70: "Commission may become eligible only after
// Verified Payment") — never at click/lead/order-creation time.
export async function calculateCommissionForPurchase(purchaseId: string, actorUserId: string) {
  const purchase = await db.purchase.findUnique({ where: { id: purchaseId }, include: { student: { include: { person: true } } } });
  if (!purchase || !purchase.affiliateId) return null;

  // Idempotent — a re-verification or duplicate call never creates a
  // second commission for the same Order (spec section 77).
  const existing = await db.commission.findFirst({ where: { purchaseId } });
  if (existing) return existing;

  const affiliate = await db.affiliate.findUnique({ where: { id: purchase.affiliateId } });
  if (!affiliate || affiliate.status !== "ACTIVE" || !affiliate.commissionPlanId) return null;
  const plan = await db.commissionPlan.findUnique({ where: { id: affiliate.commissionPlanId } });
  if (!plan) return null;

  const scope = plan.productScopeJson as string[] | null;
  if (scope && !scope.includes(purchase.productId)) return null;

  // Self-referral (spec section 76) — flagged for human review via
  // DISPUTED status, never auto-blocked and never silently paid.
  const isSelfReferral = affiliate.personId === purchase.student.personId;

  const basisAmount = Number(purchase.priceAtPurchase);
  const commissionAmount = plan.type === "PERCENTAGE" ? basisAmount * (Number(plan.rate ?? 0) / 100) : Number(plan.fixedAmount ?? 0);

  const commission = await db.commission.create({
    data: {
      commissionDisplayId: await generateCommissionDisplayId(),
      affiliateId: affiliate.id,
      purchaseId: purchase.id,
      studentId: purchase.studentId,
      commissionPlanId: plan.id,
      basisAmount,
      ruleSnapshotJson: { type: plan.type, rate: plan.rate, fixedAmount: plan.fixedAmount, selfReferralFlag: isSelfReferral } as Prisma.InputJsonValue,
      commissionAmount,
      status: isSelfReferral ? "DISPUTED" : "PENDING",
    },
  });
  await db.referralEvent.create({ data: { affiliateId: affiliate.id, kind: "VERIFIED_PURCHASE", personId: purchase.student.personId, purchaseId: purchase.id } });
  await writeAuditLog({ action: "Commission Calculated", summary: `Commission ${commission.commissionDisplayId} calculated for Order ${purchase.purchaseDisplayId} (₱${commissionAmount})${isSelfReferral ? " — SELF-REFERRAL FLAGGED FOR REVIEW" : ""}`, actorUserId, entityType: "Commission", entityId: commission.id });
  return commission;
}

// Reverses a PAYABLE/APPROVED/PENDING/QUALIFYING commission when its
// underlying Order is refunded (spec section 75) — never touches an
// already-PAID commission automatically; that requires a separate,
// explicit human decision.
export async function reverseCommissionForRefund(purchaseId: string, reason: string, actorUserId: string) {
  const commission = await db.commission.findFirst({ where: { purchaseId, status: { in: ["PENDING", "QUALIFYING", "APPROVED", "PAYABLE"] } } });
  if (!commission) return null;
  const updated = await db.commission.update({ where: { id: commission.id }, data: { status: "REVERSED" } });
  await writeAuditLog({ action: "Commission Status Changed", summary: `Commission ${commission.commissionDisplayId} reversed — underlying Order refunded (${reason})`, actorUserId, entityType: "Commission", entityId: commission.id });
  return updated;
}
