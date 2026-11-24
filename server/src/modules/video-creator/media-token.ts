import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../../env.js";

// Short-lived signed media links for <video>/<img> tags and downloads. A
// token is bound to one document, one job, one disposition and an expiry; it
// is only ever issued after the ownership check in the route that creates it.

export type Disposition = "inline" | "attachment";

function sign(payload: string): string {
  return createHmac("sha256", env.SESSION_SECRET).update(`vc-media|${payload}`).digest("base64url");
}

export function signMediaToken(documentId: string, jobId: string, disposition: Disposition, ttlSeconds = 3600): string {
  const exp = Date.now() + ttlSeconds * 1000;
  const payload = `${documentId}|${jobId}|${disposition}|${exp}`;
  return Buffer.from(`${payload}|${sign(payload)}`).toString("base64url");
}

export function verifyMediaToken(token: string): { documentId: string; jobId: string; disposition: Disposition } | null {
  let decoded: string;
  try {
    decoded = Buffer.from(token, "base64url").toString("utf-8");
  } catch {
    return null;
  }
  const parts = decoded.split("|");
  if (parts.length !== 5) return null;
  const [documentId, jobId, disposition, exp, signature] = parts as [string, string, string, string, string];
  const expected = sign(`${documentId}|${jobId}|${disposition}|${exp}`);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  if (Date.now() > Number(exp)) return null;
  if (disposition !== "inline" && disposition !== "attachment") return null;
  return { documentId, jobId, disposition };
}
