// Pre-Pilot Safety Hardening Task 3 — real backend Maintenance Mode.
//
// This is a Fastify `onRequest` hook, so it runs BEFORE any route's own
// preHandler/handler — a blocked request never reaches Commerce, AI
// generation, Automations, external sync, or any other mutation API, not
// even to have its auth/RBAC checked first. This is deliberately a
// default-deny allowlist (spec Task 3: "Do not accidentally leave
// [high-impact APIs] operational during maintenance") — anything not
// explicitly listed below is blocked with 503 while maintenance is ON,
// rather than trying to enumerate every dangerous route to block.
//
// The allowlist is intentionally small and each entry is justified:
//   - GET /api/health            — System health (spec Task 3).
//   - POST /api/auth/login       — so an Owner/Admin can authenticate at
//                                  all during an incident ("Authorized
//                                  administrative recovery").
//   - POST /api/auth/logout      — Authentication/logout, explicitly named
//                                  in spec Task 3.
//   - GET  /api/auth/me          — lets an already-logged-in admin's
//                                  session be confirmed by the frontend
//                                  without that itself being blocked.
//   - GET/POST /api/admin/safety/* — the Emergency Control Center itself.
//                                  Without this, nobody could ever turn
//                                  maintenance back OFF. Every request here
//                                  still passes through requirePermission
//                                  ("Emergency Controls") afterward — this
//                                  hook only decides whether the route runs
//                                  at all, never whether the caller is
//                                  authorized.
//
// State is read fresh from the database on every single request — the
// same "never cache a safety check" rule as every other control in this
// module — so flipping maintenance ON takes effect on the very next
// request, and flipping it OFF is visible immediately too.

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { isMaintenanceModeOn } from "./control.js";

const ALLOWLIST: { method: string; pattern: RegExp }[] = [
  { method: "GET", pattern: /^\/api\/health(\/.*)?$/ },
  { method: "POST", pattern: /^\/api\/auth\/login$/ },
  { method: "POST", pattern: /^\/api\/auth\/logout$/ },
  { method: "GET", pattern: /^\/api\/auth\/me$/ },
  { method: "GET", pattern: /^\/api\/admin\/safety\/.*$/ },
  { method: "POST", pattern: /^\/api\/admin\/safety\/.*$/ },
];

function isAllowedDuringMaintenance(method: string, url: string): boolean {
  const path = url.split("?")[0];
  return ALLOWLIST.some((entry) => entry.method === method && entry.pattern.test(path));
}

export function registerMaintenanceModeHook(app: FastifyInstance): void {
  app.addHook("onRequest", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await isMaintenanceModeOn())) return;
    if (isAllowedDuringMaintenance(request.method, request.url)) return;
    reply.code(503).send({ error: "M.A.I.A. is currently in maintenance mode. Please try again shortly." });
    return reply;
  });
}
