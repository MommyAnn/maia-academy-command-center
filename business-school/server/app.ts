import express, { type NextFunction, type Request, type Response } from "express";
import { sessionMiddleware } from "./auth.ts";
import type { DB } from "./db.ts";
import { adminRoutes } from "./routes/admin.ts";
import { authRoutes } from "./routes/auth.ts";
import { portalRoutes } from "./routes/portal.ts";
import { publicRoutes } from "./routes/public.ts";
import { HttpError } from "./util.ts";

export type AppOptions = {
  db: DB;
  uploadDir: string;
  production: boolean;
  publicUrl?: string;
};

export function createApi({ db, uploadDir, production, publicUrl }: AppOptions) {
  const app = express();
  app.disable("x-powered-by");
  if (production) app.set("trust proxy", 1);

  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    if (production) res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    next();
  });

  app.use("/api", express.json({ limit: "1mb" }));

  // CSRF defence: every state-changing API call must carry a custom header
  // (browsers cannot send it cross-site without a CORS preflight, which we never allow),
  // and in production the Origin, when present, must be our own site.
  app.use("/api", (req, res, next) => {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
    if (req.get("x-maia-request") !== "1") return void res.status(403).json({ error: "Request blocked." });
    const origin = req.get("origin");
    if (production && publicUrl && origin && origin !== new URL(publicUrl).origin)
      return void res.status(403).json({ error: "Request blocked." });
    next();
  });

  app.use("/api", sessionMiddleware(db));
  app.use("/api", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });

  app.use("/api/public", publicRoutes(db));
  app.use("/api/auth", authRoutes(db, { secureCookies: production }));
  app.use("/api/portal", portalRoutes(db));
  app.use("/api/admin", adminRoutes(db, { uploadDir }));
  app.get("/api/health", (_req, res) => void res.json({ ok: true }));
  app.use("/api", (_req, res) => void res.status(404).json({ error: "Not found." }));
  app.use("/api", errorHandler);

  app.use(
    "/uploads",
    express.static(uploadDir, {
      index: false,
      dotfiles: "deny",
      setHeaders: (res) => res.setHeader("Content-Security-Policy", "default-src 'none'"),
    }),
  );

  return app;
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) return void res.status(err.status).json({ error: err.message });
  const e = err as { type?: string; code?: string; status?: number };
  if (e?.type === "entity.parse.failed") return void res.status(400).json({ error: "Invalid request body." });
  if (e?.code === "LIMIT_FILE_SIZE") return void res.status(400).json({ error: "Image must be 5 MB or smaller." });
  console.error(err);
  res.status(500).json({ error: "Something went wrong. Please try again." });
}
