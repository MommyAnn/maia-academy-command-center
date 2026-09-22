import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import type { StorageDriver } from "./index.js";
import { env } from "../env.js";

// Development-only driver (spec section 19: "must NOT be placed in
// permanently public storage"). Files are written OUTSIDE any directory
// Fastify ever serves statically — there is no route in this app that maps
// a URL directly onto this folder, so a key is useless without going
// through the signed-download endpoint below, exactly like a real S3
// private bucket. See env.ts, which refuses to start this driver in
// production.

const root = resolve(env.STORAGE_LOCAL_DIR);

function safeResolve(key: string): string {
  const target = resolve(root, key);
  if (!target.startsWith(root + sep) && target !== root) {
    throw new Error("Rejected storage key: path traversal attempt.");
  }
  return target;
}

export const localDriver: StorageDriver = {
  async save(key, data) {
    const target = safeResolve(key);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, data);
  },
  async read(key) {
    return readFile(safeResolve(key));
  },
  async remove(key) {
    await rm(safeResolve(key), { force: true });
  },
};

export function buildStorageKey(ownerStudentId: string, documentType: string, originalFilename: string): string {
  const safeName = originalFilename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return join(ownerStudentId, documentType, `${unique}-${safeName}`);
}
