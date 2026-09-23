// The real step-by-step flow executor (spec sections 35-38). Each call to
// advanceRun() processes one AutomationRun as far as it can go in a single
// pass — until it hits a DELAY (yields control back to the dispatcher
// worker), an EXIT, a FAILED action, or a safety cap. A run is claimed via
// a conditional status update (QUEUED/WAITING -> RUNNING) before any work
// happens, so a concurrent sweep can never process the same run twice.
//
// Idempotency (spec section 34): a node already recorded COMPLETED for
// this run is never re-executed — its prior recorded output is reused
// instead. A DELAY node specifically distinguishes "first visit" (compute
// resumeAt, go WAITING) from "resumed visit" (the wait elapsed — mark that
// step COMPLETED and move on) rather than recomputing a fresh delay.

import type { Prisma } from "@prisma/client";
import { db } from "../../db.js";
import { generateAutomationRunDisplayId } from "../sequence.js";
import { writeAuditLog } from "../../audit/log.js";
import { checkStopConditions } from "../communications/eligibility.js";
import { resolveEntityContext, evaluateConditionGroup } from "./conditions.js";
import { executeAction, sanitizeForLog } from "./actions.js";
import { resolveActionTypeForSimulation } from "./flow-helpers.js";
import type { FlowDefinition, ConditionGroup } from "./flow.js";
import crypto from "node:crypto";

const MAX_STEPS_PER_ADVANCE = 100;

export interface StartRunInput {
  automationId: string;
  automationVersionId: string;
  entityType: "Lead" | "Student";
  entityId: string;
  triggerEvent: string;
  domainEventId?: string | null;
  isTest?: boolean;
  actorUserId?: string | null;
}

export async function startRun(input: StartRunInput) {
  const run = await db.automationRun.create({
    data: {
      runDisplayId: await generateAutomationRunDisplayId(),
      automationId: input.automationId,
      automationVersionId: input.automationVersionId,
      entityType: input.entityType,
      entityId: input.entityId,
      triggerEvent: input.triggerEvent,
      domainEventId: input.domainEventId ?? null,
      correlationId: crypto.randomUUID(),
      status: "QUEUED",
      isTest: input.isTest ?? false,
    },
  });
  await writeAuditLog({
    action: "Automation Run Started",
    summary: `Run started for ${input.entityType} ${input.entityId} (trigger: ${input.triggerEvent}${input.isTest ? ", TEST MODE" : ""})`,
    actorUserId: input.actorUserId ?? undefined,
    entityType: "AutomationRun",
    entityId: run.id,
  });
  return run;
}

function resolveActionType(node: { type: string; config: Record<string, unknown> }): string {
  if (node.type === "MESSAGE") return "QUEUE_COMMUNICATION";
  return resolveActionTypeForSimulation(node as Parameters<typeof resolveActionTypeForSimulation>[0]);
}

async function createStep(
  runId: string,
  nodeId: string,
  nodeType: string,
  status: "COMPLETED" | "FAILED" | "SKIPPED" | "WAITING",
  input: unknown,
  output: unknown,
  errorMessage: string | null,
) {
  const stepIndex = await db.automationRunStep.count({ where: { runId } });
  return db.automationRunStep.create({
    data: {
      runId,
      stepIndex,
      nodeId,
      nodeType,
      status,
      inputJson: (input ?? undefined) as Prisma.InputJsonValue,
      outputJson: (output ?? undefined) as Prisma.InputJsonValue,
      errorMessage,
      completedAt: status === "WAITING" ? null : new Date(),
    },
  });
}

/** Processes ONE due run as far as it can go. Safe to call repeatedly / concurrently — claiming is a conditional update, not an in-memory lock. */
export async function advanceRun(runId: string): Promise<void> {
  const claimed = await db.automationRun.updateMany({
    where: { id: runId, status: { in: ["QUEUED", "WAITING"] }, OR: [{ resumeAt: null }, { resumeAt: { lte: new Date() } }] },
    data: { status: "RUNNING" },
  });
  if (claimed.count === 0) return;

  const run = await db.automationRun.findUniqueOrThrow({ where: { id: runId }, include: { automationVersion: true } });
  const flow = run.automationVersion.flowJson as unknown as FlowDefinition;
  const nodeById = new Map(flow.nodes.map((n) => [n.id, n]));
  const ctx = await resolveEntityContext(run.entityType as "Lead" | "Student", run.entityId);
  const exitConditions = flow.exitConditions ?? [];

  let currentNodeId: string | null = run.currentNodeId ?? flow.nodes.find((n) => n.type === "START")?.id ?? null;
  let stepsThisPass = 0;
  let finalStatus: "COMPLETED" | "FAILED" | "STOPPED" | null = null;
  let errorMessage: string | null = null;

  while (currentNodeId && stepsThisPass < MAX_STEPS_PER_ADVANCE) {
    stepsThisPass++;
    const node = nodeById.get(currentNodeId);
    if (!node) {
      finalStatus = "FAILED";
      errorMessage = `Node ${currentNodeId} not found in this version's flow.`;
      break;
    }

    if (exitConditions.length > 0 && node.type !== "EXIT") {
      const stop = await checkStopConditions(ctx.personId, exitConditions);
      if (!stop.eligible) {
        await createStep(runId, node.id, "EXIT_CONDITION", "SKIPPED", null, { reason: stop.reason }, null);
        finalStatus = "STOPPED";
        errorMessage = stop.reason ?? "Exit condition met.";
        break;
      }
    }

    const alreadyCompleted = await db.automationRunStep.findFirst({ where: { runId, nodeId: node.id, status: "COMPLETED" } });
    let stepOutput: Record<string, unknown> = {};

    if (alreadyCompleted) {
      stepOutput = (alreadyCompleted.outputJson as Record<string, unknown> | null) ?? {};
    } else if (node.type === "DELAY") {
      const waitingStep = await db.automationRunStep.findFirst({ where: { runId, nodeId: node.id, status: "WAITING" } });
      if (waitingStep) {
        await db.automationRunStep.update({ where: { id: waitingStep.id }, data: { status: "COMPLETED", completedAt: new Date() } });
      } else {
        const amount = Number((node.config as { amount?: number }).amount ?? 0);
        const unit = (node.config as { unit?: string }).unit ?? "HOURS";
        const ms = unit === "MINUTES" ? amount * 60_000 : unit === "DAYS" ? amount * 86_400_000 : amount * 3_600_000;
        const resumeAt = new Date(Date.now() + ms);
        await db.automationRun.update({ where: { id: runId }, data: { status: "WAITING", resumeAt, currentNodeId: node.id } });
        await createStep(runId, node.id, node.type, "WAITING", sanitizeForLog(node.config), null, null);
        return; // yields — the dispatcher worker resumes this run once resumeAt has passed
      }
    } else {
      try {
        if (node.type === "START" || node.type === "TRIGGER") {
          // pass-through anchor nodes — no side effect
        } else if (node.type === "CONDITION" || node.type === "DECISION") {
          const group = ((node.config as { group?: ConditionGroup }).group as ConditionGroup) ?? { op: "AND", rules: [] };
          stepOutput = { result: await evaluateConditionGroup(ctx, group) };
        } else if (node.type === "GOAL") {
          stepOutput = { goalType: (node.config as { goalType?: string }).goalType ?? null, reachedAt: new Date().toISOString() };
        } else if (node.type === "EXIT") {
          stepOutput = { reason: (node.config as { reason?: string }).reason ?? null };
        } else {
          const actionType = resolveActionType(node);
          const result = await executeAction(actionType, { ctx, runId, automationId: run.automationId, triggerEvent: run.triggerEvent, isTest: run.isTest, actorUserId: null }, { ...node.config, nodeId: node.id });
          stepOutput = { ok: result.ok, summary: result.summary, ...(result.output ?? {}) };
          if (!result.ok && (node.config as { continueOnFailure?: boolean }).continueOnFailure !== true) {
            await createStep(runId, node.id, node.type, "FAILED", sanitizeForLog(node.config), sanitizeForLog(stepOutput), result.summary);
            finalStatus = "FAILED";
            errorMessage = result.summary;
            break;
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await createStep(runId, node.id, node.type, "FAILED", sanitizeForLog(node.config), null, message);
        finalStatus = "FAILED";
        errorMessage = message;
        break;
      }
      await createStep(runId, node.id, node.type, "COMPLETED", sanitizeForLog(node.config), sanitizeForLog(stepOutput), null);
    }

    if (node.type === "EXIT") {
      finalStatus = "COMPLETED";
      break;
    }

    const outgoing = flow.edges.filter((e) => e.from === node.id);
    let nextNodeId: string | null;
    if (node.type === "CONDITION" || node.type === "DECISION") {
      const result = Boolean(stepOutput.result);
      const wantBranch = result ? ["YES", "TRUE"] : ["NO", "FALSE"];
      nextNodeId = outgoing.find((e) => e.branch && wantBranch.includes(e.branch.toUpperCase()))?.to ?? outgoing[0]?.to ?? null;
    } else {
      nextNodeId = outgoing[0]?.to ?? null;
    }

    currentNodeId = nextNodeId;
    await db.automationRun.update({ where: { id: runId }, data: { currentNodeId } });
    if (!currentNodeId) {
      finalStatus = "COMPLETED";
      break;
    }
  }

  if (!finalStatus && stepsThisPass >= MAX_STEPS_PER_ADVANCE) {
    finalStatus = "FAILED";
    errorMessage = "Exceeded the maximum steps allowed in a single execution pass — possible runaway flow.";
  }

  await db.automationRun.update({
    where: { id: runId },
    data: { status: finalStatus ?? "RUNNING", errorMessage, completedAt: finalStatus ? new Date() : null },
  });
}

/** Manual cancel (spec section 84's PAUSE / cancel intent applied to a single in-flight run). */
export async function cancelRun(runId: string, actorUserId: string): Promise<void> {
  const run = await db.automationRun.findUniqueOrThrow({ where: { id: runId } });
  if (run.status === "COMPLETED" || run.status === "FAILED" || run.status === "CANCELLED" || run.status === "STOPPED") return;
  await db.automationRun.update({ where: { id: runId }, data: { status: "CANCELLED", completedAt: new Date() } });
  await writeAuditLog({ action: "Automation Run Cancelled", summary: `Run ${run.runDisplayId} cancelled`, actorUserId, entityType: "AutomationRun", entityId: runId });
}

/** Safe retry (spec section 82) — only a FAILED run may be retried, and only from its NEXT unexecuted node; already-COMPLETED steps are never re-executed (the alreadyCompleted guard in advanceRun above). */
export async function retryRun(runId: string, actorUserId: string): Promise<void> {
  const run = await db.automationRun.findUniqueOrThrow({ where: { id: runId } });
  if (run.status !== "FAILED") throw new Error(`Cannot retry a run with status ${run.status} — only FAILED runs may be retried.`);
  await db.automationRun.update({ where: { id: runId }, data: { status: "QUEUED", errorMessage: null } });
  await writeAuditLog({ action: "Automation Run Retried", summary: `Run ${run.runDisplayId} retried`, actorUserId, entityType: "AutomationRun", entityId: runId });
  await advanceRun(runId);
}
