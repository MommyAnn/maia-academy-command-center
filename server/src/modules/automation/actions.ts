// Real action executors (spec sections 18-21, 34, 38) — every action here
// either reuses an EXISTING write path from an earlier phase (Task/
// autoTriggerKey idempotency, CommunicationLog's executeSend, GHL's client,
// FollowUp, Lead pipeline history, CourseAccessGrant's own entitlement
// rule) or is a small, genuinely new capability (EntityTag). No action here
// can change a payment's status, issue a refund, delete a record, or mass-
// message — those simply are not represented in ACTION_TYPES (flow.ts).
// Every result here is written into AutomationRunStep.outputJson through
// sanitizeForLog, which strips anything that looks like a credential.

import { db } from "../../db.js";
import { recordDomainEvent, type DomainEventType } from "../events.js";
import { writeAuditLog } from "../../audit/log.js";
import { moveLeadStage } from "../leads/pipeline.js";
import { executeSend } from "../communications/routes.js";
import * as ghl from "../ghl/client.js";
import { generateFeedbackRequestDisplayId } from "../sequence.js";
import type { EntityContext } from "./conditions.js";
import type { LeadStage } from "@prisma/client";

export interface ActionExecutionContext {
  ctx: EntityContext;
  runId: string;
  automationId: string;
  triggerEvent: string;
  isTest: boolean;
  actorUserId: string | null;
}

export interface ActionResult {
  ok: boolean;
  summary: string;
  output?: Record<string, unknown>;
}

const SECRET_KEY_PATTERN = /token|secret|password|apikey|api_key|credential|authorization/i;

/** Strips anything that looks like a credential before it is ever persisted to AutomationRunStep (spec section 38). */
export function sanitizeForLog(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(sanitizeForLog);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SECRET_KEY_PATTERN.test(key) ? "[REDACTED]" : sanitizeForLog(v);
    }
    return out;
  }
  return value;
}

async function actionCreateTask(exec: ActionExecutionContext, params: Record<string, unknown>): Promise<ActionResult> {
  const title = (params.title as string) ?? `Automation task for ${exec.ctx.entityType} ${exec.ctx.entityId}`;
  const assignedUserId = params.assignedToId as string | undefined;
  const dedupeKey = `automation-run:${exec.runId}:${params.nodeId ?? "task"}`;

  if (exec.isTest) return { ok: true, summary: `[TEST MODE] Would create task "${title}".`, output: { title, assignedUserId } };
  if (!assignedUserId) return { ok: false, summary: "CREATE_TASK requires an assignedToId — automation may not create an unowned task." };

  // Task.createdById/assignedToId are both real FKs to Staff, not User (same
  // User -> Person -> Staff resolution follow-ups/routes.ts already uses for
  // its own auto-created tasks) — never invented, never left null.
  const assignedUser = await db.user.findUnique({ where: { id: assignedUserId } });
  const staff = assignedUser ? await db.staff.findUnique({ where: { personId: assignedUser.personId } }) : null;
  if (!staff) return { ok: false, summary: "assignedToId does not resolve to a Staff record — cannot create task." };

  const task = await db.task.upsert({
    where: { autoTriggerKey: dedupeKey },
    update: {},
    create: {
      taskDisplayId: `TASK-AUTO-${exec.runId.slice(0, 8)}-${(params.nodeId as string) ?? "n"}`,
      title,
      status: "Open",
      priority: (params.priority as string) ?? "Normal",
      createdById: staff.id,
      assignedToId: staff.id,
      autoTriggerKey: dedupeKey,
    },
  });
  return { ok: true, summary: `Task "${title}" created (or already existed for this run/step).`, output: { taskId: task.id } };
}

async function actionAddOrRemoveTag(exec: ActionExecutionContext, params: Record<string, unknown>, remove: boolean): Promise<ActionResult> {
  const tag = params.tag as string;
  if (!tag) return { ok: false, summary: "No tag specified." };
  if (exec.isTest) return { ok: true, summary: `[TEST MODE] Would ${remove ? "remove" : "add"} tag "${tag}".` };

  if (remove) {
    await db.entityTag.deleteMany({ where: { entityType: exec.ctx.entityType, entityId: exec.ctx.entityId, tag } });
  } else {
    await db.entityTag.upsert({
      where: { entityType_entityId_tag: { entityType: exec.ctx.entityType, entityId: exec.ctx.entityId, tag } },
      update: {},
      create: { entityType: exec.ctx.entityType, entityId: exec.ctx.entityId, tag, addedById: exec.actorUserId },
    });
  }
  return { ok: true, summary: `Tag "${tag}" ${remove ? "removed" : "added"}.` };
}

async function actionGrantCourseAccess(exec: ActionExecutionContext, params: Record<string, unknown>): Promise<ActionResult> {
  const courseId = params.courseId as string;
  if (!exec.ctx.student) return { ok: false, summary: "This entity has no Student record — course access requires a Student." };
  if (!courseId) return { ok: false, summary: "No courseId specified." };

  // Never AI opinion, never automation opinion — the SAME configured
  // Package→Course entitlement table every manual grant is also checked
  // against would need to apply here too; this is stricter than the
  // existing manual staff route, by design (spec section 75).
  const mapped = await db.packageCourseAccess.findUnique({ where: { packageId_courseId: { packageId: exec.ctx.student.packageId, courseId } } });
  if (!mapped) {
    return { ok: false, summary: "This course is not mapped to the student's current Package — automation may not grant access outside configured entitlement rules." };
  }
  if (exec.isTest) return { ok: true, summary: `[TEST MODE] Would grant course access (courseId=${courseId}).` };

  const grant = await db.courseAccessGrant.upsert({
    where: { studentId_courseId: { studentId: exec.ctx.student.id, courseId } },
    update: { status: "Active", revokedAt: null, revokedById: null, source: "Automation" },
    create: { studentId: exec.ctx.student.id, courseId, source: "Automation", grantedById: exec.actorUserId ?? "system" },
  });
  await writeAuditLog({ action: "Course Access Granted", summary: `Course access granted by Automation Studio`, actorUserId: exec.actorUserId ?? undefined, entityType: "CourseAccessGrant", entityId: grant.id });
  await recordDomainEvent("COURSE_ACCESS_GRANTED", { studentId: exec.ctx.student.id, courseId });
  return { ok: true, summary: "Course access granted.", output: { grantId: grant.id } };
}

async function actionRequestFeedback(exec: ActionExecutionContext, params: Record<string, unknown>): Promise<ActionResult> {
  if (!exec.ctx.student) return { ok: false, summary: "This entity has no Student record — feedback requests require a Student." };
  const title = (params.title as string) ?? "Automated Feedback Request";
  if (exec.isTest) return { ok: true, summary: `[TEST MODE] Would create feedback request "${title}".` };

  const request = await db.feedbackRequest.create({
    data: {
      requestDisplayId: await generateFeedbackRequestDisplayId(),
      title,
      sourceType: (params.sourceType as string) ?? "Other",
      audience: "Individual Student",
      audienceStudentId: exec.ctx.student.id,
      questionsJson: (params.questions as unknown) ?? [],
      createdById: exec.actorUserId ?? undefined,
    },
  });
  return { ok: true, summary: `Feedback request "${title}" created.`, output: { feedbackRequestId: request.id } };
}

async function actionQueueCommunication(exec: ActionExecutionContext, params: Record<string, unknown>): Promise<ActionResult> {
  const channel = params.channel as "Email" | "SMS" | "WhatsApp";
  const templateId = params.templateId as string;
  if (!channel || !templateId) return { ok: false, summary: "Message node is missing a channel or template." };
  if (exec.isTest) return { ok: true, summary: `[TEST MODE] Would send ${channel} using template ${templateId} — no real message is ever sent in TEST MODE.` };

  const log = await executeSend(exec.ctx.personId, channel, templateId, exec.actorUserId, exec.triggerEvent);
  return { ok: log.status === "Sent" || log.status === "Queued", summary: `Message ${log.status.toLowerCase()}${log.reason ? `: ${log.reason}` : "."}`, output: { communicationLogId: log.id, status: log.status } };
}

async function actionCallWebhook(exec: ActionExecutionContext, params: Record<string, unknown>): Promise<ActionResult> {
  const url = params.url as string;
  if (!url) return { ok: false, summary: "No webhook URL configured." };
  if (exec.isTest) return { ok: true, summary: `[TEST MODE] Would POST to ${url} — no real HTTP call is made in TEST MODE.` };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, {
      method: (params.method as string) ?? "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entityType: exec.ctx.entityType, entityId: exec.ctx.entityId, triggerEvent: exec.triggerEvent, ...((params.body as object) ?? {}) }),
      signal: controller.signal,
    });
    return { ok: response.ok, summary: `Webhook responded ${response.status}.`, output: { status: response.status } };
  } catch (err) {
    return { ok: false, summary: `Webhook call failed: ${err instanceof Error ? err.message : String(err)}` };
  } finally {
    clearTimeout(timeout);
  }
}

async function actionSyncGhlContact(exec: ActionExecutionContext): Promise<ActionResult> {
  if (exec.isTest) return { ok: true, summary: "[TEST MODE] Would sync contact to GHL — no real API call is made in TEST MODE." };
  const person = await db.person.findUnique({ where: { id: exec.ctx.personId } });
  if (!person) return { ok: false, summary: "Unknown contact." };
  if (!person.email && !person.contactNumber) return { ok: false, summary: "Contact has no email or phone number — cannot sync to GHL." };

  const [firstName, ...rest] = person.fullName.trim().split(/\s+/);
  const result = await ghl.upsertContact({ email: person.email ?? undefined, phone: person.contactNumber ?? undefined, firstName, lastName: rest.join(" ") || undefined });
  if (!result.ok) return { ok: false, summary: `GHL sync failed: ${result.message}` };

  await db.ghlContactMap.upsert({
    where: { personId: exec.ctx.personId },
    update: { ghlContactId: result.data.contactId, syncStatus: "SYNCED", lastSyncedAt: new Date(), lastSyncDirection: "Outbound", lastError: null },
    create: { personId: exec.ctx.personId, ghlContactId: result.data.contactId, syncStatus: "SYNCED", lastSyncedAt: new Date(), lastSyncDirection: "Outbound" },
  });
  return { ok: true, summary: "Contact synced to GHL.", output: { ghlContactId: result.data.contactId } };
}

async function actionCreateFollowUp(exec: ActionExecutionContext, params: Record<string, unknown>): Promise<ActionResult> {
  if (!exec.ctx.lead) return { ok: false, summary: "This entity has no Lead record — follow-ups require a Lead." };
  const scheduledFor = params.scheduledFor ? new Date(params.scheduledFor as string) : new Date();
  if (exec.isTest) return { ok: true, summary: "[TEST MODE] Would create a follow-up." };

  const followUp = await db.followUp.create({
    data: {
      leadId: exec.ctx.lead.id,
      purpose: (params.purpose as string) ?? null,
      channel: (params.channel as string) ?? "Other",
      scheduledFor,
      assignedStaffId: (params.assignedStaffId as string) ?? null,
      createdById: exec.actorUserId ?? undefined,
    },
  });
  return { ok: true, summary: "Follow-up created.", output: { followUpId: followUp.id } };
}

async function actionAddInternalNote(exec: ActionExecutionContext, params: Record<string, unknown>): Promise<ActionResult> {
  const note = (params.note as string) ?? "Automated note.";
  if (exec.isTest) return { ok: true, summary: "[TEST MODE] Would add an internal note." };

  if (exec.ctx.entityType === "Lead") {
    await db.leadNote.create({ data: { leadId: exec.ctx.entityId, authorId: exec.actorUserId ?? "system", note } });
  } else {
    await db.studentNote.create({ data: { studentId: exec.ctx.entityId, authorId: exec.actorUserId ?? "system", note } });
  }
  return { ok: true, summary: "Internal note added." };
}

async function actionUpdateInternalStatus(exec: ActionExecutionContext, params: Record<string, unknown>): Promise<ActionResult> {
  if (!exec.ctx.lead) return { ok: false, summary: "Internal status updates are only supported for a Lead's pipeline stage today." };
  const stage = params.stage as LeadStage;
  if (!stage) return { ok: false, summary: "No stage specified." };
  if (exec.isTest) return { ok: true, summary: `[TEST MODE] Would move Lead pipeline stage to ${stage}.` };

  const updated = await moveLeadStage(db, exec.ctx.lead.id, stage, exec.actorUserId, `Automation`);
  return { ok: true, summary: `Lead pipeline stage set to ${stage}.`, output: { pipelineStage: updated.pipelineStage } };
}

async function actionAssignStaff(exec: ActionExecutionContext, params: Record<string, unknown>): Promise<ActionResult> {
  const staffUserId = params.staffUserId as string;
  if (!staffUserId) return { ok: false, summary: "No staff specified." };
  return actionCreateTask(exec, { ...params, assignedToId: staffUserId, title: (params.title as string) ?? `Assigned: ${exec.ctx.entityType} ${exec.ctx.entityId}`, nodeId: `${params.nodeId ?? "assign"}` });
}

export async function executeAction(actionType: string, exec: ActionExecutionContext, params: Record<string, unknown>): Promise<ActionResult> {
  switch (actionType) {
    case "CREATE_TASK":
      return actionCreateTask(exec, params);
    case "ASSIGN_STAFF":
      return actionAssignStaff(exec, params);
    case "UPDATE_INTERNAL_STATUS":
      return actionUpdateInternalStatus(exec, params);
    case "ADD_INTERNAL_NOTE":
      return actionAddInternalNote(exec, params);
    case "ADD_TAG":
      return actionAddOrRemoveTag(exec, params, false);
    case "REMOVE_TAG":
      return actionAddOrRemoveTag(exec, params, true);
    case "GRANT_COURSE_ACCESS":
      return actionGrantCourseAccess(exec, params);
    case "REQUEST_FEEDBACK":
      return actionRequestFeedback(exec, params);
    case "QUEUE_COMMUNICATION":
      return actionQueueCommunication(exec, params);
    case "CALL_WEBHOOK":
      return actionCallWebhook(exec, params);
    case "SYNC_GHL_CONTACT":
      return actionSyncGhlContact(exec);
    case "CREATE_FOLLOW_UP":
      return actionCreateFollowUp(exec, params);
    default:
      return { ok: false, summary: `Unsupported action type: ${actionType}` };
  }
}

// Re-exported so the executor can record a DomainEvent type check without a
// second import path.
export type { DomainEventType };
