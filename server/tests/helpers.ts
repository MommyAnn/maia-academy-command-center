// NODE_ENV=test is set via vitest.config.ts's `test.env` (applied before any
// test file's imports run), which is what makes src/env.ts load .env.test.

import type { FastifyInstance } from "fastify";
import { db } from "../src/db.js";
import { runDevSeed } from "../prisma/seed.js";

/** Wipes every table this test suite might have written to, then reseeds baseline roles/packages/batch/dev users. Keeps each test file's assertions deterministic regardless of run order. */
const FIXED_PERSON_IDS = ["seed-owner-person", "seed-finance-person", "seed-student-a-person", "seed-student-b-person"];
const FIXED_STUDENT_DISPLAY_IDS = ["MAIA-B14-DEV-A", "MAIA-B14-DEV-B"];

/**
 * Also deletes every Student/Person/User this suite created beyond the four
 * fixed dev-seed identities (e.g. via /api/enroll or a Lead conversion) —
 * not just the dev-seed Users themselves. Without this, the Counter table
 * reset below would restart a scope like `student:14` back at 1 while an
 * OLD Student row from a previous test file's run still occupies
 * "MAIA-B14-0001", producing a real unique-constraint collision that has
 * nothing to do with the concurrency-safety logic under test.
 */
export async function resetDb() {
  await db.$transaction([
    db.requirementReview.deleteMany(),
    db.requirement.deleteMany(),
    db.studentNote.deleteMany(),
    db.domainEvent.deleteMany(),
    db.activityLog.deleteMany(),
    db.paymentTransaction.deleteMany(),
    db.enrollment.deleteMany(),
    db.leadStudentConversion.deleteMany(),
    db.leadActivity.deleteMany(),
    db.lead.deleteMany(),
    db.document.deleteMany(),
    db.session.deleteMany(),
    db.passwordResetToken.deleteMany(),
    db.user.deleteMany(),
    db.student.deleteMany({ where: { studentDisplayId: { notIn: FIXED_STUDENT_DISPLAY_IDS } } }),
    db.person.deleteMany({ where: { id: { notIn: FIXED_PERSON_IDS } } }),
    // Also cleans up Batches/Packages a Phase 2 test file created (e.g. a
    // uniquely-coded/-named CRUD fixture) — otherwise a re-run collides on
    // that same unique code/name exactly like the Student case above.
    db.batch.deleteMany({ where: { code: { not: "14" } } }),
    db.package.deleteMany({ where: { name: { notIn: ["Premium", "VIP", "Dual VIP"] } } }),
    db.counter.deleteMany(),
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
