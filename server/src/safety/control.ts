// M.A.I.A. Pre-Pilot Safety Hardening — Emergency Control Center core.
//
// Every function here reads SafetyControl fresh from the database on every
// call — deliberately never cached in memory — so a change made through
// the Emergency Control Center takes effect on the very next request or
// worker sweep, with no window where a revoked/paused state is still
// served stale (the same "never let a stale check preserve unsafe access"
// principle already applied to the entitlement resolver in Phase 16).
//
// Fail-safe defaults: if a control's row does not exist yet (a brand-new
// environment, before an Admin ever opens the Emergency Control Center),
// every reader falls back to SAFE_DEFAULT_STATE below rather than treating
// "no row" as "no restriction." The row existing is never a precondition
// for the safe/closed behavior.

import { db } from "../db.js";
import { writeAuditLog, type AuditAction } from "../audit/log.js";

export const SAFETY_CONTROL_KEYS = ["CHECKOUT", "GHL_SYNC", "ADS_SYNC", "AUTOMATIONS_GLOBAL", "MAINTENANCE_MODE"] as const;
export type SafetyControlKey = (typeof SAFETY_CONTROL_KEYS)[number];

export function isSafetyControlKey(value: string): value is SafetyControlKey {
  return (SAFETY_CONTROL_KEYS as readonly string[]).includes(value);
}

/** The two states each control may hold — deliberately distinct labels per control so a status value is never ambiguous out of context. */
export const SAFETY_CONTROL_STATES: Record<SafetyControlKey, readonly [string, string]> = {
  CHECKOUT: ["ENABLED", "DISABLED"],
  GHL_SYNC: ["ENABLED", "PAUSED"],
  ADS_SYNC: ["ENABLED", "PAUSED"],
  AUTOMATIONS_GLOBAL: ["ACTIVE", "PAUSED"],
  MAINTENANCE_MODE: ["ON", "OFF"],
};

/**
 * Safe defaults for the current PRE-PILOT state (spec Task 9). CHECKOUT and
 * both sync controls default to their closed/paused state — a fresh
 * environment is safe by construction, before any human ever touches the
 * Emergency Control Center. AUTOMATIONS_GLOBAL defaults to ACTIVE because
 * it is a veto-only switch layered on top of each Automation's own
 * individual status (Phase 12) — its absence must mean "no additional veto
 * in effect," never "silently block every existing automation."
 */
export const SAFE_DEFAULT_STATE: Record<SafetyControlKey, string> = {
  CHECKOUT: "DISABLED",
  GHL_SYNC: "PAUSED",
  ADS_SYNC: "PAUSED",
  AUTOMATIONS_GLOBAL: "ACTIVE",
  MAINTENANCE_MODE: "OFF",
};

const AUDIT_ACTION_FOR_KEY: Record<SafetyControlKey, AuditAction> = {
  CHECKOUT: "Checkout Control Changed",
  GHL_SYNC: "GHL Sync Control Changed",
  ADS_SYNC: "Ads Sync Control Changed",
  AUTOMATIONS_GLOBAL: "Automation Global Pause Changed",
  MAINTENANCE_MODE: "Maintenance Mode Changed",
};

export interface SafetyControlRow {
  key: SafetyControlKey;
  state: string;
  reason: string | null;
  updatedById: string | null;
  updatedAt: Date;
}

/** Real-time state for one control — this is what every enforcement point calls. Never cached. */
export async function getControlState(key: SafetyControlKey): Promise<string> {
  const row = await db.safetyControl.findUnique({ where: { key } });
  return row?.state ?? SAFE_DEFAULT_STATE[key];
}

/** Real-time state for every control, plus who/when — used by the Emergency Control Center's status view. Never cached. */
export async function listControls(): Promise<SafetyControlRow[]> {
  const rows = await db.safetyControl.findMany();
  const byKey = new Map(rows.map((r) => [r.key as SafetyControlKey, r]));
  return SAFETY_CONTROL_KEYS.map((key) => {
    const row = byKey.get(key);
    return {
      key,
      state: row?.state ?? SAFE_DEFAULT_STATE[key],
      reason: row?.reason ?? null,
      updatedById: row?.updatedById ?? null,
      updatedAt: row?.updatedAt ?? new Date(0),
    };
  });
}

export interface SetControlInput {
  key: SafetyControlKey;
  newState: string;
  actorUserId: string;
  reason?: string;
}

/**
 * The ONLY function anywhere in this codebase that may write a
 * SafetyControl row. Validates the new state against SAFETY_CONTROL_STATES
 * (so a caller can never introduce a state literal the rest of the system
 * doesn't understand), records the previous state for the audit trail, and
 * writes exactly one audit log entry naming the control, the previous
 * state, the new state, the authorized user, and the reason — matching
 * spec Task 8 field-for-field. Never accepts or stores anything
 * credential-shaped; `reason` is a short human note, nothing else.
 */
export async function setControlState(input: SetControlInput): Promise<SafetyControlRow> {
  const { key, newState, actorUserId, reason } = input;
  const allowed = SAFETY_CONTROL_STATES[key];
  if (!allowed.includes(newState)) {
    throw new Error(`Invalid state "${newState}" for control "${key}". Allowed: ${allowed.join(", ")}.`);
  }

  const previous = await getControlState(key);

  const updated = await db.safetyControl.upsert({
    where: { key },
    update: { state: newState, reason: reason ?? null, updatedById: actorUserId },
    create: { key, state: newState, reason: reason ?? null, updatedById: actorUserId },
  });

  await writeAuditLog({
    action: AUDIT_ACTION_FOR_KEY[key],
    summary: `${key} changed from "${previous}" to "${newState}"${reason ? ` — reason: ${reason}` : ""}`,
    actorUserId,
    entityType: "SafetyControl",
    entityId: key,
  });

  return { key, state: updated.state, reason: updated.reason, updatedById: updated.updatedById, updatedAt: updated.updatedAt };
}

// ---------------------------------------------------------------------
// Enforcement helpers — one per real gate point. Each reads fresh state.
// ---------------------------------------------------------------------

export async function isCheckoutEnabled(): Promise<boolean> {
  return (await getControlState("CHECKOUT")) === "ENABLED";
}

export async function isGhlSyncEnabled(): Promise<boolean> {
  return (await getControlState("GHL_SYNC")) === "ENABLED";
}

export async function isAdsSyncEnabled(): Promise<boolean> {
  return (await getControlState("ADS_SYNC")) === "ENABLED";
}

export async function areAutomationsGloballyPaused(): Promise<boolean> {
  return (await getControlState("AUTOMATIONS_GLOBAL")) === "PAUSED";
}

export async function isMaintenanceModeOn(): Promise<boolean> {
  return (await getControlState("MAINTENANCE_MODE")) === "ON";
}

// ---------------------------------------------------------------------
// Composite display status for the two sync controls (spec Task 2): a
// human needs to see configuration state and pause state together, not
// just the raw ENABLED/PAUSED toggle. Built entirely from data this
// codebase already stores (GhlIntegrationConfig.status, AdConnection rows)
// — no new health probe is introduced, and no outbound network call is
// ever made just to render this status.
// ---------------------------------------------------------------------

export type SyncDisplayStatus = "NOT_CONFIGURED" | "CONFIGURED_BUT_PAUSED" | "CONNECTED_AND_ACTIVE" | "DEGRADED" | "ERROR";

export async function getGhlSyncDisplayStatus(manualState: string): Promise<SyncDisplayStatus> {
  const config = await db.ghlIntegrationConfig.findUnique({ where: { id: "singleton" } });
  if (!config || config.status === "NOT_CONNECTED") return "NOT_CONFIGURED";
  if (manualState === "PAUSED") return "CONFIGURED_BUT_PAUSED";
  if (config.status === "CONNECTED") return "CONNECTED_AND_ACTIVE";
  if (config.status === "RATE_LIMITED") return "DEGRADED";
  return "ERROR"; // AUTHENTICATION_FAILED | INSUFFICIENT_PERMISSIONS | CONNECTION_ERROR
}

export async function getAdsSyncDisplayStatus(manualState: string): Promise<SyncDisplayStatus> {
  const anyConnected = await db.adConnection.findFirst({ where: { provider: "META", status: "CONNECTED" } });
  if (!anyConnected) return "NOT_CONFIGURED";
  if (manualState === "PAUSED") return "CONFIGURED_BUT_PAUSED";
  const anyDegradedOrError = await db.adConnection.findFirst({ where: { provider: "META", status: { in: ["DEGRADED", "ERROR", "EXPIRED"] } } });
  if (anyDegradedOrError) return anyDegradedOrError.status === "DEGRADED" ? "DEGRADED" : "ERROR";
  return "CONNECTED_AND_ACTIVE";
}
