import { Router } from "express";
import { z } from "zod";
import {
  clearSessionCookie,
  createSession,
  destroySession,
  getDummyHash,
  hashPassword,
  readCookie,
  requireUser,
  SESSION_COOKIE,
  setSessionCookie,
  verifyPassword,
} from "../auth.ts";
import { type DB, get, run } from "../db.ts";
import { HttpError, parse, rateLimit, text } from "../util.ts";

export const passwordField = z
  .string()
  .min(10, "Password must be at least 10 characters")
  .max(200, "Password is too long");

export function authRoutes(db: DB, opts: { secureCookies: boolean }) {
  const r = Router();

  r.get("/me", (req, res) => {
    res.json({ user: req.user ?? null });
  });

  const registerSchema = z.object({
    name: text(120).min(2, "Please enter your full name"),
    email: z.email("Please enter a valid email").max(200),
    mobile: text(40).optional().default(""),
    password: passwordField,
  });

  r.post("/register", rateLimit("register", 5, 60 * 60_000), async (req, res) => {
    const body = parse(registerSchema, req.body);
    const exists = get(db, "SELECT id FROM users WHERE email = ?", body.email);
    if (exists) throw new HttpError(409, "An account with this email already exists. Please sign in.");
    const hash = await hashPassword(body.password);
    const result = run(
      db,
      "INSERT INTO users (email, name, mobile, password_hash, role) VALUES (?, ?, ?, ?, 'student')",
      body.email.toLowerCase(),
      body.name,
      body.mobile,
      hash,
    );
    const token = createSession(db, Number(result.lastInsertRowid));
    setSessionCookie(res, token, opts.secureCookies);
    const user = get(db, "SELECT id, email, name, mobile, role FROM users WHERE id = ?", result.lastInsertRowid);
    res.status(201).json({ user });
  });

  const loginSchema = z.object({ email: z.email("Please enter a valid email"), password: z.string().min(1).max(200) });

  r.post("/login", rateLimit("login", 10, 15 * 60_000), async (req, res) => {
    const body = parse(loginSchema, req.body);
    const user = get<{ id: number; password_hash: string; status: string }>(
      db,
      "SELECT id, password_hash, status FROM users WHERE email = ?",
      body.email,
    );
    const ok = await verifyPassword(body.password, user?.password_hash ?? (await getDummyHash()));
    if (!user || !ok) throw new HttpError(401, "Incorrect email or password.");
    if (user.status !== "active") throw new HttpError(403, "This account is disabled. Please contact the academy.");
    run(db, "UPDATE users SET last_login_at = datetime('now') WHERE id = ?", user.id);
    const token = createSession(db, user.id);
    setSessionCookie(res, token, opts.secureCookies);
    res.json({ user: get(db, "SELECT id, email, name, mobile, role FROM users WHERE id = ?", user.id) });
  });

  r.post("/logout", (req, res) => {
    destroySession(db, readCookie(req, SESSION_COOKIE));
    clearSessionCookie(res, opts.secureCookies);
    res.json({ ok: true });
  });

  const profileSchema = z.object({ name: text(120).min(2), mobile: text(40) });
  r.put("/profile", requireUser, (req, res) => {
    const body = parse(profileSchema, req.body);
    run(db, "UPDATE users SET name = ?, mobile = ? WHERE id = ?", body.name, body.mobile, req.user!.id);
    res.json({ user: get(db, "SELECT id, email, name, mobile, role FROM users WHERE id = ?", req.user!.id) });
  });

  const changeSchema = z.object({ currentPassword: z.string().min(1).max(200), newPassword: passwordField });
  r.post("/change-password", requireUser, rateLimit("change-password", 10, 15 * 60_000), async (req, res) => {
    const body = parse(changeSchema, req.body);
    const row = get<{ password_hash: string }>(db, "SELECT password_hash FROM users WHERE id = ?", req.user!.id)!;
    if (!(await verifyPassword(body.currentPassword, row.password_hash)))
      throw new HttpError(400, "Your current password is incorrect.");
    run(db, "UPDATE users SET password_hash = ? WHERE id = ?", await hashPassword(body.newPassword), req.user!.id);
    // Sign out every other device.
    run(db, "DELETE FROM sessions WHERE user_id = ?", req.user!.id);
    setSessionCookie(res, createSession(db, req.user!.id), opts.secureCookies);
    res.json({ ok: true });
  });

  return r;
}
