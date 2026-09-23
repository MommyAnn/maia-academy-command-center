import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "../../db.js";
import { requireAuth, requirePermission, requireStudentSelfOrPermission } from "../../rbac/middleware.js";
import { writeAuditLog } from "../../audit/log.js";
import * as ghl from "../ghl/client.js";
import { checkCommunicationEligibility, checkTemplateApproved, type CommunicationChannel } from "./eligibility.js";
import { renderTemplateBody, sampleValues, resolvePersonValues } from "./templates.js";

const CHANNELS = ["Email", "SMS", "WhatsApp", "Manual Viber", "Manual Messenger", "Other"] as const;

const templateSchema = z.object({
  name: z.string().min(1),
  channel: z.enum(CHANNELS),
  purpose: z.string().optional(),
  audience: z.string().optional(),
  body: z.string().min(1),
  variables: z.array(z.string()).default([]),
});

const templateUpdateSchema = templateSchema.partial();

const ruleSchema = z.object({
  name: z.string().min(1),
  triggerEvent: z.string().min(1),
  condition: z.record(z.string(), z.unknown()).optional(),
  actions: z.record(z.string(), z.unknown()),
  stopConditions: z.array(z.string()).default([]),
});

const ruleUpdateSchema = ruleSchema.partial();

const sendSchema = z.object({
  personId: z.string().min(1),
  channel: z.enum(["Email", "SMS", "WhatsApp"]),
  templateId: z.string().min(1),
});

const bulkPreviewSchema = z.object({
  personIds: z.array(z.string().min(1)).min(1).max(500),
  channel: z.enum(["Email", "SMS", "WhatsApp"]),
  templateId: z.string().min(1),
});

const bulkSendSchema = bulkPreviewSchema.extend({ confirm: z.literal(true) });

export async function communicationsRoutes(app: FastifyInstance) {
  // --- Message templates (spec sections 46-48) ---------------------------

  app.get("/api/communications/templates", { preHandler: [requireAuth, requirePermission("Communications - Templates", "VIEW")] }, async (request, reply) => {
    const { channel, status } = request.query as { channel?: string; status?: string };
    const templates = await db.messageTemplate.findMany({ where: { channel: channel || undefined, status: status || undefined }, orderBy: { updatedAt: "desc" } });
    return reply.send({ templates });
  });

  app.post("/api/communications/templates", { preHandler: [requireAuth, requirePermission("Communications - Templates", "CREATE")] }, async (request, reply) => {
    const parsed = templateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid template.", details: parsed.error.flatten() });
    const template = await db.messageTemplate.create({
      data: {
        name: parsed.data.name,
        channel: parsed.data.channel,
        purpose: parsed.data.purpose,
        audience: parsed.data.audience,
        body: parsed.data.body,
        variablesJson: parsed.data.variables,
        status: "Draft",
        createdById: request.authContext!.userId,
        updatedById: request.authContext!.userId,
      },
    });
    await writeAuditLog({ action: "Message Template Changed", summary: `Template "${template.name}" created`, actorUserId: request.authContext!.userId, entityType: "MessageTemplate", entityId: template.id });
    return reply.code(201).send({ template });
  });

  app.patch("/api/communications/templates/:id", { preHandler: [requireAuth, requirePermission("Communications - Templates", "EDIT")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = templateUpdateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid template update.", details: parsed.error.flatten() });
    const existing = await db.messageTemplate.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ error: "Template not found." });

    const template = await db.messageTemplate.update({
      where: { id },
      data: {
        name: parsed.data.name,
        channel: parsed.data.channel,
        purpose: parsed.data.purpose,
        audience: parsed.data.audience,
        body: parsed.data.body,
        variablesJson: parsed.data.variables,
        version: existing.version + 1,
        updatedById: request.authContext!.userId,
      },
    });
    await writeAuditLog({ action: "Message Template Changed", summary: `Template "${template.name}" updated (v${template.version})`, actorUserId: request.authContext!.userId, entityType: "MessageTemplate", entityId: template.id });
    return reply.send({ template });
  });

  app.post("/api/communications/templates/:id/publish", { preHandler: [requireAuth, requirePermission("Communications - Templates", "EDIT")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const template = await db.messageTemplate.update({ where: { id }, data: { status: "Active", updatedById: request.authContext!.userId } });
    await writeAuditLog({ action: "Message Template Changed", summary: `Template "${template.name}" published (Active)`, actorUserId: request.authContext!.userId, entityType: "MessageTemplate", entityId: template.id });
    return reply.send({ template });
  });

  app.post("/api/communications/templates/:id/archive", { preHandler: [requireAuth, requirePermission("Communications - Templates", "EDIT")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const template = await db.messageTemplate.update({ where: { id }, data: { status: "Archived", updatedById: request.authContext!.userId } });
    await writeAuditLog({ action: "Message Template Changed", summary: `Template "${template.name}" archived`, actorUserId: request.authContext!.userId, entityType: "MessageTemplate", entityId: template.id });
    return reply.send({ template });
  });

  // Safe preview: synthetic sample data ONLY, never a real contact (spec
  // section 48) — this route accepts no personId at all, by design.
  app.get("/api/communications/templates/:id/preview", { preHandler: [requireAuth, requirePermission("Communications - Templates", "VIEW")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const template = await db.messageTemplate.findUnique({ where: { id } });
    if (!template) return reply.code(404).send({ error: "Template not found." });
    const rendered = renderTemplateBody(template.body, template.variablesJson as string[] | null, sampleValues());
    return reply.send({ rendered, usedSampleData: true });
  });

  // --- Automation rules (spec sections 49-51) -----------------------------

  app.get("/api/communications/automation-rules", { preHandler: [requireAuth, requirePermission("Communications - Automation", "VIEW")] }, async (_request, reply) => {
    const rules = await db.automationRule.findMany({ orderBy: { updatedAt: "desc" } });
    return reply.send({ rules });
  });

  app.post("/api/communications/automation-rules", { preHandler: [requireAuth, requirePermission("Communications - Automation", "CREATE")] }, async (request, reply) => {
    const parsed = ruleSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid automation rule.", details: parsed.error.flatten() });
    const rule = await db.automationRule.create({
      data: {
        name: parsed.data.name,
        triggerEvent: parsed.data.triggerEvent,
        conditionJson: parsed.data.condition as Prisma.InputJsonValue | undefined,
        actionsJson: parsed.data.actions as Prisma.InputJsonValue,
        stopConditionsJson: parsed.data.stopConditions as Prisma.InputJsonValue,
        status: "Draft",
        createdById: request.authContext!.userId,
      },
    });
    await writeAuditLog({ action: "Automation Rule Changed", summary: `Automation rule "${rule.name}" created (Draft)`, actorUserId: request.authContext!.userId, entityType: "AutomationRule", entityId: rule.id });
    return reply.code(201).send({ rule });
  });

  app.patch("/api/communications/automation-rules/:id", { preHandler: [requireAuth, requirePermission("Communications - Automation", "EDIT")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = ruleUpdateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid automation rule update.", details: parsed.error.flatten() });
    const rule = await db.automationRule.update({
      where: { id },
      data: {
        name: parsed.data.name,
        triggerEvent: parsed.data.triggerEvent,
        conditionJson: parsed.data.condition as Prisma.InputJsonValue | undefined,
        actionsJson: parsed.data.actions as Prisma.InputJsonValue | undefined,
        stopConditionsJson: parsed.data.stopConditions as Prisma.InputJsonValue | undefined,
      },
    });
    await writeAuditLog({ action: "Automation Rule Changed", summary: `Automation rule "${rule.name}" updated`, actorUserId: request.authContext!.userId, entityType: "AutomationRule", entityId: rule.id });
    return reply.send({ rule });
  });

  for (const [path, status] of [["activate", "Active"], ["pause", "Paused"], ["archive", "Archived"]] as const) {
    app.post(`/api/communications/automation-rules/:id/${path}`, { preHandler: [requireAuth, requirePermission("Communications - Automation", "EDIT")] }, async (request, reply) => {
      const { id } = request.params as { id: string };
      const rule = await db.automationRule.update({ where: { id }, data: { status } });
      await writeAuditLog({ action: "Automation Rule Changed", summary: `Automation rule "${rule.name}" set to ${status}`, actorUserId: request.authContext!.userId, entityType: "AutomationRule", entityId: rule.id });
      return reply.send({ rule });
    });
  }

  // --- Communication logs (spec section 52) -------------------------------

  app.get("/api/communications/logs", { preHandler: [requireAuth, requirePermission("Communications", "VIEW")] }, async (request, reply) => {
    const { status, channel, personId } = request.query as { status?: string; channel?: string; personId?: string };
    const logs = await db.communicationLog.findMany({
      where: { status: status || undefined, channel: channel || undefined, personId: personId || undefined },
      orderBy: { queuedAt: "desc" },
      take: 200,
    });
    return reply.send({ logs });
  });

  app.get("/api/students/:studentId/communications", { preHandler: [requireAuth, requireStudentSelfOrPermission("Communications", "VIEW")] }, async (request, reply) => {
    const { studentId } = request.params as { studentId: string };
    const logs = await db.communicationLog.findMany({ where: { studentId }, orderBy: { queuedAt: "desc" } });
    return reply.send({ logs });
  });

  app.get("/api/leads/:leadId/communications", { preHandler: [requireAuth, requirePermission("Communications", "VIEW")] }, async (request, reply) => {
    const { leadId } = request.params as { leadId: string };
    const logs = await db.communicationLog.findMany({ where: { leadId }, orderBy: { queuedAt: "desc" } });
    return reply.send({ logs });
  });

  // --- Manual send (spec sections 43-45, 53-54) ---------------------------
  // Always two explicit steps: preview (no side effects), then send. There
  // is no single "one click" endpoint that both decides and dispatches.

  app.post("/api/communications/send/preview", { preHandler: [requireAuth, requirePermission("Communications", "CREATE")] }, async (request, reply) => {
    const parsed = sendSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid send request.", details: parsed.error.flatten() });
    const preview = await buildSendPreview(parsed.data.personId, parsed.data.channel, parsed.data.templateId);
    return reply.send(preview);
  });

  app.post("/api/communications/send", { preHandler: [requireAuth, requirePermission("Communications", "CREATE")] }, async (request, reply) => {
    const parsed = sendSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid send request.", details: parsed.error.flatten() });
    const log = await executeSend(parsed.data.personId, parsed.data.channel, parsed.data.templateId, request.authContext!.userId);
    await writeAuditLog({ action: "Message Sent", summary: `Manual ${parsed.data.channel} send to person ${parsed.data.personId}: ${log.status}`, actorUserId: request.authContext!.userId, entityType: "CommunicationLog", entityId: log.id });
    return reply.code(201).send({ log });
  });

  // --- Bulk send (spec section 56) ----------------------------------------
  // Audience Preview, Recipient Count, Channel Eligibility, Excluded
  // Contacts, and Template Preview are all in the SAME preview response —
  // there is deliberately no path that skips straight to sending.

  app.post("/api/communications/bulk-send/preview", { preHandler: [requireAuth, requirePermission("Communications", "CREATE")] }, async (request, reply) => {
    const parsed = bulkPreviewSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid bulk send request.", details: parsed.error.flatten() });

    const template = await db.messageTemplate.findUnique({ where: { id: parsed.data.templateId } });
    const templateCheck = checkTemplateApproved(template);
    const excluded: { personId: string; reason: string }[] = [];
    const eligible: string[] = [];

    for (const personId of parsed.data.personIds) {
      const eligibility = await checkCommunicationEligibility(personId, parsed.data.channel);
      if (!eligibility.eligible) {
        excluded.push({ personId, reason: eligibility.reason });
      } else if (!templateCheck.eligible) {
        excluded.push({ personId, reason: templateCheck.reason });
      } else {
        eligible.push(personId);
      }
    }

    return reply.send({
      recipientCount: parsed.data.personIds.length,
      eligibleCount: eligible.length,
      excludedContacts: excluded,
      templatePreview: template ? renderTemplateBody(template.body, template.variablesJson as string[] | null, sampleValues()) : null,
      channel: parsed.data.channel,
    });
  });

  app.post("/api/communications/bulk-send", { preHandler: [requireAuth, requirePermission("Communications", "CREATE")] }, async (request, reply) => {
    const parsed = bulkSendSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid bulk send request — explicit confirm:true is required.", details: parsed.error.flatten() });

    const results = { sent: 0, skipped: 0, failed: 0 };
    for (const personId of parsed.data.personIds) {
      const log = await executeSend(personId, parsed.data.channel, parsed.data.templateId, request.authContext!.userId);
      if (log.status === "Sent" || log.status === "Queued") results.sent++;
      else if (log.status === "Skipped") results.skipped++;
      else results.failed++;
    }

    await writeAuditLog({
      action: "Bulk Message Sent",
      summary: `Bulk ${parsed.data.channel} send to ${parsed.data.personIds.length} contacts: ${results.sent} sent, ${results.skipped} skipped, ${results.failed} failed`,
      actorUserId: request.authContext!.userId,
      entityType: "MessageTemplate",
      entityId: parsed.data.templateId,
    });
    return reply.send(results);
  });
}

async function buildSendPreview(personId: string, channel: CommunicationChannel, templateId: string) {
  const [eligibility, template] = await Promise.all([checkCommunicationEligibility(personId, channel), db.messageTemplate.findUnique({ where: { id: templateId } })]);
  const templateCheck = checkTemplateApproved(template);
  const values = await resolvePersonValues(personId);
  return {
    eligible: eligibility.eligible && templateCheck.eligible,
    reason: !eligibility.eligible ? eligibility.reason : !templateCheck.eligible ? templateCheck.reason : undefined,
    rendered: template ? renderTemplateBody(template.body, template.variablesJson as string[] | null, values) : null,
  };
}

// Exported for reuse by the Phase 12 Automation Studio's QUEUE_COMMUNICATION
// action (automation/actions.ts) — the SAME eligibility/template/GHL-send
// path a manual staff send uses, never a second parallel implementation
// (spec section 53's "do not create a second independent GHL integration"
// applies just as much to the send path itself as to the API client).
export async function executeSend(personId: string, channel: "Email" | "SMS" | "WhatsApp", templateId: string, actorUserId: string | null, triggerEvent: string = "Manual") {
  const [eligibility, template, person, lead, student, contactMap] = await Promise.all([
    checkCommunicationEligibility(personId, channel),
    db.messageTemplate.findUnique({ where: { id: templateId } }),
    db.person.findUnique({ where: { id: personId } }),
    db.lead.findUnique({ where: { personId } }),
    db.student.findUnique({ where: { personId } }),
    db.ghlContactMap.findUnique({ where: { personId } }),
  ]);
  const templateCheck = checkTemplateApproved(template);

  const baseLog = { personId, leadId: lead?.id ?? null, studentId: student?.id ?? null, channel, templateId, triggerEvent, provider: "GHL", sentById: actorUserId ?? undefined };

  if (!eligibility.eligible || !templateCheck.eligible) {
    const reason = !eligibility.eligible ? eligibility.reason : !templateCheck.eligible ? templateCheck.reason : undefined;
    return db.communicationLog.create({ data: { ...baseLog, status: "Skipped", reason } });
  }
  if (!person) {
    return db.communicationLog.create({ data: { ...baseLog, status: "Skipped", reason: "Unknown contact." } });
  }
  if (!contactMap?.ghlContactId) {
    return db.communicationLog.create({ data: { ...baseLog, status: "Skipped", reason: "Contact has not yet been synced to GHL — no GHL contact id on file." } });
  }

  const values = await resolvePersonValues(personId);
  const rendered = renderTemplateBody(template!.body, template!.variablesJson as string[] | null, values);

  const result = await ghl.sendMessage({
    contactId: contactMap.ghlContactId,
    type: channel,
    message: channel !== "Email" ? rendered : undefined,
    subject: channel === "Email" ? template!.name : undefined,
    html: channel === "Email" ? rendered : undefined,
  });

  if (!result.ok) {
    if (result.status === "NOT_CONFIGURED") {
      return db.communicationLog.create({ data: { ...baseLog, status: "Skipped", reason: "GHL integration is not configured on this server." } });
    }
    return db.communicationLog.create({ data: { ...baseLog, status: "Failed", reason: result.message, failedAt: new Date() } });
  }

  return db.communicationLog.create({ data: { ...baseLog, status: "Sent", externalMessageId: result.data.messageId, sentAt: new Date() } });
}
