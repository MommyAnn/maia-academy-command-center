import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { hashPassword } from "./auth.ts";
import { createApi, errorHandler } from "./app.ts";
import { get, openDatabase, run } from "./db.ts";
import { seed } from "./seed.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
loadEnvFile(path.join(root, ".env"));

const production = process.env.NODE_ENV === "production";
const port = Number(process.env.PORT || 8787);
const dataDir = path.resolve(root, process.env.DATA_DIR || "data");
const uploadDir = path.join(dataDir, "uploads");

const db = openDatabase(dataDir);
seed(db);
await bootstrapAdmin();

const app = createApi({ db, uploadDir, production, publicUrl: process.env.PUBLIC_URL });

if (production) {
  const dist = path.join(root, "dist");
  if (!existsSync(dist)) throw new Error("Missing dist/ — run `npm run build` first.");
  app.use(express.static(dist, { index: false, maxAge: "1h" }));
  const indexHtml = readFileSync(path.join(dist, "index.html"), "utf8");
  app.get(/.*/, (_req, res) => void res.type("html").send(indexHtml));
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({ root, server: { middlewareMode: true }, appType: "spa" });
  app.use(vite.middlewares);
}

app.use(errorHandler);

app.listen(port, () => {
  console.log(`\n  M.A.I.A. Business Solutions Academy running at http://localhost:${port}`);
  console.log(`  Data directory: ${dataDir}${production ? "" : "  (development mode)"}\n`);
  const admins = get<{ n: number }>(db, "SELECT COUNT(*) AS n FROM users WHERE role = 'admin'")!.n;
  if (admins === 0)
    console.log("  No admin account yet. Create one with:\n  npm run create-admin -- --email you@example.com --name \"Mommy Ann\"\n");
});

async function bootstrapAdmin() {
  const email = process.env.ADMIN_EMAIL?.trim();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return;
  if (get(db, "SELECT id FROM users WHERE role = 'admin'")) return;
  if (password.length < 10) throw new Error("ADMIN_PASSWORD must be at least 10 characters.");
  run(
    db,
    "INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, 'admin') ON CONFLICT (email) DO UPDATE SET role = 'admin'",
    email.toLowerCase(),
    "Administrator",
    await hashPassword(password),
  );
  console.log(`  Created admin account for ${email}`);
}

function loadEnvFile(file: string) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
