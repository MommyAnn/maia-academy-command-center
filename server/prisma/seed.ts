// Development/Test seed only (spec section 37: demo data must be clearly
// separated from production data, and never seeded into a real Production
// database — this script is never run against a production DATABASE_URL;
// see the Phase 1 status report for how that's enforced operationally).

import { db } from "../src/db.js";
import { hashPassword } from "../src/auth/password.js";
import { PERMISSION_MODULES, STAFF_ROLES } from "../src/rbac/modules.js";
import { seedAiToolLibrary } from "../src/modules/ai-tools/seed.js";
import { seedDefaultRules } from "../src/modules/intelligence/engine.js";

export { main as runDevSeed };

const ALL_ACTIONS = ["VIEW", "CREATE", "EDIT", "VERIFY", "EXPORT"] as const;

// Mirrors ROLE_DEFAULT_PERMISSIONS in src/data/staffConfig.ts (frontend) —
// a sensible starting point per role, fully editable afterward through the
// same RolePermission table the Roles & Permissions UI will eventually
// read/write once Phase 2 wires it up.
const ROLE_DEFAULTS: Record<string, Partial<Record<(typeof PERMISSION_MODULES)[number], readonly (typeof ALL_ACTIONS)[number][]>>> = {
  Owner: Object.fromEntries(PERMISSION_MODULES.map((m) => [m, ALL_ACTIONS])),
  Administrator: Object.fromEntries(PERMISSION_MODULES.map((m) => [m, ALL_ACTIONS])),
  "Finance Officer": {
    Dashboard: ["VIEW"],
    Students: ["VIEW"],
    "Finance - Payments": ALL_ACTIONS,
    "Finance - Expenses": ALL_ACTIONS,
    "Finance - Reports": ["VIEW", "EXPORT"],
  },
  "Enrollment Officer": {
    Dashboard: ["VIEW"],
    Students: ["VIEW", "CREATE", "EDIT"],
    Enrollment: ALL_ACTIONS,
  },
  "Student Success Coordinator": {
    Dashboard: ["VIEW"],
    Students: ["VIEW", "CREATE", "EDIT"],
    "Master Brain": ["VIEW", "CREATE", "EDIT"],
  },
  "Training Coordinator": {
    Dashboard: ["VIEW"],
    Training: ALL_ACTIONS,
    Certificates: ALL_ACTIONS,
  },
  "Inventory Officer": {
    Dashboard: ["VIEW"],
    Inventory: ALL_ACTIONS,
  },
  "Marketing Staff": {
    Dashboard: ["VIEW"],
    Announcements: ALL_ACTIONS,
    "Feedback - Marketing": ALL_ACTIONS,
  },
  "Support Staff": {
    Dashboard: ["VIEW"],
    Students: ["VIEW"],
  },
  "Custom Role": {
    Dashboard: ["VIEW"],
  },
};

async function main() {
  console.log("Seeding roles + permission matrix...");
  for (const roleName of [...STAFF_ROLES, "Student"]) {
    const role = await db.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName, isCustom: roleName === "Custom Role" },
    });

    const allowedByModule = ROLE_DEFAULTS[roleName] ?? {};
    for (const module of PERMISSION_MODULES) {
      const allowedActions = new Set(allowedByModule[module] ?? []);
      for (const action of ALL_ACTIONS) {
        await db.rolePermission.upsert({
          where: { roleId_module_action: { roleId: role.id, module, action } },
          update: { allowed: allowedActions.has(action) },
          create: { roleId: role.id, module, action, allowed: allowedActions.has(action) },
        });
      }
    }
  }

  console.log("Seeding packages + batch...");
  const premium = await db.package.upsert({ where: { name: "Premium" }, update: {}, create: { name: "Premium", defaultPrice: 25000 } });
  await db.package.upsert({ where: { name: "VIP" }, update: {}, create: { name: "VIP", defaultPrice: 45000 } });
  await db.package.upsert({ where: { name: "Dual VIP" }, update: {}, create: { name: "Dual VIP", defaultPrice: 65000 } });
  const batch14 = await db.batch.upsert({ where: { code: "14" }, update: {}, create: { code: "14", label: "Batch 14" } });

  console.log("Seeding a dev Owner account...");
  const ownerRole = await db.role.findUniqueOrThrow({ where: { name: "Owner" } });
  const ownerPerson = await db.person.upsert({
    where: { id: "seed-owner-person" },
    update: {},
    create: { id: "seed-owner-person", fullName: "Mommy Ann (Dev Seed)", email: "owner-dev@maiaacademy.local" },
  });
  const ownerUser = await db.user.upsert({
    where: { email: "owner-dev@maiaacademy.local" },
    update: {},
    create: {
      personId: ownerPerson.id,
      email: "owner-dev@maiaacademy.local",
      passwordHash: await hashPassword("DevSeedOwner123!"),
      roleId: ownerRole.id,
      status: "ACTIVE",
    },
  });

  console.log("Seeding the AI Tool Library (26 tools) + model configs + provider rows...");
  await seedAiToolLibrary(ownerUser.id);

  console.log("Seeding a dev Finance Officer account (for RBAC-denial tests)...");
  const financeRole = await db.role.findUniqueOrThrow({ where: { name: "Finance Officer" } });
  const financePerson = await db.person.upsert({
    where: { id: "seed-finance-person" },
    update: {},
    create: { id: "seed-finance-person", fullName: "Rica Manalo (Dev Seed)", email: "finance-dev@maiaacademy.local" },
  });
  await db.user.upsert({
    where: { email: "finance-dev@maiaacademy.local" },
    update: {},
    create: {
      personId: financePerson.id,
      email: "finance-dev@maiaacademy.local",
      passwordHash: await hashPassword("DevSeedFinance123!"),
      roleId: financeRole.id,
      status: "ACTIVE",
    },
  });

  console.log("Seeding two dev students (for isolation tests: A must never see B)...");
  const studentRole = await db.role.findUniqueOrThrow({ where: { name: "Student" } });

  const personA = await db.person.upsert({
    where: { id: "seed-student-a-person" },
    update: {},
    create: { id: "seed-student-a-person", fullName: "Carlos Dizon (Dev Seed)", email: "student-a-dev@maiaacademy.local" },
  });
  const studentA = await db.student.upsert({
    where: { studentDisplayId: "MAIA-B14-DEV-A" },
    update: {},
    create: {
      studentDisplayId: "MAIA-B14-DEV-A",
      personId: personA.id,
      batchId: batch14.id,
      packageId: premium.id,
      enrollmentStatus: "Active Student",
    },
  });
  await db.user.upsert({
    where: { email: "student-a-dev@maiaacademy.local" },
    update: {},
    create: {
      personId: personA.id,
      email: "student-a-dev@maiaacademy.local",
      passwordHash: await hashPassword("DevSeedStudentA123!"),
      roleId: studentRole.id,
      status: "ACTIVE",
    },
  });

  const personB = await db.person.upsert({
    where: { id: "seed-student-b-person" },
    update: {},
    create: { id: "seed-student-b-person", fullName: "Maria Santos (Dev Seed)", email: "student-b-dev@maiaacademy.local" },
  });
  const studentB = await db.student.upsert({
    where: { studentDisplayId: "MAIA-B14-DEV-B" },
    update: {},
    create: {
      studentDisplayId: "MAIA-B14-DEV-B",
      personId: personB.id,
      batchId: batch14.id,
      packageId: premium.id,
      enrollmentStatus: "Active Student",
    },
  });
  await db.user.upsert({
    where: { email: "student-b-dev@maiaacademy.local" },
    update: {},
    create: {
      personId: personB.id,
      email: "student-b-dev@maiaacademy.local",
      passwordHash: await hashPassword("DevSeedStudentB123!"),
      roleId: studentRole.id,
      status: "ACTIVE",
    },
  });

  console.log("Seeding M.A.I.A. Intelligence default rules...");
  await seedDefaultRules();

  console.log("Done.", { studentA: studentA.id, studentB: studentB.id });
}

// Only auto-run when executed directly as a script (`npm run prisma:seed`)
// — never when imported by the test suite, which calls runDevSeed() itself
// against the Test database and controls its own lifecycle/teardown.
const isDirectRun = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isDirectRun) {
  main()
    .catch((err) => {
      console.error(err);
      process.exit(1);
    })
    .finally(() => db.$disconnect());
}
