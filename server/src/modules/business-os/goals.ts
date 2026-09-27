// M.A.I.A. Business OS — Goals (spec sections 10-13). currentValue is
// NEVER invented: MANUAL goals only move when a human updates them, and a
// COMPUTED goal recomputes from one specific, real query — never an AI
// estimate. Status is derived by a disclosed, deterministic pacing rule
// (spec section 12: "explainable rules"), not an opaque score.

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../../db.js";
import { requireAuth, requireStudentSelfOrPermission, assertBusinessAccess, type AuthContext } from "../../rbac/middleware.js";
import { writeAuditLog } from "../../audit/log.js";
import { generateGoalDisplayId } from "../sequence.js";

export const GOAL_TYPES = ["Revenue", "Lead", "Enrollment", "Sales", "Content", "Campaign", "Website", "Automation", "Operational", "Custom"] as const;
export const GOAL_DATA_SOURCES = ["MANUAL", "COMPUTED_CONTACTS", "COMPUTED_OPPORTUNITIES_WON", "COMPUTED_REVENUE"] as const;
type GoalDataSource = (typeof GOAL_DATA_SOURCES)[number];

async function authorize(request: { authContext?: AuthContext }, businessId: string, level: "VIEW" | "EDIT"): Promise<boolean> {
  const ctx = request.authContext;
  if (!ctx) return false;
  return assertBusinessAccess(businessId, ctx, level);
}

/** Recomputes currentValue for a COMPUTED goal from one real query — never estimated. MANUAL goals are left untouched (spec section 13). */
async function recomputeIfComputed(goal: { id: string; businessId: string; dataSource: string; startDate: Date; currentValue: unknown }) {
  const source = goal.dataSource as GoalDataSource;
  if (source === "MANUAL") return goal;

  let currentValue: number;
  if (source === "COMPUTED_CONTACTS") {
    currentValue = await db.businessContact.count({ where: { businessId: goal.businessId, createdAt: { gte: goal.startDate } } });
  } else if (source === "COMPUTED_OPPORTUNITIES_WON") {
    currentValue = await db.opportunity.count({ where: { businessId: goal.businessId, status: "WON", createdAt: { gte: goal.startDate } } });
  } else {
    const agg = await db.businessRevenueRecord.aggregate({ where: { businessId: goal.businessId, occurredAt: { gte: goal.startDate } }, _sum: { amount: true } });
    currentValue = Number(agg._sum.amount ?? 0);
  }
  return db.goal.update({ where: { id: goal.id }, data: { currentValue } });
}

interface StatusResult {
  status: string;
  reason: string;
}

/**
 * Deterministic pacing rule (spec section 12) — pace = actual progress ÷
 * expected progress given elapsed time. Thresholds (0.8 / 0.4) are the
 * disclosed rule, not a hidden score: ON_TRACK at 80%+ of expected pace,
 * NEEDS_ATTENTION below 40%, IN_PROGRESS between. A manually-set PAUSED
 * status is never overridden by this computation.
 */
function deriveGoalStatus(goal: { target: unknown; currentValue: unknown; startDate: Date; targetDate: Date; status: string }): StatusResult {
  const target = Number(goal.target);
  const currentValue = Number(goal.currentValue);
  if (goal.status === "PAUSED") return { status: "PAUSED", reason: "Manually paused by the owner." };
  if (currentValue >= target && target > 0) return { status: "COMPLETED", reason: `Reached ${currentValue} of ${target} target.` };

  const now = Date.now();
  const total = goal.targetDate.getTime() - goal.startDate.getTime();
  const elapsed = now - goal.startDate.getTime();

  if (now > goal.targetDate.getTime()) {
    return { status: "NEEDS_ATTENTION", reason: `Target date passed with only ${currentValue} of ${target} reached.` };
  }
  if (currentValue === 0) return { status: "NOT_STARTED", reason: "No progress recorded yet." };
  if (total <= 0) return { status: "IN_PROGRESS", reason: "Progress recorded; target date already at or before start date." };

  const expectedProgress = Math.min(1, Math.max(0, elapsed / total));
  const actualProgress = target > 0 ? currentValue / target : 0;
  const pace = expectedProgress > 0 ? actualProgress / expectedProgress : actualProgress > 0 ? 1 : 0;

  if (pace >= 0.8) return { status: "ON_TRACK", reason: `At ${Math.round(actualProgress * 100)}% of target, ${Math.round(pace * 100)}% of expected pace.` };
  if (pace < 0.4) return { status: "NEEDS_ATTENTION", reason: `At ${Math.round(actualProgress * 100)}% of target, only ${Math.round(pace * 100)}% of expected pace.` };
  return { status: "IN_PROGRESS", reason: `At ${Math.round(actualProgress * 100)}% of target, ${Math.round(pace * 100)}% of expected pace.` };
}

export async function businessGoalsRoutes(app: FastifyInstance) {
  const createSchema = z.object({
    businessId: z.string().min(1),
    name: z.string().min(1),
    type: z.enum(GOAL_TYPES),
    target: z.number().positive(),
    unit: z.string().min(1),
    startDate: z.string().datetime(),
    targetDate: z.string().datetime(),
    dataSource: z.enum(GOAL_DATA_SOURCES).default("MANUAL"),
  });

  app.post("/api/students/:studentId/goals", { preHandler: [requireAuth, requireStudentSelfOrPermission("Business OS", "CREATE")] }, async (request, reply) => {
    const parsed = createSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid request.", details: parsed.error.flatten() });
    if (!(await authorize(request, parsed.data.businessId, "EDIT"))) return reply.code(403).send({ error: "Forbidden: this business does not belong to you." });
    if (new Date(parsed.data.targetDate) <= new Date(parsed.data.startDate)) return reply.code(400).send({ error: "targetDate must be after startDate." });

    const ctx = request.authContext!;
    const goal = await db.goal.create({
      data: {
        goalDisplayId: await generateGoalDisplayId(),
        businessId: parsed.data.businessId,
        name: parsed.data.name,
        type: parsed.data.type,
        target: parsed.data.target,
        unit: parsed.data.unit,
        startDate: new Date(parsed.data.startDate),
        targetDate: new Date(parsed.data.targetDate),
        dataSource: parsed.data.dataSource,
        ownerId: ctx.userId,
        createdById: ctx.userId,
      },
    });
    await writeAuditLog({ action: "Goal Created", summary: `Goal "${goal.name}" created`, actorUserId: ctx.userId, entityType: "Goal", entityId: goal.id });
    return reply.code(201).send({ goal: await withDerivedStatus(goal) });
  });

  async function withDerivedStatus<T extends { id: string; businessId: string; dataSource: string; startDate: Date; targetDate: Date; target: unknown; currentValue: unknown; status: string }>(goal: T) {
    const recomputed = await recomputeIfComputed(goal);
    const merged = { ...goal, ...recomputed };
    const { status, reason } = deriveGoalStatus(merged);
    if (status !== goal.status) {
      await db.goal.update({ where: { id: goal.id }, data: { status } });
    }
    return { ...merged, status, statusReason: reason };
  }

  app.get("/api/businesses/:businessId/goals", { preHandler: [requireAuth] }, async (request, reply) => {
    const { businessId } = request.params as { businessId: string };
    if (!(await authorize(request, businessId, "VIEW"))) return reply.code(403).send({ error: "Forbidden: this business does not belong to you." });
    const rows = await db.goal.findMany({ where: { businessId }, orderBy: { createdAt: "desc" } });
    const goals = await Promise.all(rows.map((g) => withDerivedStatus(g)));
    return reply.send({ goals });
  });

  app.get("/api/goals/:id", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const goal = await db.goal.findUnique({ where: { id } });
    if (!goal) return reply.code(404).send({ error: "Goal not found." });
    if (!(await authorize(request, goal.businessId, "VIEW"))) return reply.code(403).send({ error: "Forbidden." });
    return reply.send({ goal: await withDerivedStatus(goal) });
  });

  const updateProgressSchema = z.object({ currentValue: z.number().nonnegative() });

  // MANUAL-only: a COMPUTED goal's currentValue is never hand-edited — it
  // always reflects the real underlying query (spec section 13).
  app.patch("/api/goals/:id/progress", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const goal = await db.goal.findUnique({ where: { id } });
    if (!goal) return reply.code(404).send({ error: "Goal not found." });
    if (!(await authorize(request, goal.businessId, "EDIT"))) return reply.code(403).send({ error: "Forbidden." });
    if (goal.dataSource !== "MANUAL") return reply.code(400).send({ error: `This goal's progress is computed from ${goal.dataSource}, not manually editable.` });

    const parsed = updateProgressSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid request." });
    const updated = await db.goal.update({ where: { id }, data: { currentValue: parsed.data.currentValue } });
    await writeAuditLog({ action: "Goal Progress Updated", summary: `Goal "${goal.name}" progress -> ${parsed.data.currentValue}`, actorUserId: request.authContext!.userId, entityType: "Goal", entityId: id });
    return reply.send({ goal: await withDerivedStatus(updated) });
  });

  const setStatusSchema = z.object({ status: z.enum(["PAUSED", "IN_PROGRESS"]) });

  // The only status transitions a human sets directly are PAUSED (to stop
  // the automatic pacing computation) and un-pausing back to IN_PROGRESS —
  // every other status is always derived (spec section 12).
  app.patch("/api/goals/:id/status", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const goal = await db.goal.findUnique({ where: { id } });
    if (!goal) return reply.code(404).send({ error: "Goal not found." });
    if (!(await authorize(request, goal.businessId, "EDIT"))) return reply.code(403).send({ error: "Forbidden." });
    const parsed = setStatusSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid request." });
    const updated = await db.goal.update({ where: { id }, data: { status: parsed.data.status } });
    await writeAuditLog({ action: "Goal Status Changed", summary: `Goal "${goal.name}" status -> ${parsed.data.status}`, actorUserId: request.authContext!.userId, entityType: "Goal", entityId: id });
    return reply.send({ goal: await withDerivedStatus(updated) });
  });
}
