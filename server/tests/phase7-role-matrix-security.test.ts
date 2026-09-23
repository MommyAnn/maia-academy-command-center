// Phase 7 full security regression across every role (spec section 91):
// Anonymous, Student, and every staff role in STAFF_ROLES, each checked
// against resources their own seeded permission matrix (prisma/seed.ts's
// ROLE_DEFAULTS) does NOT grant. Every role also gets one real "allowed"
// check (Dashboard VIEW, which every role has) — otherwise a completely
// broken RBAC middleware that denied everyone would pass this file by
// accident.

import { beforeAll, afterAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { db } from "../src/db.js";
import { hashPassword } from "../src/auth/password.js";
import { resetDb, loginAs, DEV_USERS } from "./helpers.js";

let app: FastifyInstance;
let ownerCookie: string;

const STAFF_PASSWORD = "RoleMatrixTest123!";

async function provisionStaff(roleName: string, emailSlug: string): Promise<string> {
  const role = await db.role.findUniqueOrThrow({ where: { name: roleName } });
  const person = await db.person.create({ data: { fullName: `${roleName} (Role Matrix Test)`, email: `${emailSlug}@maiaacademy.local` } });
  await db.user.create({
    data: {
      personId: person.id,
      email: `${emailSlug}@maiaacademy.local`,
      passwordHash: await hashPassword(STAFF_PASSWORD),
      roleId: role.id,
      status: "ACTIVE",
    },
  });
  return loginAs(app, `${emailSlug}@maiaacademy.local`, STAFF_PASSWORD);
}

beforeAll(async () => {
  await resetDb();
  app = await buildApp();
  ownerCookie = await loginAs(app, DEV_USERS.owner.email, DEV_USERS.owner.password);
});

afterAll(async () => {
  await app.close();
  await db.$disconnect();
});

describe("Anonymous is denied across every module", () => {
  const routes: Array<{ method: "GET" | "POST"; url: string }> = [
    { method: "GET", url: "/api/students" },
    { method: "GET", url: "/api/dashboard/summary" },
    { method: "GET", url: "/api/training/sessions" },
    { method: "GET", url: "/api/master-brain/submissions" },
    { method: "GET", url: "/api/migrations" },
    { method: "GET", url: "/api/ai/providers" },
    { method: "GET", url: "/api/leads/nonexistent" },
    { method: "POST", url: "/api/payments/nonexistent/verify" },
  ];
  for (const route of routes) {
    it(`${route.method} ${route.url} → 401`, async () => {
      const res = await app.inject({ method: route.method, url: route.url });
      expect(res.statusCode).toBe(401);
    });
  }
});

describe("Student is denied every staff-only module", () => {
  const routes: Array<{ method: "GET" | "POST"; url: string }> = [
    { method: "GET", url: "/api/students" },
    { method: "GET", url: "/api/training/sessions" },
    { method: "GET", url: "/api/master-brain/submissions" },
    { method: "GET", url: "/api/migrations" },
    { method: "GET", url: "/api/leads" },
    { method: "GET", url: "/api/ai/providers" },
  ];
  for (const route of routes) {
    it(`${route.method} ${route.url} → 403`, async () => {
      const cookie = await loginAs(app, DEV_USERS.studentA.email, DEV_USERS.studentA.password);
      const res = await app.inject({ method: route.method, url: route.url, headers: { cookie } });
      expect(res.statusCode).toBe(403);
    });
  }
});

interface RoleCase {
  role: string;
  denied: Array<{ method: "GET" | "POST"; url: string; label: string }>;
}

const ROLE_CASES: RoleCase[] = [
  {
    role: "Finance Officer",
    denied: [
      { method: "GET", url: "/api/training/sessions", label: "Training" },
      { method: "GET", url: "/api/master-brain/submissions", label: "Master Brain" },
      { method: "GET", url: "/api/migrations", label: "Data Migration" },
      { method: "GET", url: "/api/courses", label: "Courses" },
    ],
  },
  {
    role: "Enrollment Officer",
    denied: [
      { method: "POST", url: "/api/payments/nonexistent/verify", label: "Finance - Payments" },
      { method: "GET", url: "/api/training/sessions", label: "Training" },
      { method: "GET", url: "/api/master-brain/submissions", label: "Master Brain" },
      { method: "GET", url: "/api/migrations", label: "Data Migration" },
    ],
  },
  {
    role: "Student Success Coordinator",
    denied: [
      { method: "POST", url: "/api/payments/nonexistent/verify", label: "Finance - Payments" },
      { method: "GET", url: "/api/training/sessions", label: "Training" },
      { method: "GET", url: "/api/migrations", label: "Data Migration" },
    ],
  },
  {
    role: "Training Coordinator",
    denied: [
      { method: "POST", url: "/api/payments/nonexistent/verify", label: "Finance - Payments" },
      { method: "GET", url: "/api/students", label: "Students" },
      { method: "GET", url: "/api/master-brain/submissions", label: "Master Brain" },
      { method: "GET", url: "/api/migrations", label: "Data Migration" },
    ],
  },
  {
    role: "Inventory Officer",
    denied: [
      { method: "GET", url: "/api/students", label: "Students" },
      { method: "POST", url: "/api/payments/nonexistent/verify", label: "Finance - Payments" },
      { method: "GET", url: "/api/training/sessions", label: "Training" },
      { method: "GET", url: "/api/migrations", label: "Data Migration" },
    ],
  },
  {
    role: "Marketing Staff",
    denied: [
      { method: "GET", url: "/api/students", label: "Students" },
      { method: "POST", url: "/api/payments/nonexistent/verify", label: "Finance - Payments" },
      { method: "GET", url: "/api/training/sessions", label: "Training" },
      { method: "GET", url: "/api/migrations", label: "Data Migration" },
    ],
  },
  {
    role: "Support Staff",
    denied: [
      { method: "POST", url: "/api/payments/nonexistent/verify", label: "Finance - Payments" },
      { method: "GET", url: "/api/training/sessions", label: "Training" },
      { method: "GET", url: "/api/master-brain/submissions", label: "Master Brain" },
      { method: "GET", url: "/api/migrations", label: "Data Migration" },
    ],
  },
  {
    role: "Custom Role",
    denied: [
      { method: "GET", url: "/api/students", label: "Students" },
      { method: "POST", url: "/api/payments/nonexistent/verify", label: "Finance - Payments" },
      { method: "GET", url: "/api/training/sessions", label: "Training" },
      { method: "GET", url: "/api/migrations", label: "Data Migration" },
    ],
  },
];

describe("Each staff role is denied every module outside its own seeded permission matrix", () => {
  for (const { role, denied } of ROLE_CASES) {
    it(`${role}: allowed Dashboard, denied everything outside its own module(s)`, async () => {
      const cookie = await provisionStaff(role, `role-matrix-${role.toLowerCase().replace(/\s+/g, "-")}`);

      const allowed = await app.inject({ method: "GET", url: "/api/dashboard/summary", headers: { cookie } });
      expect(allowed.statusCode).toBe(200); // Dashboard VIEW is granted to every seeded role

      for (const route of denied) {
        const res = await app.inject({ method: route.method, url: route.url, headers: { cookie } });
        expect(res.statusCode, `${role} should be denied ${route.label} (${route.method} ${route.url})`).toBe(403);
      }
    });
  }
});

describe("Owner and Administrator are denied nothing across these same modules", () => {
  it("Owner passes every check the restricted roles above failed", async () => {
    const students = await app.inject({ method: "GET", url: "/api/students", headers: { cookie: ownerCookie } });
    expect(students.statusCode).toBe(200);
    const training = await app.inject({ method: "GET", url: "/api/training/sessions", headers: { cookie: ownerCookie } });
    expect(training.statusCode).toBe(200);
    const masterBrain = await app.inject({ method: "GET", url: "/api/master-brain/submissions", headers: { cookie: ownerCookie } });
    expect(masterBrain.statusCode).toBe(200);
    const migrations = await app.inject({ method: "GET", url: "/api/migrations", headers: { cookie: ownerCookie } });
    expect(migrations.statusCode).toBe(200);
  });

  it("Administrator has the identical full-access matrix as Owner", async () => {
    const cookie = await provisionStaff("Administrator", "role-matrix-administrator");
    const students = await app.inject({ method: "GET", url: "/api/students", headers: { cookie } });
    expect(students.statusCode).toBe(200);
    const migrations = await app.inject({ method: "GET", url: "/api/migrations", headers: { cookie } });
    expect(migrations.statusCode).toBe(200);
  });
});
