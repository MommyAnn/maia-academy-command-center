// M.A.I.A. Emergency Control Center — API (Pre-Pilot Safety Hardening,
// Tasks 1-8). Every route here requires the "Emergency Controls"
// permission module, which by default only Owner/Administrator hold (spec
// Task 7: "Only specifically authorized roles... Student users must never
// access them. Ordinary staff must not access them unless explicitly
// granted."). A Student session is rejected before reaching any handler
// here — requirePermission's own check on ctx.kind !== "staff" (spec
// Task 7's Student exclusion) applies identically to every route below.

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db.js";
import { requireAuth, requirePermission } from "../rbac/middleware.js";
import {
  SAFETY_CONTROL_STATES,
  listControls,
  setControlState,
  getGhlSyncDisplayStatus,
  getAdsSyncDisplayStatus,
  type SafetyControlKey,
} from "./control.js";

// Every state-change body requires BOTH an explicit `confirm: true` and a
// non-trivial `reason` — spec Task 6 ("Do not make accidental single-click
// activation possible") and Task 8 ("Reason where required"). A client
// cannot flip one of these controls by sending an empty/default body.
const toggleSchema = z.object({
  state: z.string().min(1),
  confirm: z.literal(true),
  reason: z.string().min(3, "A short reason is required for this change."),
});

function badState(key: SafetyControlKey, given: string) {
  return `Invalid state "${given}" for ${key}. Allowed: ${SAFETY_CONTROL_STATES[key].join(" or ")}.`;
}

export async function safetyControlRoutes(app: FastifyInstance) {
  // GET status — every control's current real-time state, plus the two
  // sync controls' composite display status (spec Task 2's five-value
  // vocabulary) and last-changed-by/at (spec Task 5's Emergency Control
  // Center screen requirements).
  app.get("/api/admin/safety/status", { preHandler: [requireAuth, requirePermission("Emergency Controls", "VIEW")] }, async (_request, reply) => {
    const controls = await listControls();
    const byKey = Object.fromEntries(controls.map((c) => [c.key, c]));

    const ghlDisplayStatus = await getGhlSyncDisplayStatus(byKey.GHL_SYNC!.state);
    const adsDisplayStatus = await getAdsSyncDisplayStatus(byKey.ADS_SYNC!.state);

    const actorIds = [...new Set(controls.map((c) => c.updatedById).filter((id): id is string => !!id))];
    const actors = actorIds.length ? await db.user.findMany({ where: { id: { in: actorIds } }, include: { person: true } }) : [];
    const actorNameById = new Map(actors.map((a) => [a.id, a.person.fullName]));

    return reply.send({
      controls: controls.map((c) => ({
        key: c.key,
        state: c.state,
        reason: c.reason,
        updatedById: c.updatedById,
        updatedByName: c.updatedById ? (actorNameById.get(c.updatedById) ?? null) : null,
        updatedAt: c.updatedAt,
        // Only the two sync controls carry a composite display status —
        // the other three are already fully described by their own
        // two-value state.
        displayStatus: c.key === "GHL_SYNC" ? ghlDisplayStatus : c.key === "ADS_SYNC" ? adsDisplayStatus : undefined,
      })),
    });
  });

  app.post("/api/admin/safety/checkout", { preHandler: [requireAuth, requirePermission("Emergency Controls", "EDIT")] }, async (request, reply) => {
    const parsed = toggleSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid request." });
    if (!SAFETY_CONTROL_STATES.CHECKOUT.includes(parsed.data.state)) return reply.code(400).send({ error: badState("CHECKOUT", parsed.data.state) });
    const updated = await setControlState({ key: "CHECKOUT", newState: parsed.data.state, actorUserId: request.authContext!.userId, reason: parsed.data.reason });
    return reply.send({ control: updated });
  });

  app.post("/api/admin/safety/ghl-sync", { preHandler: [requireAuth, requirePermission("Emergency Controls", "EDIT")] }, async (request, reply) => {
    const parsed = toggleSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid request." });
    if (!SAFETY_CONTROL_STATES.GHL_SYNC.includes(parsed.data.state)) return reply.code(400).send({ error: badState("GHL_SYNC", parsed.data.state) });
    const updated = await setControlState({ key: "GHL_SYNC", newState: parsed.data.state, actorUserId: request.authContext!.userId, reason: parsed.data.reason });
    return reply.send({ control: updated });
  });

  app.post("/api/admin/safety/ads-sync", { preHandler: [requireAuth, requirePermission("Emergency Controls", "EDIT")] }, async (request, reply) => {
    const parsed = toggleSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid request." });
    if (!SAFETY_CONTROL_STATES.ADS_SYNC.includes(parsed.data.state)) return reply.code(400).send({ error: badState("ADS_SYNC", parsed.data.state) });
    const updated = await setControlState({ key: "ADS_SYNC", newState: parsed.data.state, actorUserId: request.authContext!.userId, reason: parsed.data.reason });
    return reply.send({ control: updated });
  });

  app.post("/api/admin/safety/automations-global", { preHandler: [requireAuth, requirePermission("Emergency Controls", "EDIT")] }, async (request, reply) => {
    const parsed = toggleSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid request." });
    if (!SAFETY_CONTROL_STATES.AUTOMATIONS_GLOBAL.includes(parsed.data.state)) return reply.code(400).send({ error: badState("AUTOMATIONS_GLOBAL", parsed.data.state) });
    const updated = await setControlState({ key: "AUTOMATIONS_GLOBAL", newState: parsed.data.state, actorUserId: request.authContext!.userId, reason: parsed.data.reason });
    return reply.send({ control: updated });
  });

  app.post("/api/admin/safety/maintenance-mode", { preHandler: [requireAuth, requirePermission("Emergency Controls", "EDIT")] }, async (request, reply) => {
    const parsed = toggleSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid request." });
    if (!SAFETY_CONTROL_STATES.MAINTENANCE_MODE.includes(parsed.data.state)) return reply.code(400).send({ error: badState("MAINTENANCE_MODE", parsed.data.state) });
    const updated = await setControlState({ key: "MAINTENANCE_MODE", newState: parsed.data.state, actorUserId: request.authContext!.userId, reason: parsed.data.reason });
    return reply.send({ control: updated });
  });
}
