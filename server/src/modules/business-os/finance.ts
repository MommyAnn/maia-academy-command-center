// M.A.I.A. Business OS — Business Finance (spec sections 32-36). Strictly
// separate from the Academy's own PaymentTransaction ledger (spec 33): a
// BusinessRevenueRecord/BusinessExpenseRecord NEVER references or is
// derived from a Student's own tuition payments. Not presented as formal
// accounting software (spec 35) — this is a manual/labeled cash summary
// only. Every record carries an explicit, always-visible source label.

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../../db.js";
import { requireAuth, requireStudentSelfOrPermission, assertBusinessAccess, type AuthContext } from "../../rbac/middleware.js";
import { writeAuditLog } from "../../audit/log.js";

export const REVENUE_SOURCES = ["MANUAL", "CONNECTED_STORE", "CONNECTED_PAYMENT_PROVIDER", "CRM_SALE", "VERIFIED_TRANSACTION", "OTHER"] as const;

async function authorize(request: { authContext?: AuthContext }, businessId: string, level: "VIEW" | "EDIT"): Promise<boolean> {
  const ctx = request.authContext;
  if (!ctx) return false;
  return assertBusinessAccess(businessId, ctx, level);
}

export async function businessFinanceRoutes(app: FastifyInstance) {
  const revenueSchema = z.object({
    businessId: z.string().min(1),
    amount: z.number().positive(),
    source: z.enum(REVENUE_SOURCES),
    description: z.string().optional(),
    occurredAt: z.string().datetime(),
    relatedOpportunityId: z.string().optional(),
  });

  app.post("/api/students/:studentId/business-revenue", { preHandler: [requireAuth, requireStudentSelfOrPermission("Business OS", "CREATE")] }, async (request, reply) => {
    const parsed = revenueSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid request.", details: parsed.error.flatten() });
    if (!(await authorize(request, parsed.data.businessId, "EDIT"))) return reply.code(403).send({ error: "Forbidden: this business does not belong to you." });

    if (parsed.data.relatedOpportunityId) {
      const opp = await db.opportunity.findUnique({ where: { id: parsed.data.relatedOpportunityId } });
      if (!opp || opp.businessId !== parsed.data.businessId) return reply.code(403).send({ error: "This opportunity does not belong to this business." });
    }

    const ctx = request.authContext!;
    const record = await db.businessRevenueRecord.create({
      data: {
        businessId: parsed.data.businessId,
        amount: parsed.data.amount,
        source: parsed.data.source,
        description: parsed.data.description,
        occurredAt: new Date(parsed.data.occurredAt),
        relatedOpportunityId: parsed.data.relatedOpportunityId,
        createdById: ctx.userId,
      },
    });
    if (parsed.data.relatedOpportunityId) {
      await db.opportunity.update({ where: { id: parsed.data.relatedOpportunityId }, data: { status: "WON" } });
    }
    await writeAuditLog({ action: "Business Revenue Recorded", summary: `Recorded ${parsed.data.amount} (${parsed.data.source})`, actorUserId: ctx.userId, entityType: "BusinessRevenueRecord", entityId: record.id });
    return reply.code(201).send({ record });
  });

  app.get("/api/businesses/:businessId/business-revenue", { preHandler: [requireAuth] }, async (request, reply) => {
    const { businessId } = request.params as { businessId: string };
    if (!(await authorize(request, businessId, "VIEW"))) return reply.code(403).send({ error: "Forbidden: this business does not belong to you." });
    const { from, to } = request.query as { from?: string; to?: string };
    const records = await db.businessRevenueRecord.findMany({
      where: { businessId, occurredAt: { gte: from ? new Date(from) : undefined, lte: to ? new Date(to) : undefined } },
      orderBy: { occurredAt: "desc" },
      take: 500,
    });
    const totalsBySource: Record<string, number> = {};
    for (const r of records) totalsBySource[r.source] = (totalsBySource[r.source] ?? 0) + Number(r.amount);
    return reply.send({ records, totalsBySource, total: records.reduce((sum, r) => sum + Number(r.amount), 0) });
  });

  const expenseSchema = z.object({
    businessId: z.string().min(1),
    amount: z.number().positive(),
    category: z.string().min(1),
    description: z.string().optional(),
    occurredAt: z.string().datetime(),
  });

  app.post("/api/students/:studentId/business-expenses", { preHandler: [requireAuth, requireStudentSelfOrPermission("Business OS", "CREATE")] }, async (request, reply) => {
    const parsed = expenseSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid request.", details: parsed.error.flatten() });
    if (!(await authorize(request, parsed.data.businessId, "EDIT"))) return reply.code(403).send({ error: "Forbidden: this business does not belong to you." });

    const ctx = request.authContext!;
    const record = await db.businessExpenseRecord.create({
      data: { businessId: parsed.data.businessId, amount: parsed.data.amount, category: parsed.data.category, description: parsed.data.description, occurredAt: new Date(parsed.data.occurredAt), createdById: ctx.userId },
    });
    await writeAuditLog({ action: "Business Expense Recorded", summary: `Recorded expense ${parsed.data.amount} (${parsed.data.category})`, actorUserId: ctx.userId, entityType: "BusinessExpenseRecord", entityId: record.id });
    return reply.code(201).send({ record });
  });

  app.get("/api/businesses/:businessId/business-expenses", { preHandler: [requireAuth] }, async (request, reply) => {
    const { businessId } = request.params as { businessId: string };
    if (!(await authorize(request, businessId, "VIEW"))) return reply.code(403).send({ error: "Forbidden: this business does not belong to you." });
    const records = await db.businessExpenseRecord.findMany({ where: { businessId }, orderBy: { occurredAt: "desc" }, take: 500 });
    return reply.send({ records, total: records.reduce((sum, r) => sum + Number(r.amount), 0) });
  });

  // Cash summary — revenue minus expenses over a window, never presented
  // as formal accounting (spec section 35).
  app.get("/api/businesses/:businessId/finance-summary", { preHandler: [requireAuth] }, async (request, reply) => {
    const { businessId } = request.params as { businessId: string };
    if (!(await authorize(request, businessId, "VIEW"))) return reply.code(403).send({ error: "Forbidden: this business does not belong to you." });
    const { from, to } = request.query as { from?: string; to?: string };
    const dateFilter = { gte: from ? new Date(from) : undefined, lte: to ? new Date(to) : undefined };
    const [revenueAgg, expenseAgg] = await Promise.all([
      db.businessRevenueRecord.aggregate({ where: { businessId, occurredAt: dateFilter }, _sum: { amount: true } }),
      db.businessExpenseRecord.aggregate({ where: { businessId, occurredAt: dateFilter }, _sum: { amount: true } }),
    ]);
    const totalRevenue = Number(revenueAgg._sum.amount ?? 0);
    const totalExpenses = Number(expenseAgg._sum.amount ?? 0);
    return reply.send({ totalRevenue, totalExpenses, netCash: totalRevenue - totalExpenses, label: "MANUAL/CONNECTED CASH SUMMARY — not formal accounting" });
  });
}
