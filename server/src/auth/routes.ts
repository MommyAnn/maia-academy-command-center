import type { FastifyInstance } from "fastify";
import { randomBytes, createHash } from "node:crypto";
import { z } from "zod";
import { db } from "../db.js";
import { env } from "../env.js";
import { hashPassword, verifyPassword, validatePasswordStrength } from "./password.js";
import { createSession, validateSession, revokeSession, revokeAllSessionsForUser, sessionCookieOptions, SESSION_COOKIE_NAME } from "./session.js";
import { writeAuditLog } from "../audit/log.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const requestResetSchema = z.object({ email: z.string().email() });
const completeResetSchema = z.object({ token: z.string().min(1), newPassword: z.string().min(1) });

export async function authRoutes(app: FastifyInstance, opts: { loginRateLimitPerMinute?: number }) {
  const loginRateLimit = opts.loginRateLimitPerMinute ?? env.LOGIN_RATE_LIMIT_PER_MINUTE;

  // Real brute-force protection (spec section 33) — this is an actually
  // enforced per-route rate limit, not a documented intention.
  app.post(
    "/api/auth/login",
    { config: { rateLimit: { max: loginRateLimit, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const parsed = loginSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: "Invalid email or password format." });

      const { email, password } = parsed.data;
      const user = await db.user.findUnique({ where: { email: email.toLowerCase() }, include: { role: true, person: true } });

      // Same generic error whether the email doesn't exist or the password
      // is wrong — never reveal which one failed (account enumeration).
      const genericError = { error: "Invalid email or password." };

      if (!user || user.status !== "ACTIVE") {
        await writeAuditLog({ action: "Login Failed", summary: `Failed login attempt for ${email}` });
        return reply.code(401).send(genericError);
      }

      const ok = await verifyPassword(password, user.passwordHash);
      if (!ok) {
        await writeAuditLog({ action: "Login Failed", summary: `Failed login attempt for ${email}`, actorUserId: user.id });
        return reply.code(401).send(genericError);
      }

      const { token, expiresAt } = await createSession(user.id, {
        userAgent: request.headers["user-agent"],
        ipAddress: request.ip,
      });
      await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
      await writeAuditLog({ action: "Login", summary: `${user.person.fullName} logged in`, actorUserId: user.id });

      reply.setCookie(sessionCookieOptions.name, token, { ...sessionCookieOptions, expires: expiresAt });
      return reply.send({
        user: { id: user.id, email: user.email, fullName: user.person.fullName, role: user.role.name },
      });
    },
  );

  app.post("/api/auth/logout", async (request, reply) => {
    const token = request.cookies[SESSION_COOKIE_NAME];
    if (token) {
      await revokeSession(token);
      const session = await validateSession(token).catch(() => null);
      if (session) await writeAuditLog({ action: "Logout", summary: `${session.user.person.fullName} logged out`, actorUserId: session.userId });
    }
    reply.clearCookie(sessionCookieOptions.name, { path: "/" });
    return reply.send({ ok: true });
  });

  app.get("/api/auth/me", async (request, reply) => {
    const token = request.cookies[SESSION_COOKIE_NAME];
    if (!token) return reply.code(401).send({ error: "Not authenticated." });
    const session = await validateSession(token);
    if (!session) return reply.code(401).send({ error: "Session expired or revoked." });
    return reply.send({
      user: { id: session.user.id, email: session.user.email, fullName: session.user.person.fullName, role: session.user.role.name },
    });
  });

  // Password reset request never reveals whether the email exists (spec
  // section 33/9) — always returns the same generic response.
  app.post("/api/auth/request-password-reset", { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } }, async (request, reply) => {
    const parsed = requestResetSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid email." });

    const user = await db.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
    if (user) {
      const token = randomBytes(32).toString("hex");
      await db.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: createHash("sha256").update(token).digest("hex"),
          expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
        },
      });
      await writeAuditLog({ action: "Password Reset Requested", summary: "Password reset requested", actorUserId: user.id });
      // Phase 1 does not send real email (no provider connected yet — see
      // Phase 1 status report, "Requires External Setup"). In Development,
      // the raw token is returned directly so the reset flow is testable
      // end-to-end without a mail server; Staging/Production must never do this.
      if (env.NODE_ENV !== "production") {
        return reply.send({ ok: true, devOnlyResetToken: token });
      }
    }
    return reply.send({ ok: true });
  });

  app.post("/api/auth/complete-password-reset", async (request, reply) => {
    const parsed = completeResetSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid request." });

    const strengthError = validatePasswordStrength(parsed.data.newPassword);
    if (strengthError) return reply.code(400).send({ error: strengthError });

    const tokenHash = createHash("sha256").update(parsed.data.token).digest("hex");
    const resetRecord = await db.passwordResetToken.findUnique({ where: { tokenHash } });
    if (!resetRecord || resetRecord.usedAt || resetRecord.expiresAt.getTime() < Date.now()) {
      return reply.code(400).send({ error: "This reset link is invalid or has expired." });
    }

    const newHash = await hashPassword(parsed.data.newPassword);
    await db.$transaction([
      db.user.update({ where: { id: resetRecord.userId }, data: { passwordHash: newHash } }),
      db.passwordResetToken.update({ where: { id: resetRecord.id }, data: { usedAt: new Date() } }),
    ]);
    await revokeAllSessionsForUser(resetRecord.userId);
    await writeAuditLog({ action: "Password Reset Completed", summary: "Password reset completed, all sessions revoked", actorUserId: resetRecord.userId });
    return reply.send({ ok: true });
  });
}
