import Fastify, { type FastifyError } from "fastify";
import fastifyCookie from "@fastify/cookie";
import fastifyRateLimit from "@fastify/rate-limit";
import { env, isProduction } from "./env.js";
import { authRoutes } from "./auth/routes.js";
import { studentRoutes } from "./modules/students/routes.js";
import { financeRoutes } from "./modules/finance/routes.js";
import { documentRoutes } from "./modules/documents/routes.js";

export interface BuildAppOptions {
  /** Overrides env.LOGIN_RATE_LIMIT_PER_MINUTE for this instance only — used by the brute-force test to prove the limiter actually blocks, without lowering the shared limit every other test's logins run against. */
  loginRateLimitOverride?: number;
}

export async function buildApp(options: BuildAppOptions = {}) {
  const app = Fastify({
    logger: env.NODE_ENV !== "test",
    trustProxy: isProduction,
  });

  await app.register(fastifyCookie);
  await app.register(fastifyRateLimit, { global: false });

  // Safe error handling (spec section 35) — never leak stack traces,
  // database internals, or server paths to the client. Full detail still
  // goes to the server log via Fastify's own logger.
  app.setErrorHandler((error: FastifyError, request, reply) => {
    request.log.error(error);
    if (error.validation) {
      return reply.code(400).send({ error: "Invalid request." });
    }
    const status = error.statusCode && error.statusCode < 500 ? error.statusCode : 500;
    if (status >= 500) {
      return reply.code(500).send({ error: "An unexpected error occurred. Please try again." });
    }
    return reply.code(status).send({ error: error.message });
  });

  app.get("/api/health", async () => ({ status: "ok", environment: env.NODE_ENV }));

  await app.register(authRoutes, { loginRateLimitPerMinute: options.loginRateLimitOverride ?? env.LOGIN_RATE_LIMIT_PER_MINUTE });
  await app.register(studentRoutes);
  await app.register(financeRoutes);
  await app.register(documentRoutes);

  return app;
}
