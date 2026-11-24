// One-time production bootstrap: creates (or re-roles) the first AI Video
// Creator administrator. The dev seed (prisma/seed.ts) must never run against
// production, so this is the supported way to get the first admin login.
//
//   cd server
//   NODE_ENV=production npx tsx scripts/create-admin.ts --email you@yourbusiness.com --name "Your Name"
//
// Prints a generated temporary password ONCE (or uses ADMIN_PASSWORD if set).
// Log in at /studio/login and change it under Account Settings.

import { randomBytes } from "node:crypto";
import { db } from "../src/db.js";
import { hashPassword, validatePasswordStrength } from "../src/auth/password.js";
import { PERMISSION_MODULES, PERMISSION_ACTIONS } from "../src/rbac/modules.js";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

const email = arg("email")?.trim().toLowerCase();
const fullName = arg("name")?.trim();
if (!email || !fullName) {
  console.error('Usage: npx tsx scripts/create-admin.ts --email you@example.com --name "Your Name"');
  process.exit(1);
}

const password = process.env.ADMIN_PASSWORD || `Maia-${randomBytes(9).toString("base64url")}7a`;
const weak = validatePasswordStrength(password);
if (weak) {
  console.error(`ADMIN_PASSWORD rejected: ${weak}`);
  process.exit(1);
}

// Owner role with every permission module (idempotent).
const owner = await db.role.upsert({ where: { name: "Owner" }, update: {}, create: { name: "Owner" } });
await db.role.upsert({ where: { name: "Student" }, update: {}, create: { name: "Student" } });
for (const module of PERMISSION_MODULES) {
  for (const action of PERMISSION_ACTIONS) {
    await db.rolePermission.upsert({
      where: { roleId_module_action: { roleId: owner.id, module, action } },
      update: { allowed: true },
      create: { roleId: owner.id, module, action, allowed: true },
    });
  }
}

const existing = await db.user.findUnique({ where: { email } });
if (existing) {
  if (await db.student.findUnique({ where: { personId: existing.personId } })) {
    console.error("That email belongs to a customer account. Use a different email for the admin.");
    process.exit(1);
  }
  await db.user.update({ where: { id: existing.id }, data: { roleId: owner.id, status: "ACTIVE", passwordHash: await hashPassword(password) } });
  console.log(`Updated existing user ${email}: role Owner, password reset.`);
} else {
  const person = await db.person.create({ data: { fullName, email } });
  await db.user.create({ data: { personId: person.id, email, passwordHash: await hashPassword(password), roleId: owner.id, status: "ACTIVE" } });
  console.log(`Created admin ${email}.`);
}
if (!process.env.ADMIN_PASSWORD) console.log(`Temporary password (shown once): ${password}`);
console.log("Log in at /studio/login, then change the password under Account Settings.");
await db.$disconnect();
