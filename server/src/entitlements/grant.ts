// Entitlement grant/revoke engine (spec sections 10-11, 19-21, 86-89).
// Product inheritance is expanded ONCE at grant time into deduplicated
// Entitlement rows — the resolver never walks the inheritance graph per
// request, and granting a Level that includes other Levels never creates
// duplicate rows for the same feature (spec section 21).

import { db } from "../db.js";
import { writeAuditLog } from "../audit/log.js";
import { generateEntitlementDisplayId } from "../modules/sequence.js";

type CommerceProductRow = Awaited<ReturnType<typeof db.commerceProduct.findUniqueOrThrow>>;

interface FeatureGrant {
  featureKey: string;
  usageLimit?: number | null;
  usagePeriod?: string | null;
  businessLimit?: number | null;
  teamSeatLimit?: number | null;
}

function isMoreGenerous(a: FeatureGrant, b: FeatureGrant): boolean {
  if (a.usageLimit == null) return true; // unlimited beats any number
  if (b.usageLimit == null) return false;
  return a.usageLimit > b.usageLimit;
}

/** Walks includesProductIds recursively (cycle-safe), collecting the deduplicated, most-generous grant per featureKey across the whole inheritance chain. */
export async function expandProductFeatures(rootProductId: string): Promise<FeatureGrant[]> {
  const visited = new Set<string>();
  const grants = new Map<string, FeatureGrant>();

  async function walk(productId: string) {
    if (visited.has(productId)) return;
    visited.add(productId);
    const product = await db.commerceProduct.findUnique({ where: { id: productId } });
    if (!product) return;
    for (const g of product.entitlementsJson as unknown as FeatureGrant[]) {
      const existing = grants.get(g.featureKey);
      if (!existing || isMoreGenerous(g, existing)) grants.set(g.featureKey, g);
    }
    for (const includedId of product.includesProductIds as string[]) {
      await walk(includedId);
    }
  }

  await walk(rootProductId);
  return Array.from(grants.values());
}

export interface GrantProductInput {
  studentId: string;
  businessId?: string;
  product: CommerceProductRow;
  source: string;
  sourceRecordId?: string;
  createdById: string;
}

/** Grants every feature a Product (and everything it includes) confers, idempotently — never a duplicate ACTIVE row for the same student+business+feature+sourceProduct. */
export async function grantProductEntitlements(input: GrantProductInput) {
  const grants = await expandProductFeatures(input.product.id);
  const endDate = input.product.accessDurationDays ? new Date(Date.now() + input.product.accessDurationDays * 24 * 60 * 60 * 1000) : null;
  const created: Awaited<ReturnType<typeof db.entitlement.create>>[] = [];

  for (const grant of grants) {
    const existing = await db.entitlement.findFirst({
      where: { studentId: input.studentId, businessId: input.businessId ?? null, featureKey: grant.featureKey, sourceProductId: input.product.id, status: "ACTIVE" },
    });
    if (existing) {
      created.push(existing);
      continue;
    }
    const row = await db.entitlement.create({
      data: {
        entitlementDisplayId: await generateEntitlementDisplayId(),
        studentId: input.studentId,
        businessId: input.businessId,
        featureKey: grant.featureKey,
        source: input.source,
        sourceProductId: input.product.id,
        sourceRecordId: input.sourceRecordId,
        endDate,
        status: "ACTIVE",
        usageLimit: grant.usageLimit ?? null,
        usagePeriod: grant.usagePeriod ?? null,
        createdById: input.createdById,
      },
    });
    await writeAuditLog({ action: "Entitlement Granted", summary: `Granted ${grant.featureKey} via ${input.product.name} (source: ${input.source})`, actorUserId: input.createdById, entityType: "Entitlement", entityId: row.id });
    created.push(row);
  }
  return created;
}

export async function revokeEntitlement(entitlementId: string, reason: string, actorUserId: string) {
  const entitlement = await db.entitlement.update({ where: { id: entitlementId }, data: { status: "REVOKED" } });
  await writeAuditLog({ action: "Entitlement Revoked", summary: `Entitlement ${entitlement.entitlementDisplayId} revoked: ${reason}`, actorUserId, entityType: "Entitlement", entityId: entitlementId });
  return entitlement;
}

export async function suspendEntitlement(entitlementId: string, reason: string, actorUserId: string) {
  const entitlement = await db.entitlement.update({ where: { id: entitlementId }, data: { status: "SUSPENDED" } });
  await writeAuditLog({ action: "Entitlement Suspended", summary: `Entitlement ${entitlement.entitlementDisplayId} suspended: ${reason}`, actorUserId, entityType: "Entitlement", entityId: entitlementId });
  return entitlement;
}

/** Admin/Owner manual override (spec sections 86-87) — a real, audited Entitlement row like any other, source ADMIN_GRANT, never a silent billing bypass. */
export async function grantOverride(input: { studentId: string; businessId?: string; featureKey: string; reason: string; endDate?: Date; usageLimit?: number; usagePeriod?: string; createdById: string }) {
  const row = await db.entitlement.create({
    data: {
      entitlementDisplayId: await generateEntitlementDisplayId(),
      studentId: input.studentId,
      businessId: input.businessId,
      featureKey: input.featureKey,
      source: "ADMIN_GRANT",
      overrideReason: input.reason,
      endDate: input.endDate,
      usageLimit: input.usageLimit,
      usagePeriod: input.usagePeriod,
      status: "ACTIVE",
      createdById: input.createdById,
    },
  });
  await writeAuditLog({ action: "Entitlement Override Granted", summary: `Manual override: ${input.featureKey} — ${input.reason}`, actorUserId: input.createdById, entityType: "Entitlement", entityId: row.id });
  return row;
}
