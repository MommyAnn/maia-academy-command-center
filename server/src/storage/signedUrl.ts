import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../env.js";

// Time-limited, HMAC-signed download tokens (spec section 19: "Signed
// URLs", "Time-limited URLs"). A token proves two things: which document it
// grants access to, and that it hasn't expired or been tampered with — it
// does NOT bypass the ownership/RBAC check the download route still runs,
// it only replaces "anyone with the link can download forever."

const DEFAULT_TTL_SECONDS = 300; // 5 minutes

export function signDownloadToken(documentId: string, ttlSeconds = DEFAULT_TTL_SECONDS): string {
  const expiresAt = Date.now() + ttlSeconds * 1000;
  const payload = `${documentId}.${expiresAt}`;
  const signature = createHmac("sha256", env.SESSION_SECRET).update(payload).digest("hex");
  return Buffer.from(`${payload}.${signature}`).toString("base64url");
}

export function verifyDownloadToken(token: string): { documentId: string } | null {
  let decoded: string;
  try {
    decoded = Buffer.from(token, "base64url").toString("utf-8");
  } catch {
    return null;
  }
  const parts = decoded.split(".");
  if (parts.length !== 3) return null;
  const [documentId, expiresAtStr, signature] = parts;
  const payload = `${documentId}.${expiresAtStr}`;
  const expected = createHmac("sha256", env.SESSION_SECRET).update(payload).digest("hex");

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  if (Date.now() > Number(expiresAtStr)) return null;
  return { documentId };
}
