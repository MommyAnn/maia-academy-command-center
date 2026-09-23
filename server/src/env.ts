// Server-side-only environment loader. Fails fast and loudly if a required
// secret is missing rather than silently falling back to an insecure
// default — this is the one file every credential in this backend passes
// through, and nothing here is ever imported by, or bundled into, the
// frontend (spec section 28).

import { readFileSync, existsSync } from "node:fs";
import { z } from "zod";

const envFile = process.env.NODE_ENV === "test" ? ".env.test" : process.env.NODE_ENV === "production" ? ".env" : ".env.development";

if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "staging", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required — each environment must point at its own database"),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
  SESSION_TTL_HOURS: z.coerce.number().int().positive().default(12),
  COOKIE_DOMAIN: z.string().default("localhost"),
  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  STORAGE_LOCAL_DIR: z.string().default("./uploads-dev"),
  PORT: z.coerce.number().int().positive().default(4000),
  LOGIN_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(10),
  // The frontend's own dev origin, allowed to send credentialed
  // (cookie-carrying) requests here. Never a wildcard — a wildcard origin
  // combined with credentials would let ANY site read an authenticated
  // user's session data (spec section 35: no OWASP-class vulnerabilities).
  CORS_ORIGIN: z.string().default("http://localhost:5173"),

  // Phase 5 — GHL/HighLevel integration credentials. ALL optional: the
  // server must boot and every non-GHL feature must keep working with none
  // of these set (spec sections 72-74 — no live credentials are configured
  // in this production phase). Never read anywhere outside this file and
  // the GHL client module; never returned by any API response or persisted
  // to the database (spec section 3).
  GHL_PRIVATE_INTEGRATION_TOKEN: z.string().min(1).optional(),
  GHL_LOCATION_ID: z.string().min(1).optional(),
  // The Ed25519 public key HighLevel signs webhook deliveries with (spec
  // section 34), PEM-encoded. Required only to verify inbound webhooks —
  // outbound sync works without it.
  GHL_WEBHOOK_SIGNATURE_PUBLIC_KEY: z.string().min(1).optional(),
  GHL_API_BASE_URL: z.string().default("https://services.leadconnectorhq.com"),
  GHL_API_VERSION: z.string().default("2021-07-28"),

  // Phase 6 — AI provider credentials. ALL optional: the server must boot
  // and every non-AI feature must keep working with none of these set (spec
  // section 92 — no real AI provider is live in this production phase).
  // Never read anywhere outside this file, src/ai/*, and the admin
  // connection-status routes; never returned by any API response or
  // persisted to the database (spec section 4).
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  // Override point for tests only — points the Anthropic client at a local
  // fake server instead of the real api.anthropic.com.
  ANTHROPIC_BASE_URL: z.string().optional(),
  OPENAI_API_KEY: z.string().min(1).optional(),
  GOOGLE_AI_API_KEY: z.string().min(1).optional(),

  // Phase 14 — Meta Ads credentials. ALL optional: the server must boot and
  // every non-Ads feature must keep working with none of these set. No real
  // Meta App is configured in this production phase — AdConnection.status
  // for provider "META" honestly stays NOT_CONNECTED / CONFIGURATION_REQUIRED
  // until a real App ID/Secret/System User Token are supplied and a real
  // authenticated request against META_GRAPH_API_BASE_URL succeeds (spec
  // sections 4-5). Never read anywhere outside src/modules/ads/provider.ts;
  // never returned by any API response or persisted to the database.
  META_APP_ID: z.string().min(1).optional(),
  META_APP_SECRET: z.string().min(1).optional(),
  META_SYSTEM_USER_TOKEN: z.string().min(1).optional(),
  // Centralized here so the Graph API version is never scattered through
  // the codebase (spec section 110) — reverify against Meta's current
  // developer documentation before any real connection is configured.
  META_GRAPH_API_BASE_URL: z.string().default("https://graph.facebook.com"),
  META_GRAPH_API_VERSION: z.string().default("v21.0"),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  // Never log the raw process.env (it may contain the very secrets we're
  // validating) — only the validation errors themselves.
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  throw new Error("Server cannot start: environment validation failed. See errors above.");
}

export const env = parsed.data;

export const isProduction = env.NODE_ENV === "production";

if (isProduction && env.STORAGE_DRIVER === "local") {
  throw new Error(
    "Server cannot start: STORAGE_DRIVER=local is a Development-only convenience (files sit unencrypted on this server's disk) " +
      "and must never be used in production. Configure a real S3-compatible driver first.",
  );
}
