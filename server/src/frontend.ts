// Optional: serve the built React app (repo-root `npm run build` -> dist/)
// from this same server, so the app and API share ONE origin in production.
// One origin means the session cookie, video playback and downloads all work
// without any cross-origin configuration. Enabled by SERVE_FRONTEND_DIR.

import type { FastifyInstance } from "fastify";
import { readFile, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".json": "application/json",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

const PAGE_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

export async function registerFrontend(app: FastifyInstance, dir: string) {
  const root = resolve(dir);
  const indexHtml = await readFile(resolve(root, "index.html"));

  app.get("/*", async (request, reply) => {
    const urlPath = decodeURIComponent((request.url.split("?")[0] ?? "/").replace(/^\/+/, ""));
    if (urlPath.startsWith("api/")) return reply.code(404).send({ error: "Not found." });
    reply.header("Content-Security-Policy", PAGE_CSP);
    const target = resolve(root, urlPath || "index.html");
    if (target.startsWith(root + sep)) {
      const info = await stat(target).catch(() => null);
      if (info?.isFile()) {
        reply.header("Content-Type", TYPES[extname(target)] ?? "application/octet-stream");
        // Vite's hashed assets never change; index.html must always be fresh.
        reply.header("Cache-Control", urlPath.startsWith("assets/") ? "public, max-age=31536000, immutable" : "no-cache");
        return reply.send(await readFile(target));
      }
    }
    // SPA fallback: client-side routes like /studio/videos/123.
    reply.header("Content-Type", TYPES[".html"]);
    reply.header("Cache-Control", "no-cache");
    return reply.send(indexHtml);
  });
}
