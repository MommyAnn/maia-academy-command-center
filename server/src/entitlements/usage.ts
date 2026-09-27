// Reserve-then-finalize usage tracking (spec sections 35-36, 105) — closes
// the multi-tab/concurrent-request bypass: a reservation counts toward the
// limit the moment it's created, before the expensive job even runs, so
// two concurrent requests against the same limit can't both slip through.

import { db } from "../db.js";
import { resolveEntitlement, computePeriodKey } from "./resolver.js";

export type ReserveOutcome = { ok: true; reservationId: string } | { ok: false; decision: string; reason: string };

export async function reserveUsage(input: { studentId: string; businessId?: string; featureKey: string; createdById: string }): Promise<ReserveOutcome> {
  const resolved = await resolveEntitlement(input);
  if (resolved.decision !== "ALLOWED") {
    return { ok: false, decision: resolved.decision, reason: resolved.reason };
  }
  const entitlement = resolved.entitlementId ? await db.entitlement.findUnique({ where: { id: resolved.entitlementId } }) : null;
  const periodKey = computePeriodKey(entitlement?.usagePeriod ?? null);
  const reservation = await db.usageReservation.create({
    data: { featureKey: input.featureKey, studentId: input.studentId, businessId: input.businessId, periodKey, createdById: input.createdById },
  });
  return { ok: true, reservationId: reservation.id };
}

export async function finalizeUsage(reservationId: string, outcome: "SUCCESS" | "FAILURE"): Promise<void> {
  await db.usageReservation.update({
    where: { id: reservationId },
    data: { status: outcome === "SUCCESS" ? "FINALIZED_SUCCESS" : "FINALIZED_FAILURE", finalizedAt: new Date() },
  });
}

/** Releases a reservation without counting it as a failure — used when the caller aborts before even attempting the job. */
export async function releaseUsage(reservationId: string): Promise<void> {
  await db.usageReservation.update({ where: { id: reservationId }, data: { status: "RELEASED", finalizedAt: new Date() } });
}
