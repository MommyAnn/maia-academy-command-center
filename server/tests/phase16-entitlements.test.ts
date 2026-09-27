// Production Phase 16 — M.A.I.A. Productization + Packages + Entitlements
// + SaaS Readiness. Uses fresh synthetic students created in this file
// (spec section 109: "Use synthetic students... Do not use real student
// records") so the shared dev-seed fixtures' Level 1 grant/override never
// interferes with these limit/denial tests.

import { beforeAll, afterAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { db } from "../src/db.js";
import { resetDb, loginAs, DEV_USERS } from "./helpers.js";
import { hashPassword } from "../src/auth/password.js";
import { createFakeAnthropicServer } from "./anthropic-fake-server.js";
import { grantProductEntitlements } from "../src/entitlements/grant.js";
import { resolveEntitlement } from "../src/entitlements/resolver.js";

let app: FastifyInstance;
let ownerCookie: string;
let ownerUserId: string;
const fakeAnthropic = createFakeAnthropicServer(4011);
const SYNTHETIC_PASSWORD = "Phase16SyntheticStudent123!";

async function provisionSyntheticStudent(suffix: string): Promise<{ cookie: string; studentId: string }> {
  const premium = await db.package.findFirstOrThrow({ where: { name: "Premium" } });
  const batch14 = await db.batch.findFirstOrThrow({ where: { code: "14" } });
  const studentRole = await db.role.findUniqueOrThrow({ where: { name: "Student" } });
  const email = `phase16-synthetic-${suffix}@maiaacademy.local`;
  const person = await db.person.create({ data: { fullName: `Phase 16 Synthetic Student ${suffix}`, email } });
  const student = await db.student.create({ data: { studentDisplayId: `MAIA-B14-P16-${suffix}`, personId: person.id, batchId: batch14.id, packageId: premium.id, enrollmentStatus: "Active Student" } });
  await db.user.create({ data: { personId: person.id, email, passwordHash: await hashPassword(SYNTHETIC_PASSWORD), roleId: studentRole.id, status: "ACTIVE" } });
  const cookie = await loginAs(app, email, SYNTHETIC_PASSWORD);
  return { cookie, studentId: student.id };
}

beforeAll(async () => {
  await fakeAnthropic.start();
  await resetDb();
  app = await buildApp();
  ownerCookie = await loginAs(app, DEV_USERS.owner.email, DEV_USERS.owner.password);
  ownerUserId = (await db.user.findFirstOrThrow({ where: { email: DEV_USERS.owner.email } })).id;
});

afterAll(async () => {
  await app.close();
  await db.$disconnect();
  await fakeAnthropic.stop();
});

describe("Entitlement Resolver — all seven decisions (spec sections 13-15)", () => {
  it("REQUIRES_UPGRADE when no entitlement exists at all", async () => {
    const { studentId } = await provisionSyntheticStudent("resolver-a");
    const result = await resolveEntitlement({ studentId, featureKey: "BUSINESS_OS" });
    expect(result.decision).toBe("REQUIRES_UPGRADE");
  });

  it("ALLOWED once a real product grants the feature, with real usage info when a limit is configured", async () => {
    const { studentId } = await provisionSyntheticStudent("resolver-b");
    const product = await db.commerceProduct.create({ data: { productDisplayId: "PRODUCT-TEST-RESOLVER-B", name: "Test Product B", type: "PACKAGE", entitlementsJson: [{ featureKey: "MULTIPLE_BUSINESSES", usageLimit: 2 }], createdById: ownerUserId } });
    await grantProductEntitlements({ studentId, product, source: "ADMIN_GRANT", createdById: ownerUserId });
    const result = await resolveEntitlement({ studentId, featureKey: "MULTIPLE_BUSINESSES" });
    expect(result.decision).toBe("ALLOWED");
    expect(result.usage).toEqual({ used: 0, limit: 2, periodKey: "ALL" });
  });

  it("LIMIT_REACHED once real usage meets the configured limit", async () => {
    const { studentId, cookie } = await provisionSyntheticStudent("resolver-c");
    const product = await db.commerceProduct.create({ data: { productDisplayId: "PRODUCT-TEST-RESOLVER-C", name: "Test Product C", type: "PACKAGE", entitlementsJson: [{ featureKey: "MULTIPLE_BUSINESSES", usageLimit: 1 }], createdById: ownerUserId } });
    await grantProductEntitlements({ studentId, product, source: "ADMIN_GRANT", createdById: ownerUserId });

    const firstBusiness = await app.inject({ method: "POST", url: `/api/students/${studentId}/businesses`, headers: { cookie }, payload: { name: "First Business" } });
    expect(firstBusiness.statusCode).toBe(201);

    const result = await resolveEntitlement({ studentId, featureKey: "MULTIPLE_BUSINESSES" });
    expect(result.decision).toBe("LIMIT_REACHED");
    expect(result.usage?.used).toBe(1);

    const secondBusiness = await app.inject({ method: "POST", url: `/api/students/${studentId}/businesses`, headers: { cookie }, payload: { name: "Second Business" } });
    expect(secondBusiness.statusCode).toBe(402);
    expect(secondBusiness.json().decision).toBe("LIMIT_REACHED");
  });

  it("EXPIRED once endDate has passed, SUSPENDED when explicitly suspended, REQUIRES_PAYMENT while PENDING", async () => {
    const { studentId: expiredId } = await provisionSyntheticStudent("resolver-expired");
    await db.entitlement.create({ data: { entitlementDisplayId: "ENT-TEST-EXPIRED", studentId: expiredId, featureKey: "CREATIVE_STUDIO", source: "ADMIN_GRANT", status: "ACTIVE", endDate: new Date(Date.now() - 86400000), createdById: ownerUserId } });
    expect((await resolveEntitlement({ studentId: expiredId, featureKey: "CREATIVE_STUDIO" })).decision).toBe("EXPIRED");

    const { studentId: suspendedId } = await provisionSyntheticStudent("resolver-suspended");
    await db.entitlement.create({ data: { entitlementDisplayId: "ENT-TEST-SUSPENDED", studentId: suspendedId, featureKey: "CREATIVE_STUDIO", source: "ADMIN_GRANT", status: "SUSPENDED", createdById: ownerUserId } });
    expect((await resolveEntitlement({ studentId: suspendedId, featureKey: "CREATIVE_STUDIO" })).decision).toBe("SUSPENDED");

    const { studentId: pendingId } = await provisionSyntheticStudent("resolver-pending");
    await db.entitlement.create({ data: { entitlementDisplayId: "ENT-TEST-PENDING", studentId: pendingId, featureKey: "CREATIVE_STUDIO", source: "ADMIN_GRANT", status: "PENDING", createdById: ownerUserId } });
    expect((await resolveEntitlement({ studentId: pendingId, featureKey: "CREATIVE_STUDIO" })).decision).toBe("REQUIRES_PAYMENT");
  });
});

describe("Backend feature gate — Business OS (spec sections 101-105)", () => {
  it("a locked user manually opening a protected URL is denied (direct URL test), and cannot bypass by tampering with businessId (API tampering test)", async () => {
    const { cookie } = await provisionSyntheticStudent("gate-locked");
    const res = await app.inject({ method: "GET", url: "/api/businesses/anything/home", headers: { cookie } });
    expect(res.statusCode).toBe(402);
    expect(res.json().decision).toBe("REQUIRES_UPGRADE");

    const res2 = await app.inject({ method: "GET", url: "/api/businesses/some-other-tampered-id/home", headers: { cookie } });
    expect(res2.statusCode).toBe(402);
  });

  it("granting BUSINESS_OS unlocks the same route immediately", async () => {
    const { studentId, cookie } = await provisionSyntheticStudent("gate-unlocked");
    const product = await db.commerceProduct.create({ data: { productDisplayId: "PRODUCT-TEST-GATE", name: "Test Gate Product", type: "PACKAGE", entitlementsJson: [{ featureKey: "BUSINESS_OS" }, { featureKey: "MULTIPLE_BUSINESSES", usageLimit: 1 }], createdById: ownerUserId } });
    await grantProductEntitlements({ studentId, product, source: "ADMIN_GRANT", createdById: ownerUserId });

    const business = await app.inject({ method: "POST", url: `/api/students/${studentId}/businesses`, headers: { cookie }, payload: { name: "Unlocked Business" } });
    expect(business.statusCode).toBe(201);
    const businessId = business.json().business.id;
    const homeRes = await app.inject({ method: "GET", url: `/api/businesses/${businessId}/home`, headers: { cookie } });
    expect(homeRes.statusCode).toBe(200);
  });

  it("staff always bypasses the feature-entitlement gate (governed by RBAC permission instead)", async () => {
    const res = await app.inject({ method: "GET", url: "/api/businesses/nonexistent/home", headers: { cookie: ownerCookie } });
    // Owner passes the entitlement gate (staff bypass, governed by the
    // "Business OS" RBAC permission instead) and passes the ownership
    // check (staff hold module-wide access), so the only remaining reason
    // this request fails is that "nonexistent" is not a real business.
    expect(res.statusCode).toBe(404);
  });
});

describe("Idempotent grants — Product inheritance dedup (spec sections 19-21, 51, 112)", () => {
  it("granting a Product twice never creates a duplicate ACTIVE row for the same feature", async () => {
    const { studentId } = await provisionSyntheticStudent("dedup");
    const product = await db.commerceProduct.create({ data: { productDisplayId: "PRODUCT-TEST-DEDUP", name: "Test Dedup Product", type: "PACKAGE", entitlementsJson: [{ featureKey: "CREATIVE_STUDIO" }], createdById: ownerUserId } });

    const first = await grantProductEntitlements({ studentId, product, source: "ADMIN_GRANT", createdById: ownerUserId });
    const second = await grantProductEntitlements({ studentId, product, source: "ADMIN_GRANT", createdById: ownerUserId });
    expect(first[0]!.id).toBe(second[0]!.id);
    const count = await db.entitlement.count({ where: { studentId, featureKey: "CREATIVE_STUDIO" } });
    expect(count).toBe(1);
  });

  it("a Level 3-style product inherits Level 1 + Level 2 features with no duplicate rows, most-generous-wins on overlapping limits", async () => {
    const { studentId } = await provisionSyntheticStudent("inherit");
    const level1 = await db.commerceProduct.create({ data: { productDisplayId: "PRODUCT-TEST-L1", name: "Test Level 1", type: "PACKAGE", entitlementsJson: [{ featureKey: "BUSINESS_OS" }, { featureKey: "MULTIPLE_BUSINESSES", usageLimit: 1 }], createdById: ownerUserId } });
    const level2 = await db.commerceProduct.create({ data: { productDisplayId: "PRODUCT-TEST-L2", name: "Test Level 2", type: "PACKAGE", includesProductIds: [level1.id], entitlementsJson: [{ featureKey: "AUTOMATION_STUDIO" }], createdById: ownerUserId } });
    const level3 = await db.commerceProduct.create({ data: { productDisplayId: "PRODUCT-TEST-L3", name: "Test Level 3", type: "PACKAGE", includesProductIds: [level2.id], entitlementsJson: [{ featureKey: "MULTIPLE_BUSINESSES", usageLimit: 5 }, { featureKey: "ADS_INTELLIGENCE" }], createdById: ownerUserId } });

    const granted = await grantProductEntitlements({ studentId, product: level3, source: "PACKAGE", createdById: ownerUserId });
    const featureKeys = granted.map((g) => g.featureKey).sort();
    expect(featureKeys).toEqual(["ADS_INTELLIGENCE", "AUTOMATION_STUDIO", "BUSINESS_OS", "MULTIPLE_BUSINESSES"]);
    const businessLimitRow = granted.find((g) => g.featureKey === "MULTIPLE_BUSINESSES")!;
    expect(businessLimitRow.usageLimit).toBe(5); // Level 3's own limit (5) beats Level 1's (1) — most generous wins.
  });
});

describe("Checkout: purchase -> submit-payment -> verify -> activate (spec sections 47-51, 115-116)", () => {
  it("a PENDING/AWAITING purchase never grants access; activation is idempotent and grants real entitlements", async () => {
    const { studentId, cookie } = await provisionSyntheticStudent("checkout");
    const product = await db.commerceProduct.create({ data: { productDisplayId: "PRODUCT-TEST-CHECKOUT", name: "Test Checkout Product", type: "PACKAGE", basePrice: 10000, entitlementsJson: [{ featureKey: "CREATIVE_STUDIO" }], status: "ACTIVE", createdById: ownerUserId } });

    const createRes = await app.inject({ method: "POST", url: `/api/students/${studentId}/purchases`, headers: { cookie }, payload: { productId: product.id } });
    expect(createRes.statusCode).toBe(201);
    const purchase = createRes.json().purchase;
    expect(purchase.status).toBe("PENDING_PAYMENT");
    expect((await resolveEntitlement({ studentId, featureKey: "CREATIVE_STUDIO" })).decision).toBe("REQUIRES_UPGRADE");

    const submitRes = await app.inject({ method: "POST", url: `/api/purchases/${purchase.id}/submit-payment`, headers: { cookie }, payload: { paymentMethod: "GCash", referenceNumber: "REF123" } });
    expect(submitRes.statusCode).toBe(200);
    expect((await resolveEntitlement({ studentId, featureKey: "CREATIVE_STUDIO" })).decision).toBe("REQUIRES_UPGRADE");

    const activateBeforeVerify = await app.inject({ method: "POST", url: `/api/purchases/${purchase.id}/activate`, headers: { cookie } });
    expect(activateBeforeVerify.statusCode).toBe(409);

    const verifyRes = await app.inject({ method: "POST", url: `/api/purchases/${purchase.id}/verify`, headers: { cookie: ownerCookie } });
    expect(verifyRes.statusCode).toBe(200);

    const activate1 = await app.inject({ method: "POST", url: `/api/purchases/${purchase.id}/activate`, headers: { cookie } });
    expect(activate1.statusCode).toBe(200);
    expect(activate1.json().alreadyActivated).toBe(false);
    expect((await resolveEntitlement({ studentId, featureKey: "CREATIVE_STUDIO" })).decision).toBe("ALLOWED");

    // Duplicate activation (spec sections 51, 112) — no duplicate Entitlement row.
    const activate2 = await app.inject({ method: "POST", url: `/api/purchases/${purchase.id}/activate`, headers: { cookie } });
    expect(activate2.statusCode).toBe(200);
    expect(activate2.json().alreadyActivated).toBe(true);
    const count = await db.entitlement.count({ where: { studentId, featureKey: "CREATIVE_STUDIO", sourceRecordId: purchase.id } });
    expect(count).toBe(1);
  });

  it("real, tracked promotion capacity — never a fabricated slot count", async () => {
    const { studentId: s1, cookie: c1 } = await provisionSyntheticStudent("promo-1");
    const { studentId: s2, cookie: c2 } = await provisionSyntheticStudent("promo-2");
    const product = await db.commerceProduct.create({ data: { productDisplayId: "PRODUCT-TEST-PROMO", name: "Test Promo Product", type: "PACKAGE", basePrice: 5000, entitlementsJson: [], status: "ACTIVE", createdById: ownerUserId } });
    const promo = await db.promotion.create({ data: { code: "LIMITED1", name: "One Slot Only", type: "FIXED_DISCOUNT", valueJson: { amount: 1000 }, usageLimit: 1, createdById: ownerUserId } });

    const first = await app.inject({ method: "POST", url: `/api/students/${s1}/purchases`, headers: { cookie: c1 }, payload: { productId: product.id, promotionCode: "LIMITED1" } });
    expect(first.statusCode).toBe(201);
    expect(Number(first.json().purchase.priceAtPurchase)).toBe(4000);

    const second = await app.inject({ method: "POST", url: `/api/students/${s2}/purchases`, headers: { cookie: c2 }, payload: { productId: product.id, promotionCode: "LIMITED1" } });
    expect(second.statusCode).toBe(400);
    expect(second.json().error).toContain("redemption limit");
    const promoAfter = await db.promotion.findUniqueOrThrow({ where: { id: promo.id } });
    expect(promoAfter.redeemedCount).toBe(1);
  });
});

describe("Upgrade / Downgrade (spec sections 60-68)", () => {
  it("upgrade preview never assumes price = newPrice - oldPrice without a configured rule, and execute creates a correctly-priced purchase", async () => {
    const { studentId, cookie } = await provisionSyntheticStudent("upgrade");
    const fromProduct = await db.commerceProduct.create({ data: { productDisplayId: "PRODUCT-TEST-UP-FROM", name: "Upgrade From", type: "PACKAGE", basePrice: 25000, entitlementsJson: [{ featureKey: "CREATIVE_STUDIO" }], createdById: ownerUserId } });
    const toProduct = await db.commerceProduct.create({ data: { productDisplayId: "PRODUCT-TEST-UP-TO", name: "Upgrade To", type: "PACKAGE", basePrice: 45000, entitlementsJson: [{ featureKey: "CREATIVE_STUDIO" }, { featureKey: "AUTOMATION_STUDIO" }], createdById: ownerUserId } });

    const previewNoRule = await app.inject({ method: "GET", url: `/api/students/${studentId}/upgrade-preview?fromProductId=${fromProduct.id}&toProductId=${toProduct.id}`, headers: { cookie } });
    expect(previewNoRule.statusCode).toBe(200);
    expect(previewNoRule.json().upgradePrice).toBe(45000); // full price — no rule configured, never assumed as a difference
    expect(previewNoRule.json().addedFeatures.map((f: { featureKey: string }) => f.featureKey)).toEqual(["AUTOMATION_STUDIO"]);

    await app.inject({ method: "POST", url: "/api/entitlements/upgrade-rules", headers: { cookie: ownerCookie }, payload: { fromProductId: fromProduct.id, toProductId: toProduct.id, upgradePriceRuleJson: { mode: "DIFFERENCE" } } });
    const previewWithRule = await app.inject({ method: "GET", url: `/api/students/${studentId}/upgrade-preview?fromProductId=${fromProduct.id}&toProductId=${toProduct.id}`, headers: { cookie } });
    expect(previewWithRule.json().upgradePrice).toBe(20000);

    const execRes = await app.inject({ method: "POST", url: `/api/students/${studentId}/upgrade`, headers: { cookie }, payload: { fromProductId: fromProduct.id, toProductId: toProduct.id } });
    expect(execRes.statusCode).toBe(201);
    expect(Number(execRes.json().purchase.priceAtPurchase)).toBe(20000);
  });

  it("downgrade never deletes a Business, and correctly revokes the old plan's more generous limit", async () => {
    const { studentId, cookie } = await provisionSyntheticStudent("downgrade");
    const bigProduct = await db.commerceProduct.create({ data: { productDisplayId: "PRODUCT-TEST-DOWN-BIG", name: "Big Plan", type: "PACKAGE", entitlementsJson: [{ featureKey: "MULTIPLE_BUSINESSES", usageLimit: 3 }], createdById: ownerUserId } });
    const smallProduct = await db.commerceProduct.create({ data: { productDisplayId: "PRODUCT-TEST-DOWN-SMALL", name: "Small Plan", type: "PACKAGE", entitlementsJson: [{ featureKey: "MULTIPLE_BUSINESSES", usageLimit: 1 }], createdById: ownerUserId } });
    await grantProductEntitlements({ studentId, product: bigProduct, source: "PACKAGE", createdById: ownerUserId });

    await app.inject({ method: "POST", url: `/api/students/${studentId}/businesses`, headers: { cookie }, payload: { name: "Business One" } });
    await app.inject({ method: "POST", url: `/api/students/${studentId}/businesses`, headers: { cookie }, payload: { name: "Business Two" } });
    const businessCountBefore = await db.business.count({ where: { studentId } });
    expect(businessCountBefore).toBe(2);

    const preview = await app.inject({ method: "GET", url: `/api/students/${studentId}/downgrade-preview?toProductId=${smallProduct.id}`, headers: { cookie } });
    expect(preview.json().warnings.length).toBeGreaterThan(0);
    expect(preview.json().safeToApply).toBe(false);

    const downgradeRes = await app.inject({ method: "POST", url: `/api/students/${studentId}/downgrade`, headers: { cookie }, payload: { fromProductId: bigProduct.id, toProductId: smallProduct.id, acknowledgeDataRetained: true } });
    expect(downgradeRes.statusCode).toBe(200);

    const businessCountAfter = await db.business.count({ where: { studentId } });
    expect(businessCountAfter).toBe(2); // never deleted

    const result = await resolveEntitlement({ studentId, featureKey: "MULTIPLE_BUSINESSES" });
    expect(result.decision).toBe("LIMIT_REACHED"); // now capped at 1, already at 2 -> over limit, correctly enforced going forward
  });
});

describe("Legacy Migration Dry Run + confirmable mapping (spec sections 96-100)", () => {
  it("dry run is read-only, mapping starts unconfirmed, and applying to a student requires an explicit confirm on exactly that student", async () => {
    const dryRun = await app.inject({ method: "GET", url: "/api/admin/entitlements/migration-dry-run", headers: { cookie: ownerCookie } });
    expect(dryRun.statusCode).toBe(200);
    expect(dryRun.json().studentsScanned).toBeGreaterThan(0);

    const mapping = await db.packageMapping.findFirstOrThrow({ where: { legacyPackage: { name: "Premium" } } });
    expect(mapping.confirmed).toBe(false);

    const { studentId } = await provisionSyntheticStudent("legacy");
    const beforeCount = await db.entitlement.count({ where: { studentId } });
    expect(beforeCount).toBe(0);

    const applyBeforeConfirm = await app.inject({ method: "POST", url: `/api/admin/package-mappings/${mapping.id}/apply-to-student`, headers: { cookie: ownerCookie }, payload: { studentId, confirm: true } });
    expect(applyBeforeConfirm.statusCode).toBe(409);

    const confirmRes = await app.inject({ method: "POST", url: `/api/admin/package-mappings/${mapping.id}/confirm`, headers: { cookie: ownerCookie } });
    expect(confirmRes.statusCode).toBe(200);

    // Confirming alone never touches any real student's access.
    const otherStudentUntouched = await db.entitlement.count({ where: { studentId: (await db.student.findUniqueOrThrow({ where: { studentDisplayId: "MAIA-B14-DEV-A" } })).id, source: "LEGACY" } });
    expect(otherStudentUntouched).toBe(0);

    const applyRes = await app.inject({ method: "POST", url: `/api/admin/package-mappings/${mapping.id}/apply-to-student`, headers: { cookie: ownerCookie }, payload: { studentId, confirm: true } });
    expect(applyRes.statusCode).toBe(200);
    const afterCount = await db.entitlement.count({ where: { studentId, source: "LEGACY" } });
    expect(afterCount).toBeGreaterThan(0);
  });
});

describe("Reconciliation (spec sections 134-136) — flags drift, never auto-fixes", () => {
  it("flags an Entitlement that stayed ACTIVE after its Subscription was cancelled", async () => {
    const { studentId } = await provisionSyntheticStudent("reconcile");
    const product = await db.commerceProduct.create({ data: { productDisplayId: "PRODUCT-TEST-RECON", name: "Test Reconciliation Product", type: "SUBSCRIPTION", entitlementsJson: [{ featureKey: "ADS_INTELLIGENCE" }], createdById: ownerUserId } });
    const createSubRes = await app.inject({ method: "POST", url: "/api/admin/subscriptions", headers: { cookie: ownerCookie }, payload: { studentId, productId: product.id, currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() } });
    expect(createSubRes.statusCode).toBe(201);
    const subscriptionId = createSubRes.json().subscription.id;

    // Simulates drift: the subscription is cancelled but its Entitlement is
    // never revoked (a bug elsewhere, or a manual DB edit) — reconciliation
    // must flag this, never silently "fix" it (spec section 136).
    await db.subscription.update({ where: { id: subscriptionId }, data: { status: "CANCELLED" } });

    const reconcileRes = await app.inject({ method: "GET", url: "/api/admin/entitlements/reconciliation", headers: { cookie: ownerCookie } });
    expect(reconcileRes.statusCode).toBe(200);
    const flagged = reconcileRes.json().results.find((r: { entityId: string }) => r.entityId === subscriptionId);
    expect(flagged?.category).toBe("EXPIRED_BUT_ACTIVE");

    // Never auto-fixed — the Entitlement is still ACTIVE after the report ran.
    const stillActive = await db.entitlement.count({ where: { studentId, sourceRecordId: subscriptionId, status: "ACTIVE" } });
    expect(stillActive).toBeGreaterThan(0);
  });
});

describe("Data isolation (spec sections 5, 88, 159) and admin RBAC", () => {
  it("Student B cannot view Student A's My Access, purchases, or entitlements", async () => {
    const { studentId: studentAId, cookie: studentACookie } = await provisionSyntheticStudent("iso-a");
    const { cookie: studentBCookie } = await provisionSyntheticStudent("iso-b");

    const myAccessAsB = await app.inject({ method: "GET", url: `/api/students/${studentAId}/my-access`, headers: { cookie: studentBCookie } });
    expect(myAccessAsB.statusCode).toBe(403);
    const purchasesAsB = await app.inject({ method: "GET", url: `/api/students/${studentAId}/purchases`, headers: { cookie: studentBCookie } });
    expect(purchasesAsB.statusCode).toBe(403);

    const myAccessAsA = await app.inject({ method: "GET", url: `/api/students/${studentAId}/my-access`, headers: { cookie: studentACookie } });
    expect(myAccessAsA.statusCode).toBe(200);
  });

  it("admin-only Product Catalog routes require the real permission; a Student session is always forbidden", async () => {
    const { cookie } = await provisionSyntheticStudent("admin-rbac");
    const asStudent = await app.inject({ method: "GET", url: "/api/entitlements/products", headers: { cookie } });
    expect(asStudent.statusCode).toBe(403);
    const asOwner = await app.inject({ method: "GET", url: "/api/entitlements/products", headers: { cookie: ownerCookie } });
    expect(asOwner.statusCode).toBe(200);
  });

  it("the Student Marketplace catalog is open to any authenticated Student, but only ever shows ACTIVE + PUBLIC products", async () => {
    const { cookie } = await provisionSyntheticStudent("marketplace");
    const draftProduct = await db.commerceProduct.create({ data: { productDisplayId: "PRODUCT-TEST-DRAFT", name: "Draft Product", type: "PACKAGE", status: "DRAFT", visibility: "PUBLIC", createdById: ownerUserId } });
    const hiddenProduct = await db.commerceProduct.create({ data: { productDisplayId: "PRODUCT-TEST-HIDDEN", name: "Hidden Active Product", type: "PACKAGE", status: "ACTIVE", visibility: "HIDDEN", createdById: ownerUserId } });
    const publicActiveProduct = await db.commerceProduct.create({ data: { productDisplayId: "PRODUCT-TEST-PUBLIC", name: "Public Active Product", type: "PACKAGE", status: "ACTIVE", visibility: "PUBLIC", createdById: ownerUserId } });

    const res = await app.inject({ method: "GET", url: "/api/entitlements/catalog", headers: { cookie } });
    expect(res.statusCode).toBe(200);
    const ids = res.json().products.map((p: { id: string }) => p.id);
    expect(ids).toContain(publicActiveProduct.id);
    expect(ids).not.toContain(draftProduct.id);
    expect(ids).not.toContain(hiddenProduct.id);
  });
});

describe("Build With You — service entitlement stays independent of software access (spec section 25)", () => {
  it("granting Build With You alone never confers a software feature, and can be revoked without touching separately-granted software access", async () => {
    const { studentId } = await provisionSyntheticStudent("bwy");
    const buildWithYou = await db.commerceProduct.findFirstOrThrow({ where: { name: "Build With You" } });
    const level1 = await db.commerceProduct.findFirstOrThrow({ where: { name: "M.A.I.A. Level 1" } });

    await grantProductEntitlements({ studentId, product: buildWithYou, source: "BUILD_WITH_YOU", createdById: ownerUserId });
    expect((await resolveEntitlement({ studentId, featureKey: "BUSINESS_OS" })).decision).toBe("REQUIRES_UPGRADE");

    await grantProductEntitlements({ studentId, product: level1, source: "PACKAGE", createdById: ownerUserId });
    expect((await resolveEntitlement({ studentId, featureKey: "BUSINESS_OS" })).decision).toBe("ALLOWED");

    const bwyEntitlement = await db.entitlement.findFirstOrThrow({ where: { studentId, featureKey: "BUILD_WITH_YOU" } });
    await db.entitlement.update({ where: { id: bwyEntitlement.id }, data: { status: "REVOKED" } });

    expect((await resolveEntitlement({ studentId, featureKey: "BUILD_WITH_YOU" })).decision).toBe("REQUIRES_UPGRADE");
    expect((await resolveEntitlement({ studentId, featureKey: "BUSINESS_OS" })).decision).toBe("ALLOWED"); // untouched
  });
});
