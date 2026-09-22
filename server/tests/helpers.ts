// NODE_ENV=test is set via vitest.config.ts's `test.env` (applied before any
// test file's imports run), which is what makes src/env.ts load .env.test.

import type { FastifyInstance } from "fastify";
import { db } from "../src/db.js";
import { runDevSeed } from "../prisma/seed.js";

/** Wipes every table this test suite might have written to, then reseeds baseline roles/packages/batch/dev users. Keeps each test file's assertions deterministic regardless of run order. */
const DEV_SEED_EMAILS = [
  "owner-dev@maiaacademy.local",
  "finance-dev@maiaacademy.local",
  "student-a-dev@maiaacademy.local",
  "student-b-dev@maiaacademy.local",
];

/** Also deletes and recreates the dev seed Users so a password-reset test in one file can never leak a changed password into another file's assertions. */
export async function resetDb() {
  await db.$transaction([
    db.activityLog.deleteMany(),
    db.paymentTransaction.deleteMany(),
    db.document.deleteMany(),
    db.session.deleteMany(),
    db.passwordResetToken.deleteMany(),
    db.user.deleteMany({ where: { email: { in: DEV_SEED_EMAILS } } }),
  ]);
  await runDevSeed();
}

export async function loginAs(app: FastifyInstance, email: string, password: string): Promise<string> {
  const res = await app.inject({ method: "POST", url: "/api/auth/login", payload: { email, password } });
  if (res.statusCode !== 200) throw new Error(`Login failed for ${email}: ${res.statusCode} ${res.body}`);
  const setCookie = res.headers["set-cookie"];
  const cookieHeader = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  if (!cookieHeader) throw new Error("Login succeeded but no session cookie was set.");
  return cookieHeader.split(";")[0]!; // "maia_session=<token>"
}

export const DEV_USERS = {
  owner: { email: "owner-dev@maiaacademy.local", password: "DevSeedOwner123!" },
  finance: { email: "finance-dev@maiaacademy.local", password: "DevSeedFinance123!" },
  studentA: { email: "student-a-dev@maiaacademy.local", password: "DevSeedStudentA123!" },
  studentB: { email: "student-b-dev@maiaacademy.local", password: "DevSeedStudentB123!" },
};
