// M.A.I.A. Entitlement Resolver (Production Phase 16, spec sections 13-15).
// The single place every feature-gated route asks "is this allowed?" —
// never a scattered `if (package === "VIP")` check (spec section 16).
// Deliberately does NOT handle COURSE_ACCESS (that stays on the existing,
// proven CourseAccessGrant/resolveCourseAccess system — spec section 26)
// nor fine-grained AI generation usage (that stays on the existing
// AiUsageLimit system from Phase 6) — this resolver's real job is the
// software features that shipped with zero commercial gating in Phases
// 6/10-15, plus the unifying usage-limit mechanics for the handful of
// features that have a real, derivable usage count.

import { db } from "../db.js";

export type EntitlementDecision = "ALLOWED" | "DENIED" | "LIMIT_REACHED" | "EXPIRED" | "REQUIRES_UPGRADE" | "REQUIRES_PAYMENT" | "SUSPENDED";

export interface ResolveInput {
  studentId: string;
  businessId?: string;
  featureKey: string;
}

export interface UsageInfo {
  used: number;
  limit: number;
  periodKey: string;
}

export interface ResolveResult {
  decision: EntitlementDecision;
  reason: string;
  entitlementId?: string;
  usage?: UsageInfo;
}

type EntitlementRow = Awaited<ReturnType<typeof db.entitlement.findMany>>[number];

function isActiveRow(row: EntitlementRow, now: Date): boolean {
  return row.status === "ACTIVE" && (!row.endDate || row.endDate > now);
}

/** "2026-09" for MONTHLY, "2026-09-27" for DAILY/WEEKLY (ISO week not needed at this granularity), "ALL" for NEVER/unset/CUSTOM. */
export function computePeriodKey(usagePeriod: string | null | undefined, now = new Date()): string {
  const iso = now.toISOString();
  switch (usagePeriod) {
    case "DAILY":
      return iso.slice(0, 10);
    case "WEEKLY": {
      const d = new Date(now);
      const day = (d.getUTCDay() + 6) % 7; // Monday-start week
      d.setUTCDate(d.getUTCDate() - day);
      return `WEEK-${d.toISOString().slice(0, 10)}`;
    }
    case "MONTHLY":
    case "BILLING_CYCLE":
      return iso.slice(0, 7);
    default:
      return "ALL"; // NEVER | CUSTOM | unset
  }
}

// Real, derivable usage counters for the small set of features that have
// one (spec section 34: "Do not trust frontend counters" — every count
// below is a real query, never a client-supplied number). Any feature not
// listed here has no usage tracking yet — honestly unlimited within this
// build rather than a fabricated count.
async function countUsage(row: EntitlementRow, periodKey: string): Promise<number> {
  if (row.featureKey === "MULTIPLE_BUSINESSES") {
    return db.business.count({ where: { studentId: row.studentId } });
  }
  return db.usageReservation.count({
    where: { studentId: row.studentId, featureKey: row.featureKey, periodKey, status: { in: ["RESERVED", "FINALIZED_SUCCESS"] } },
  });
}

export async function resolveEntitlement(input: ResolveInput): Promise<ResolveResult> {
  const now = new Date();
  const rows = await db.entitlement.findMany({ where: { studentId: input.studentId, featureKey: input.featureKey } });
  const candidates = rows.filter((r) => r.businessId === null || r.businessId === (input.businessId ?? null));
  // Business-scoped rows win over account-wide ones when both exist.
  const ordered = [...candidates.filter((r) => r.businessId !== null), ...candidates.filter((r) => r.businessId === null)];

  // When more than one active row grants the same feature (e.g. a base
  // plan grant plus an Admin override), the MOST GENEROUS one governs —
  // never an arbitrary first-match — so an unlimited override always
  // actually overrides a capped plan grant (spec sections 86-87).
  const activeRows = ordered.filter((r) => isActiveRow(r, now));
  const active = activeRows.reduce<EntitlementRow | undefined>((best, row) => {
    if (!best) return row;
    if (best.usageLimit == null) return best;
    if (row.usageLimit == null) return row;
    return row.usageLimit > best.usageLimit ? row : best;
  }, undefined);
  if (active) {
    if (active.usageLimit != null) {
      const periodKey = computePeriodKey(active.usagePeriod, now);
      const used = await countUsage(active, periodKey);
      if (used >= active.usageLimit) {
        return { decision: "LIMIT_REACHED", reason: `Usage limit reached (${used}/${active.usageLimit}).`, entitlementId: active.id, usage: { used, limit: active.usageLimit, periodKey } };
      }
      return { decision: "ALLOWED", reason: `Included — ${used}/${active.usageLimit} used this period.`, entitlementId: active.id, usage: { used, limit: active.usageLimit, periodKey } };
    }
    return { decision: "ALLOWED", reason: "Included in your current access.", entitlementId: active.id };
  }

  const expired = ordered.find((r) => r.status === "ACTIVE" && r.endDate && r.endDate <= now);
  if (expired) return { decision: "EXPIRED", reason: `Access to this feature expired on ${expired.endDate!.toISOString().slice(0, 10)}.`, entitlementId: expired.id };

  const suspended = ordered.find((r) => r.status === "SUSPENDED");
  if (suspended) return { decision: "SUSPENDED", reason: "Access to this feature is currently suspended.", entitlementId: suspended.id };

  const pending = ordered.find((r) => r.status === "PENDING");
  if (pending) return { decision: "REQUIRES_PAYMENT", reason: "A purchase for this feature is awaiting payment verification.", entitlementId: pending.id };

  return { decision: "REQUIRES_UPGRADE", reason: "This feature is not included in your current access. Upgrade required." };
}
