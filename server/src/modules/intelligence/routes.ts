// M.A.I.A. Intelligence routes (spec sections 1-68) — Owner/Admin-facing by
// default via the "M.A.I.A. Intelligence" permission module. Every route
// here only reads existing data and annotates it (signals/briefs) or
// manages the rule configuration itself; nothing here ever writes to
// Student/Payment/Lead/etc. tables (Core Principle: AI/rules never become
// the source of truth).

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../../db.js";
import { requireAuth, requirePermission, checkPermission } from "../../rbac/middleware.js";
import { writeAuditLog } from "../../audit/log.js";
import { evaluateAllRules, resolveSignal, dismissSignal } from "./engine.js";
import { buildDailyBrief, buildTodaysPriorities } from "./brief.js";
import { askMaia } from "./ask.js";
import type { PermissionModule } from "../../rbac/modules.js";

const updateRuleSchema = z.object({
  thresholdJson: z.record(z.string(), z.unknown()).optional(),
  severity: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]).optional(),
  active: z.boolean().optional(),
});

const resolveSchema = z.object({ resolution: z.string().min(1) });
const askSchema = z.object({ question: z.string().min(1).max(500) });

export async function intelligenceRoutes(app: FastifyInstance) {
  // --- Rules (spec sections 47-49, 79-81) -----------------------------------

  app.get("/api/intelligence/rules", { preHandler: [requireAuth, requirePermission("M.A.I.A. Intelligence", "VIEW")] }, async (_request, reply) => {
    const rules = await db.intelligenceRule.findMany({ orderBy: { domain: "asc" } });
    return reply.send({ rules });
  });

  app.patch("/api/intelligence/rules/:ruleId", { preHandler: [requireAuth, requirePermission("M.A.I.A. Intelligence", "EDIT")] }, async (request, reply) => {
    const { ruleId } = request.params as { ruleId: string };
    const parsed = updateRuleSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid rule update.", details: parsed.error.flatten() });

    const existing = await db.intelligenceRule.findUnique({ where: { id: ruleId } });
    if (!existing) return reply.code(404).send({ error: "Rule not found." });

    const updated = await db.intelligenceRule.update({
      where: { id: ruleId },
      data: { ...parsed.data, thresholdJson: parsed.data.thresholdJson as never, updatedById: request.authContext!.userId },
    });

    await writeAuditLog({
      action: parsed.data.active === false ? "Intelligence Rule Disabled" : "Intelligence Rule Changed",
      summary: `Rule "${existing.name}" updated${parsed.data.active === false ? " (disabled)" : ""}.`,
      actorUserId: request.authContext!.userId,
      entityType: "IntelligenceRule",
      entityId: ruleId,
    });
    return reply.send({ rule: updated });
  });

  // Manual re-evaluation trigger (spec section 88's "Intelligence Jobs" —
  // the scheduled version is a real background job elsewhere; this exists
  // so an Admin, or a test, can force a run on demand).
  app.post("/api/intelligence/evaluate", { preHandler: [requireAuth, requirePermission("M.A.I.A. Intelligence", "EDIT")] }, async (_request, reply) => {
    const summaries = await evaluateAllRules();
    return reply.send({ summaries });
  });

  // --- Signals (spec sections 50-54) ----------------------------------------

  app.get("/api/intelligence/signals", { preHandler: [requireAuth, requirePermission("M.A.I.A. Intelligence", "VIEW")] }, async (request, reply) => {
    const { domain, severity, status } = request.query as { domain?: string; severity?: string; status?: string };
    const signals = await db.intelligenceSignal.findMany({
      where: { domain: domain || undefined, severity: severity || undefined, status: status || undefined },
      include: { rule: true },
      orderBy: { detectedAt: "desc" },
      take: 500,
    });
    return reply.send({ signals });
  });

  app.post("/api/intelligence/signals/:signalId/resolve", { preHandler: [requireAuth, requirePermission("M.A.I.A. Intelligence", "VERIFY")] }, async (request, reply) => {
    const { signalId } = request.params as { signalId: string };
    const parsed = resolveSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "A resolution note is required.", details: parsed.error.flatten() });
    const existing = await db.intelligenceSignal.findUnique({ where: { id: signalId } });
    if (!existing) return reply.code(404).send({ error: "Signal not found." });
    const signal = await resolveSignal(signalId, request.authContext!.userId, parsed.data.resolution);
    return reply.send({ signal });
  });

  app.post("/api/intelligence/signals/:signalId/dismiss", { preHandler: [requireAuth, requirePermission("M.A.I.A. Intelligence", "VERIFY")] }, async (request, reply) => {
    const { signalId } = request.params as { signalId: string };
    const parsed = resolveSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "A dismissal reason is required.", details: parsed.error.flatten() });
    const existing = await db.intelligenceSignal.findUnique({ where: { id: signalId } });
    if (!existing) return reply.code(404).send({ error: "Signal not found." });
    const signal = await dismissSignal(signalId, request.authContext!.userId, parsed.data.resolution);
    return reply.send({ signal });
  });

  // --- Command Center / Daily Brief (spec sections 2-8) ---------------------

  app.get("/api/intelligence/priorities", { preHandler: [requireAuth, requirePermission("M.A.I.A. Intelligence", "VIEW")] }, async (_request, reply) => {
    const priorities = await buildTodaysPriorities();
    return reply.send({ priorities });
  });

  app.get("/api/intelligence/daily-brief", { preHandler: [requireAuth, requirePermission("M.A.I.A. Intelligence", "VIEW")] }, async (request, reply) => {
    const { rangeDays } = request.query as { rangeDays?: string };
    const brief = await buildDailyBrief(rangeDays ? Number(rangeDays) : 1);
    return reply.send({ brief });
  });

  // --- Ask M.A.I.A. (spec sections 64-68) -----------------------------------

  app.post("/api/intelligence/ask", { preHandler: [requireAuth, requirePermission("M.A.I.A. Intelligence", "VIEW")] }, async (request, reply) => {
    const parsed = askSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid question.", details: parsed.error.flatten() });

    const userId = request.authContext!.userId;
    const result = await askMaia(parsed.data.question, {
      hasPermission: (module: PermissionModule) => checkPermission(userId, module, "VIEW"),
    });

    if (!result.ok) {
      if (result.reason === "PERMISSION_DENIED") return reply.code(403).send({ error: "You do not have permission to view that information." });
      return reply.code(200).send({ answer: "I don't have a way to answer that yet — try one of the suggested questions.", matched: false });
    }
    return reply.send({ answer: result.answer, facts: result.facts, source: result.source, aiPhrased: result.aiPhrased, matched: true });
  });
}
