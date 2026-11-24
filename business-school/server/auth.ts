import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { type DB, get, run } from "./db.ts";

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LEN = 64;
export const SESSION_COOKIE = "maia_session";
const SESSION_DAYS = 14;

export type SessionUser = {
  id: number;
  email: string;
  name: string;
  mobile: string;
  role: "student" | "admin";
};

declare module "express-serve-static-core" {
  interface Request {
    user?: SessionUser;
  }
}

function scryptAsync(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password, salt, KEY_LEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P }, (err, key) =>
      err ? reject(err) : resolve(key),
    ),
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt);
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, saltB64, keyB64] = parts;
  const expected = Buffer.from(keyB64, "base64");
  const key = await new Promise<Buffer>((resolve, reject) =>
    scrypt(password, Buffer.from(saltB64, "base64"), expected.length, { N: +n, r: +r, p: +p }, (err, k) =>
      err ? reject(err) : resolve(k),
    ),
  );
  return key.length === expected.length && timingSafeEqual(key, expected);
}

/** A password hash nobody can match — used to keep login timing uniform for unknown emails. */
let dummyHash: Promise<string> | null = null;
export function getDummyHash() {
  dummyHash ??= hashPassword(randomBytes(16).toString("hex"));
  return dummyHash;
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export function createSession(db: DB, userId: number): string {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000).toISOString();
  run(db, "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)", sha256(token), userId, expires);
  run(db, "DELETE FROM sessions WHERE expires_at < ?", new Date().toISOString());
  return token;
}

export function destroySession(db: DB, token: string | undefined) {
  if (token) run(db, "DELETE FROM sessions WHERE token_hash = ?", sha256(token));
}

export function setSessionCookie(res: Response, token: string, secure: boolean) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: SESSION_DAYS * 86_400_000,
  });
}

export function clearSessionCookie(res: Response, secure: boolean) {
  res.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: "lax", secure, path: "/" });
}

export function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) return decodeURIComponent(part.slice(idx + 1).trim());
  }
  return undefined;
}

/** Attaches req.user when a valid, unexpired session cookie is present. */
export function sessionMiddleware(db: DB) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const token = readCookie(req, SESSION_COOKIE);
    if (token) {
      const row = get<SessionUser & { status: string }>(
        db,
        `SELECT u.id, u.email, u.name, u.mobile, u.role, u.status
           FROM sessions s JOIN users u ON u.id = s.user_id
          WHERE s.token_hash = ? AND s.expires_at > ?`,
        sha256(token),
        new Date().toISOString(),
      );
      if (row && row.status === "active") {
        req.user = { id: row.id, email: row.email, name: row.name, mobile: row.mobile, role: row.role };
      }
    }
    next();
  };
}

export function requireUser(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return void res.status(401).json({ error: "Please sign in first." });
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return void res.status(401).json({ error: "Please sign in first." });
  if (req.user.role !== "admin") return void res.status(403).json({ error: "Admin access only." });
  next();
}
