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
