import path from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { hashPassword } from "./auth.ts";
import { get, openDatabase, run } from "./db.ts";
import { seed } from "./seed.ts";

/**
 * Creates (or promotes) an admin account.
 *   npm run create-admin -- --email you@example.com --name "Mommy Ann"
 * The password is asked for interactively so it never lands in shell history.
 * (For automation, ADMIN_PASSWORD can be provided as an environment variable.)
 */
const { values } = parseArgs({
  options: { email: { type: "string" }, name: { type: "string", default: "Administrator" } },
});
if (!values.email) {
  console.error('Usage: npm run create-admin -- --email you@example.com --name "Mommy Ann"');
  process.exit(1);
}

let password = process.env.ADMIN_PASSWORD ?? "";
if (!password) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  password = await rl.question("Choose a password (at least 10 characters): ");
  rl.close();
}
if (password.length < 10) {
  console.error("Password must be at least 10 characters.");
  process.exit(1);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const db = openDatabase(path.resolve(root, process.env.DATA_DIR || "data"));
seed(db);
const email = values.email.trim().toLowerCase();
const hash = await hashPassword(password);
if (get(db, "SELECT id FROM users WHERE email = ?", email)) {
  run(db, "UPDATE users SET role = 'admin', status = 'active', password_hash = ? WHERE email = ?", hash, email);
  console.log(`Updated ${email}: now an active admin with the new password.`);
} else {
  run(db, "INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, 'admin')", email, values.name, hash);
  console.log(`Created admin account ${email}.`);
}
