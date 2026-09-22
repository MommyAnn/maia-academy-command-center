// ADMIN -> GHL INTEGRATION screen backend (spec sections 4-13, 58) — real
// config, real mapping tables, real health counts, all server-side
// permission-enforced. Never returns a raw secret (spec section 3): the
// response for config always reports whether a credential is configured,
// never its value.

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../../db.js";
import { requireAuth, requirePermission } from "../../rbac/middleware.js";
import { writeAuditLog } from "../../audit/log.js";
import * as ghl from "./client.js";
import { processOutboxEvent, runOutboxSweep } from "./outbox.js";

const CONFIG_ID = "singleton";

const configUpdateSchema = z.object({
  connectionMode: z.enum(["PRIVATE_INTEGRATION", "OAUTH"]).optional(),
  locationId: z.string().min(1).nullable().optional(),
  operatingMode: z.enum(["TEST", "PRODUCTION"]).optional(),
  testContactIds: z.array(z.string()).optional(),
});

const tagMappingSchema = z.object({ eventKey: z.string().min(1), ghlTagName: z.string().min(1), isActive: z.boolean().default(true) });
const customFieldMappingSchema = z.object({ maiaField: z.string().min(1), ghlFieldId: z.string().min(1), isActive: z.boolean().default(true) });
const workflowMappingSchema = z.object({ eventKey: z.string().min(1), ghlWorkflowId: z.string().min(1), isActive: z.boolean().default(true) });

async function getOrCreateConfig() {
  return db.ghlIntegrationConfig.upsert({
    where: { id: CONFIG_ID },
    update: {},
    create: { id: CONFIG_ID, updatedAt: new Date() },
  });
}

export async function ghlAdminRoutes(app: FastifyInstance) {
  app.get("/api/ghl/config", { preHandler: [requireAuth, requirePermission("Communications - GHL Integration", "VIEW")] }, async (_request, reply) => {
    const config = await getOrCreateConfig();
    // Never the token/key themselves — only whether the server has them set.
    return reply.send({
      config,
      credentialsConfigured: ghl.isGhlConfigured(),
      webhookSignatureConfigured: !!process.env.GHL_WEBHOOK_SIGNATURE_PUBLIC_KEY,
    });
  });

  app.patch("/api/ghl/config", { preHandler: [requireAuth, requirePermission("Communications - GHL Integration", "EDIT")] }, async (request, reply) => {
    const parsed = configUpdateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid configuration.", details: parsed.error.flatten() });

    // Production mode never auto-switches and never activates without a
    // real, configured credential (spec sections 57-58) — this is the one
    // explicit gate a human admin must clear.
    if (parsed.data.operatingMode === "PRODUCTION" && !ghl.isGhlConfigured()) {
      return reply.code(422).send({ error: "Cannot switch to PRODUCTION mode: GHL credentials are not configured on this server." });
    }

    const config = await db.ghlIntegrationConfig.upsert({
      where: { id: CONFIG_ID },
      update: {
        connectionMode: parsed.data.connectionMode,
        locationId: parsed.data.locationId,
        operatingMode: parsed.data.operatingMode,
        testContactIdsJson: parsed.data.testContactIds,
        updatedById: request.authContext!.userId,
      },
      create: {
        id: CONFIG_ID,
        connectionMode: parsed.data.connectionMode ?? undefined,
        locationId: parsed.data.locationId ?? undefined,
        operatingMode: parsed.data.operatingMode ?? undefined,
        testContactIdsJson: parsed.data.testContactIds,
        updatedById: request.authContext!.userId,
        updatedAt: new Date(),
      },
    });

    await writeAuditLog({ action: "GHL Configuration Changed", summary: "GHL integration configuration updated", actorUserId: request.authContext!.userId, entityType: "GhlIntegrationConfig", entityId: config.id });
    return reply.send({ config });
  });

  // Safe authenticated test (spec section 5) — read-only, and only ever
  // returns one of the enumerated statuses, never a raw provider response.
  app.post("/api/ghl/test-connection", { preHandler: [requireAuth, requirePermission("Communications - GHL Integration", "EDIT")] }, async (request, reply) => {
    const result = await ghl.testConnection();
    const status = result.ok ? "CONNECTED" : result.status;

    const config = await db.ghlIntegrationConfig.upsert({
      where: { id: CONFIG_ID },
      update: { status, lastSuccessfulConnectionAt: result.ok ? new Date() : undefined, updatedById: request.authContext!.userId },
      create: { id: CONFIG_ID, status, lastSuccessfulConnectionAt: result.ok ? new Date() : undefined, updatedById: request.authContext!.userId, updatedAt: new Date() },
    });

    await writeAuditLog({ action: "GHL Connection Tested", summary: `GHL connection test result: ${status}`, actorUserId: request.authContext!.userId, entityType: "GhlIntegrationConfig", entityId: config.id });
    return reply.send({ status, message: result.ok ? "Connection succeeded." : result.message });
  });

  // Integration health (spec section 4) — every count is a live query,
  // never a cached/simulated figure.
  app.get("/api/ghl/health", { preHandler: [requireAuth, requirePermission("Communications - GHL Integration", "VIEW")] }, async (_request, reply) => {
    const [queued, retrying, success, deadLetter, webhooksReceived, webhooksRejected, lastWebhookAt] = await Promise.all([
      db.integrationOutboxEvent.count({ where: { status: "QUEUED" } }),
      db.integrationOutboxEvent.count({ where: { status: "RETRYING" } }),
      db.integrationOutboxEvent.count({ where: { status: "SUCCESS" } }),
      db.integrationOutboxEvent.count({ where: { status: "DEAD_LETTER" } }),
      db.ghlWebhookEvent.count({ where: { signatureValid: true } }),
      db.ghlWebhookEvent.count({ where: { signatureValid: false } }),
      db.ghlWebhookEvent.findFirst({ orderBy: { receivedAt: "desc" }, select: { receivedAt: true } }),
    ]);
    const config = await getOrCreateConfig();

    return reply.send({
      outbox: { queued, retrying, success, deadLetter },
      webhooks: {
        receivedValid: webhooksReceived,
        rejectedInvalid: webhooksRejected,
        lastReceivedAt: lastWebhookAt?.receivedAt ?? null,
        status: lastWebhookAt ? "RECEIVING" : "NO_RECENT_DELIVERIES",
      },
      connection: { status: config.status, operatingMode: config.operatingMode, lastSuccessfulConnectionAt: config.lastSuccessfulConnectionAt },
    });
  });

  app.get("/api/ghl/outbox/dead-letter", { preHandler: [requireAuth, requirePermission("Communications - GHL Integration", "VIEW")] }, async (_request, reply) => {
    const rows = await db.integrationOutboxEvent.findMany({ where: { status: "DEAD_LETTER" }, orderBy: { updatedAt: "desc" }, take: 200 });
    return reply.send({ rows });
  });

  app.post("/api/ghl/outbox/:id/retry", { preHandler: [requireAuth, requirePermission("Communications - GHL Integration", "EDIT")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const row = await db.integrationOutboxEvent.findUnique({ where: { id } });
    if (!row) return reply.code(404).send({ error: "Outbox row not found." });

    await db.integrationOutboxEvent.update({ where: { id }, data: { status: "QUEUED", nextRetryAt: null, resolvedById: request.authContext!.userId } });
    const outcome = await processOutboxEvent(id);

    await writeAuditLog({ action: "GHL Outbox Manually Retried", summary: `Outbox event ${id} manually retried (${outcome.status})`, actorUserId: request.authContext!.userId, entityType: "IntegrationOutboxEvent", entityId: id });
    return reply.send({ outcome });
  });

  // Manual sweep trigger (spec section 30) — same code path the interval
  // timer uses; lets an admin force processing without waiting.
  app.post("/api/ghl/outbox/run", { preHandler: [requireAuth, requirePermission("Communications - GHL Integration", "EDIT")] }, async (_request, reply) => {
    const result = await runOutboxSweep();
    return reply.send(result);
  });

  // --- Mapping CRUD (spec sections 11-13) ---------------------------------

  app.get("/api/ghl/mappings/tags", { preHandler: [requireAuth, requirePermission("Communications - GHL Integration", "VIEW")] }, async (_request, reply) => {
    return reply.send({ mappings: await db.ghlTagMapping.findMany({ orderBy: { eventKey: "asc" } }) });
  });
  app.post("/api/ghl/mappings/tags", { preHandler: [requireAuth, requirePermission("Communications - GHL Integration", "EDIT")] }, async (request, reply) => {
    const parsed = tagMappingSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid tag mapping.", details: parsed.error.flatten() });
    const mapping = await db.ghlTagMapping.upsert({ where: { eventKey: parsed.data.eventKey }, update: parsed.data, create: parsed.data });
    await writeAuditLog({ action: "GHL Mapping Changed", summary: `Tag mapping set for ${parsed.data.eventKey}`, actorUserId: request.authContext!.userId, entityType: "GhlTagMapping", entityId: mapping.id });
    return reply.code(201).send({ mapping });
  });
  app.delete("/api/ghl/mappings/tags/:id", { preHandler: [requireAuth, requirePermission("Communications - GHL Integration", "EDIT")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await db.ghlTagMapping.delete({ where: { id } }).catch(() => null);
    await writeAuditLog({ action: "GHL Mapping Changed", summary: `Tag mapping ${id} removed`, actorUserId: request.authContext!.userId, entityType: "GhlTagMapping", entityId: id });
    return reply.code(204).send();
  });

  app.get("/api/ghl/mappings/custom-fields", { preHandler: [requireAuth, requirePermission("Communications - GHL Integration", "VIEW")] }, async (_request, reply) => {
    return reply.send({ mappings: await db.ghlCustomFieldMapping.findMany({ orderBy: { maiaField: "asc" } }) });
  });
  app.post("/api/ghl/mappings/custom-fields", { preHandler: [requireAuth, requirePermission("Communications - GHL Integration", "EDIT")] }, async (request, reply) => {
    const parsed = customFieldMappingSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid custom field mapping.", details: parsed.error.flatten() });
    const mapping = await db.ghlCustomFieldMapping.upsert({ where: { maiaField: parsed.data.maiaField }, update: parsed.data, create: parsed.data });
    await writeAuditLog({ action: "GHL Mapping Changed", summary: `Custom field mapping set for ${parsed.data.maiaField}`, actorUserId: request.authContext!.userId, entityType: "GhlCustomFieldMapping", entityId: mapping.id });
    return reply.code(201).send({ mapping });
  });
  app.delete("/api/ghl/mappings/custom-fields/:id", { preHandler: [requireAuth, requirePermission("Communications - GHL Integration", "EDIT")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await db.ghlCustomFieldMapping.delete({ where: { id } }).catch(() => null);
    await writeAuditLog({ action: "GHL Mapping Changed", summary: `Custom field mapping ${id} removed`, actorUserId: request.authContext!.userId, entityType: "GhlCustomFieldMapping", entityId: id });
    return reply.code(204).send();
  });

  app.get("/api/ghl/mappings/workflows", { preHandler: [requireAuth, requirePermission("Communications - GHL Integration", "VIEW")] }, async (_request, reply) => {
    return reply.send({ mappings: await db.ghlWorkflowMapping.findMany({ orderBy: { eventKey: "asc" } }) });
  });
  app.post("/api/ghl/mappings/workflows", { preHandler: [requireAuth, requirePermission("Communications - GHL Integration", "EDIT")] }, async (request, reply) => {
    const parsed = workflowMappingSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid workflow mapping.", details: parsed.error.flatten() });
    const mapping = await db.ghlWorkflowMapping.upsert({ where: { eventKey: parsed.data.eventKey }, update: parsed.data, create: parsed.data });
    await writeAuditLog({ action: "GHL Mapping Changed", summary: `Workflow mapping set for ${parsed.data.eventKey}`, actorUserId: request.authContext!.userId, entityType: "GhlWorkflowMapping", entityId: mapping.id });
    return reply.code(201).send({ mapping });
  });
  app.delete("/api/ghl/mappings/workflows/:id", { preHandler: [requireAuth, requirePermission("Communications - GHL Integration", "EDIT")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await db.ghlWorkflowMapping.delete({ where: { id } }).catch(() => null);
    await writeAuditLog({ action: "GHL Mapping Changed", summary: `Workflow mapping ${id} removed`, actorUserId: request.authContext!.userId, entityType: "GhlWorkflowMapping", entityId: id });
    return reply.code(204).send();
  });

  // Contact sync map read (spec section 6).
  app.get("/api/ghl/contacts/:personId", { preHandler: [requireAuth, requirePermission("Communications - GHL Integration", "VIEW")] }, async (request, reply) => {
    const { personId } = request.params as { personId: string };
    const contactMap = await db.ghlContactMap.findUnique({ where: { personId } });
    return reply.send({ contactMap });
  });
}
