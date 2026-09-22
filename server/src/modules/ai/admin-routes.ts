// ADMIN -> AI CONNECTIONS + model configuration backend (spec sections 6-9,
// 65). Never returns a raw API key (spec section 4) — only whether the
// server has one configured.

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../../db.js";
import { requireAuth, requirePermission } from "../../rbac/middleware.js";
import { writeAuditLog } from "../../audit/log.js";
import { getProvider } from "../../ai/registry.js";
import type { AiProviderName } from "../../ai/types.js";

const PROVIDER_NAMES: AiProviderName[] = ["ANTHROPIC", "OPENAI", "GOOGLE"];

const providerUpdateSchema = z.object({
  enabled: z.boolean().optional(),
  environment: z.enum(["TEST", "PRODUCTION"]).optional(),
});

const modelConfigSchema = z.object({
  configKey: z.string().min(1),
  provider: z.enum(["ANTHROPIC", "OPENAI", "GOOGLE"]),
  model: z.string().min(1),
  purpose: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxOutputTokens: z.number().int().positive().default(4096),
  supportsStructuredOutput: z.boolean().default(true),
  fallbackConfigKey: z.string().optional(),
  enabled: z.boolean().default(true),
});

const modelConfigUpdateSchema = modelConfigSchema.partial().omit({ configKey: true });

async function ensureProviderRowsExist() {
  for (const provider of PROVIDER_NAMES) {
    await db.aiProviderConfig.upsert({ where: { provider }, update: {}, create: { provider, updatedAt: new Date() } });
  }
}

export async function aiAdminRoutes(app: FastifyInstance) {
  app.get("/api/ai/providers", { preHandler: [requireAuth, requirePermission("AI Business Tools - Providers", "VIEW")] }, async (_request, reply) => {
    await ensureProviderRowsExist();
    const rows = await db.aiProviderConfig.findMany({ orderBy: { provider: "asc" } });
    const providers = rows.map((row) => ({ ...row, credentialsConfigured: getProvider(row.provider as AiProviderName).isConfigured() }));
    return reply.send({ providers });
  });

  app.patch("/api/ai/providers/:provider", { preHandler: [requireAuth, requirePermission("AI Business Tools - Providers", "EDIT")] }, async (request, reply) => {
    const { provider } = request.params as { provider: string };
    if (!PROVIDER_NAMES.includes(provider as AiProviderName)) return reply.code(404).send({ error: "Unknown provider." });
    const parsed = providerUpdateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid update.", details: parsed.error.flatten() });

    if (parsed.data.environment === "PRODUCTION" && !getProvider(provider as AiProviderName).isConfigured()) {
      return reply.code(422).send({ error: `Cannot switch ${provider} to PRODUCTION: no credential is configured on this server.` });
    }

    await ensureProviderRowsExist();
    const row = await db.aiProviderConfig.update({
      where: { provider },
      data: { enabled: parsed.data.enabled, environment: parsed.data.environment, updatedById: request.authContext!.userId },
    });
    await writeAuditLog({ action: "AI Provider Configuration Changed", summary: `${provider} provider config updated`, actorUserId: request.authContext!.userId, entityType: "AiProviderConfig", entityId: row.id });
    return reply.send({ provider: row });
  });

  // Safe authenticated test (spec section 7) — read-only, only ever
  // returns one of the enumerated statuses.
  app.post("/api/ai/providers/:provider/test-connection", { preHandler: [requireAuth, requirePermission("AI Business Tools - Providers", "EDIT")] }, async (request, reply) => {
    const { provider } = request.params as { provider: string };
    if (!PROVIDER_NAMES.includes(provider as AiProviderName)) return reply.code(404).send({ error: "Unknown provider." });

    const result = await getProvider(provider as AiProviderName).healthCheck();
    const status = result.ok ? "CONNECTED" : result.status;

    await ensureProviderRowsExist();
    const row = await db.aiProviderConfig.update({
      where: { provider },
      data: {
        status,
        lastSuccessfulRequestAt: result.ok ? new Date() : undefined,
        lastErrorAt: result.ok ? undefined : new Date(),
        lastErrorMessage: result.ok ? null : result.message,
        updatedById: request.authContext!.userId,
      },
    });
    await writeAuditLog({ action: "AI Connection Tested", summary: `${provider} connection test result: ${status}`, actorUserId: request.authContext!.userId, entityType: "AiProviderConfig", entityId: row.id });
    return reply.send({ status, message: result.ok ? `Connected (model: ${result.data.model}).` : result.message });
  });

  app.get("/api/ai/model-configs", { preHandler: [requireAuth, requirePermission("AI Business Tools - Providers", "VIEW")] }, async (_request, reply) => {
    return reply.send({ modelConfigs: await db.aiModelConfig.findMany({ orderBy: { configKey: "asc" } }) });
  });

  app.post("/api/ai/model-configs", { preHandler: [requireAuth, requirePermission("AI Business Tools - Providers", "EDIT")] }, async (request, reply) => {
    const parsed = modelConfigSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid model configuration.", details: parsed.error.flatten() });
    const config = await db.aiModelConfig.create({ data: parsed.data });
    await writeAuditLog({ action: "AI Model Config Changed", summary: `Model config "${config.configKey}" created`, actorUserId: request.authContext!.userId, entityType: "AiModelConfig", entityId: config.id });
    return reply.code(201).send({ modelConfig: config });
  });

  app.patch("/api/ai/model-configs/:id", { preHandler: [requireAuth, requirePermission("AI Business Tools - Providers", "EDIT")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = modelConfigUpdateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid model configuration update.", details: parsed.error.flatten() });
    const config = await db.aiModelConfig.update({ where: { id }, data: parsed.data });
    await writeAuditLog({ action: "AI Model Config Changed", summary: `Model config "${config.configKey}" updated`, actorUserId: request.authContext!.userId, entityType: "AiModelConfig", entityId: config.id });
    return reply.send({ modelConfig: config });
  });

  // Kill switch shortcut — flips AiModelConfig.enabled without a full PATCH body (spec section 65).
  app.post("/api/ai/model-configs/:id/disable", { preHandler: [requireAuth, requirePermission("AI Business Tools - Providers", "EDIT")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const config = await db.aiModelConfig.update({ where: { id }, data: { enabled: false } });
    await writeAuditLog({ action: "AI Model Config Changed", summary: `Model config "${config.configKey}" disabled (kill switch)`, actorUserId: request.authContext!.userId, entityType: "AiModelConfig", entityId: config.id });
    return reply.send({ modelConfig: config });
  });
  app.post("/api/ai/model-configs/:id/enable", { preHandler: [requireAuth, requirePermission("AI Business Tools - Providers", "EDIT")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const config = await db.aiModelConfig.update({ where: { id }, data: { enabled: true } });
    await writeAuditLog({ action: "AI Model Config Changed", summary: `Model config "${config.configKey}" enabled`, actorUserId: request.authContext!.userId, entityType: "AiModelConfig", entityId: config.id });
    return reply.send({ modelConfig: config });
  });
}
