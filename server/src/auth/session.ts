import { randomBytes, createHash } from "node:crypto";
import { db } from "../db.js";
import { env } from "../env.js";

// Opaque, server-revocable sessions (spec section 8's "Session Revocation").
// The raw token lives ONLY in the httpOnly cookie handed to the browser;
// the database stores a SHA-256 hash of it, the same non-reversible
// pattern used for the password itself — a database leak alone can never
// be replayed as a valid session, just like it can't recover a password.

const SESSION_COOKIE_NAME = "maia_session";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string, meta: { userAgent?: string; ipAddress?: string }) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + env.SESSION_TTL_HOURS * 60 * 60 * 1000);
  await db.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt,
      userAgent: meta.userAgent ?? null,
      ipAddress: meta.ipAddress ?? null,
    },
  });
  return { token, expiresAt };
}

export async function validateSession(token: string) {
  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { include: { role: true, person: true } } },
  });
  if (!session) return null;
  if (session.revokedAt) return null;
  if (session.expiresAt.getTime() < Date.now()) return null;
  if (session.user.status !== "ACTIVE") return null;
  return session;
}

export async function revokeSession(token: string) {
  await db.session.updateMany({
    where: { tokenHash: hashToken(token) },
    data: { revokedAt: new Date() },
  });
}

/** Revokes every session for a user — used on password change/reset (spec: "Session Revocation"). */
export async function revokeAllSessionsForUser(userId: string) {
  await db.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export const sessionCookieOptions = {
  name: SESSION_COOKIE_NAME,
  httpOnly: true,
  sameSite: "lax" as const,
  secure: env.NODE_ENV === "production",
  path: "/",
  domain: env.COOKIE_DOMAIN === "localhost" ? undefined : env.COOKIE_DOMAIN,
};

export { SESSION_COOKIE_NAME };
