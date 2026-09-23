import Fastify, { type FastifyError } from "fastify";
import fastifyCookie from "@fastify/cookie";
import fastifyCors from "@fastify/cors";
import fastifyRateLimit from "@fastify/rate-limit";
import fastifyHelmet from "@fastify/helmet";
import { env, isProduction } from "./env.js";
import { authRoutes } from "./auth/routes.js";
import { studentRoutes } from "./modules/students/routes.js";
import { financeRoutes } from "./modules/finance/routes.js";
import { documentRoutes } from "./modules/documents/routes.js";
import { packageRoutes } from "./modules/packages/routes.js";
import { batchRoutes } from "./modules/batches/routes.js";
import { enrollmentRoutes } from "./modules/enrollment/routes.js";
import { leadRoutes } from "./modules/leads/routes.js";
import { requirementRoutes } from "./modules/requirements/routes.js";
import { studentNoteRoutes } from "./modules/notes/routes.js";
import { activityRoutes } from "./modules/activity/routes.js";
import { dashboardRoutes } from "./modules/dashboard/routes.js";
import { trainingRoutes } from "./modules/training/routes.js";
import { courseRoutes } from "./modules/courses/routes.js";
import { courseAccessRoutes } from "./modules/course-access/routes.js";
import { progressRoutes } from "./modules/progress/routes.js";
import { certificateRoutes } from "./modules/certificates/routes.js";
import { feedbackRoutes } from "./modules/feedback/routes.js";
import { incentiveRoutes } from "./modules/incentives/routes.js";
import { webinarRoutes } from "./modules/webinar/routes.js";
import { followUpRoutes } from "./modules/follow-ups/routes.js";
import { webinarDashboardRoutes } from "./modules/webinar-dashboard/routes.js";
import { ghlAdminRoutes } from "./modules/ghl/admin-routes.js";
import { ghlWebhookRoutes } from "./modules/ghl/webhook.js";
import { communicationsRoutes } from "./modules/communications/routes.js";
import { startOutboxWorker } from "./modules/ghl/outbox.js";
import { aiAdminRoutes } from "./modules/ai/admin-routes.js";
import { masterBrainRoutes } from "./modules/master-brain/routes.js";
import { migrationRoutes } from "./modules/migration/routes.js";
import { healthRoutes } from "./modules/health/routes.js";
import { intelligenceRoutes } from "./modules/intelligence/routes.js";
import { aiToolAdminRoutes } from "./modules/ai-tools/admin-routes.js";
import { aiToolGenerateRoutes } from "./modules/ai-tools/generate-routes.js";
import { creativeStudioRoutes } from "./modules/creative/routes.js";
import { automationStudioRoutes } from "./modules/automation/routes.js";
import { websiteFunnelStudioRoutes } from "./modules/website/routes.js";
import { startAutomationDispatcher } from "./modules/automation/dispatcher.js";

export interface BuildAppOptions {
  /** Overrides env.LOGIN_RATE_LIMIT_PER_MINUTE for this instance only — used by the brute-force test to prove the limiter actually blocks, without lowering the shared limit every other test's logins run against. */
  loginRateLimitOverride?: number;
  /** Overrides the migration upload rate limit (default 10/minute) for this instance only — the staged-pipeline test suite legitimately uploads more than 10 batches in a single run. */
  migrationUploadRateLimitOverride?: number;
}

export async function buildApp(options: BuildAppOptions = {}) {
  const app = Fastify({
    logger: env.NODE_ENV !== "test",
    trustProxy: isProduction,
  });

  await app.register(fastifyCookie);
  // Allows the frontend dev origin to send credentialed requests (the
  // session cookie) to this API — a single explicit origin, never a
  // wildcard, since a wildcard is incompatible with credentials anyway and
  // would otherwise be a real cross-origin data leak.
  await app.register(fastifyCors, { origin: env.CORS_ORIGIN, credentials: true });
  await app.register(fastifyRateLimit, { global: false });
  // Security headers (spec section 34) — this API never serves HTML/scripts
  // of its own, so CSP is locked to 'none' rather than tuned for a page;
  // HSTS only applies once real HTTPS is in front of this service in
  // production (it would be actively wrong advice over plain HTTP in dev).
  await app.register(fastifyHelmet, {
    contentSecurityPolicy: { directives: { defaultSrc: ["'none'"] } },
    hsts: isProduction ? { maxAge: 15552000, includeSubDomains: true } : false,
    crossOriginResourcePolicy: { policy: "same-site" },
  });

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

  await app.register(healthRoutes);

  await app.register(authRoutes, { loginRateLimitPerMinute: options.loginRateLimitOverride ?? env.LOGIN_RATE_LIMIT_PER_MINUTE });
  await app.register(studentRoutes);
  await app.register(financeRoutes);
  await app.register(documentRoutes);
  await app.register(packageRoutes);
  await app.register(batchRoutes);
  await app.register(enrollmentRoutes);
  await app.register(leadRoutes);
  await app.register(requirementRoutes);
  await app.register(studentNoteRoutes);
  await app.register(activityRoutes);
  await app.register(dashboardRoutes);
  await app.register(trainingRoutes);
  await app.register(courseRoutes);
  await app.register(courseAccessRoutes);
  await app.register(progressRoutes);
  await app.register(certificateRoutes);
  await app.register(feedbackRoutes);
  await app.register(incentiveRoutes);
  await app.register(webinarRoutes);
  await app.register(followUpRoutes);
  await app.register(webinarDashboardRoutes);
  await app.register(ghlAdminRoutes);
  await app.register(ghlWebhookRoutes);
  await app.register(communicationsRoutes);
  await app.register(aiAdminRoutes);
  await app.register(masterBrainRoutes);
  await app.register(aiToolAdminRoutes);
  await app.register(aiToolGenerateRoutes);
  await app.register(migrationRoutes, { uploadRateLimitPerMinute: options.migrationUploadRateLimitOverride });
  await app.register(intelligenceRoutes);
  await app.register(creativeStudioRoutes);
  await app.register(automationStudioRoutes);
  await app.register(websiteFunnelStudioRoutes);

  // The outbox sweep and automation dispatcher are both real interval
  // timers in every real environment — skipped only under test, where the
  // test suite drives processing explicitly and deterministically instead
  // (spec section 30; Phase 12 spec section 126).
  if (env.NODE_ENV !== "test") {
    startOutboxWorker();
    startAutomationDispatcher();
  }

  return app;
}
