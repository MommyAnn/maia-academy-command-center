// Deep health check (spec section 40: Monitoring & Observability). Every
// sub-check here reports STATUS ONLY — never a credential, connection
// string, or provider response body — so this endpoint is safe to leave
// unauthenticated for uptime monitors while still being honest about what
// is and isn't actually working (spec section 4: no silent demo fallback).

import type { FastifyInstance } from "fastify";
import { db } from "../../db.js";
import { env, isProduction } from "../../env.js";
import { isGhlConfigured } from "../ghl/client.js";
import { getProvider } from "../../ai/registry.js";
import type { AiProviderName } from "../../ai/types.js";

async function checkDatabase(): Promise<{ status: "ok" | "error"; error?: string }> {
  try {
    await db.$queryRaw`SELECT 1`;
    return { status: "ok" };
  } catch (err) {
    return { status: "error", error: err instanceof Error ? err.message : "Unknown database error." };
  }
}

function checkStorage(): { status: "ok" | "not_production_ready"; driver: string } {
  // "ok" here means "configured and internally consistent" — env.ts already
  // refuses to boot with STORAGE_DRIVER=local in production, so reaching
  // this line in production means a real driver is set. It is NOT a live
  // read/write probe against the driver (spec section 51: storage
  // production readiness is a separate, explicit audit item, not implied
  // by a healthy health check).
  return { status: env.STORAGE_DRIVER === "local" ? "not_production_ready" : "ok", driver: env.STORAGE_DRIVER };
}

async function checkGhl(): Promise<{ status: "not_configured" | "configured_but_disconnected" | "connected"; operatingMode?: string }> {
  if (!isGhlConfigured()) return { status: "not_configured" };
  const config = await db.ghlIntegrationConfig.findUnique({ where: { id: "singleton" } });
  return { status: config?.status === "CONNECTED" ? "connected" : "configured_but_disconnected", operatingMode: config?.operatingMode };
}

async function checkAi(): Promise<{ providers: Array<{ provider: AiProviderName; credentialsConfigured: boolean; enabled: boolean; status: string }> }> {
  const rows = await db.aiProviderConfig.findMany();
  const providers = rows.map((row) => ({
    provider: row.provider as AiProviderName,
    credentialsConfigured: getProvider(row.provider as AiProviderName).isConfigured(),
    enabled: row.enabled,
    status: row.status,
  }));
  return { providers };
}

export async function healthRoutes(app: FastifyInstance) {
  app.get("/api/health", async () => {
    const [database, ghl, ai] = await Promise.all([checkDatabase(), checkGhl(), checkAi()]);
    const storage = checkStorage();

    const overall = database.status === "ok" ? "ok" : "degraded";
    return {
      status: overall,
      environment: env.NODE_ENV,
      isProduction,
      checks: { database, storage, ghl, ai },
    };
  });
}
