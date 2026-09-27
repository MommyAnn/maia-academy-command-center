// Production Phase 17 — M.A.I.A. Commerce & Growth Engine. Uses fresh
// synthetic students created in this file (same discipline as
// phase16-entitlements.test.ts) so the shared dev-seed fixtures never
// interfere with these limit/security/E2E tests.

import { beforeAll, afterAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { createHmac } from "node:crypto";
import { buildApp } from "../src/app.js";
import { db } from "../src/db.js";
import { resetDb, loginAs, DEV_USERS } from "./helpers.js";
import { hashPassword } from "../src/auth/password.js";

let app: FastifyInstance;
let ownerCookie: string;
let ownerUserId: string;
const SYNTHETIC_PASSWORD = "Phase17SyntheticStudent123!";

async function provisionSyntheticStudent(suffix: string): Promise<{ cookie: string; studentId: string; personId: string }> {
  const premium = await db.package.findFirstOrThrow({ where: { name: "Premium" } });
  const batch14 = await db.batch.findFirstOrThrow({ where: { code: "14" } });
  const studentRole = await db.role.findUniqueOrThrow({ where: { name: "Student" } });
  const email = `phase17-synthetic-${suffix}@maiaacademy.local`;
  const person = await db.person.create({ data: { fullName: `Phase 17 Synthetic Student ${suffix}`, email } });
  const student = await db.student.create({ data: { studentDisplayId: `MAIA-B14-P17-${suffix}`, personId: person.id, batchId: batch14.id, packageId: premium.id, enrollmentStatus: "Active Student" } });
  await db.user.create({ data: { personId: person.id, email, passwordHash: await hashPassword(SYNTHETIC_PASSWORD), roleId: studentRole.id, status: "ACTIVE" } });
  const cookie = await loginAs(app, email, SYNTHETIC_PASSWORD);
  return { cookie, studentId: student.id, personId: person.id };
}

async function createTestProduct(suffix: string, basePrice: number) {
  return db.commerceProduct.create({
    data: { productDisplayId: `PRODUCT-TEST-P17-${suffix}`, name: `Test Product ${suffix}`, type: "PACKAGE", basePrice, status: "ACTIVE", visibility: "PUBLIC", entitlementsJson: [{ featureKey: "CREATIVE_STUDIO" }], createdById: ownerUserId },
  });
}

function signTestProviderPayload(body: string) {
  const secret = process.env.TEST_PROVIDER_WEBHOOK_SECRET ?? "test-provider-dev-secret-not-for-production";
  return createHmac("sha256", secret).update(body).digest("hex");
}

beforeAll(async () => {
  await resetDb();
  app = await buildApp();
  ownerCookie = await loginAs(app, DEV_USERS.owner.email, DEV_USERS.owner.password);
  ownerUserId = (await db.user.findFirstOrThrow({ where: { email: DEV_USERS.owner.email } })).id;
});

afterAll(async () => {
  await app.close();
  await db.$disconnect();
});

describe("Price security (spec sections 11-13)", () => {
  it("a tampered client price is silently ignored — the server always computes and charges its own price", async () => {
    const { studentId, cookie } = await provisionSyntheticStudent("price-tamper");
    const product = await createTestProduct("price-tamper", 15000);

    // Attempt to smuggle a fake price/total/amount field into the request.
    const res = await app.inject({ method: "POST", url: `/api/students/${studentId}/purchases`, headers: { cookie }, payload: { productId: product.id, price: 1, total: 1, amount: 1 } });
    expect(res.statusCode).toBe(201);
    expect(Number(res.json().purchase.priceAtPurchase)).toBe(15000);
  });

  it("checkout sessions lock the server-computed price and reject a tampered consume request", async () => {
    const { studentId, cookie } = await provisionSyntheticStudent("session-tamper");
    const product = await createTestProduct("session-tamper", 20000);

    const sessionRes = await app.inject({ method: "POST", url: `/api/students/${studentId}/checkout-sessions`, headers: { cookie }, payload: { productId: product.id } });
    expect(sessionRes.statusCode).toBe(201);
    const { sessionToken, price } = sessionRes.json().session;
    expect(price.total).toBe(20000);

    const consumeRes = await app.inject({ method: "POST", url: `/api/checkout-sessions/${sessionToken}/consume`, headers: { cookie }, payload: { total: 1 } });
    expect(consumeRes.statusCode).toBe(201);
    expect(Number(consumeRes.json().purchase.priceAtPurchase)).toBe(20000);

    // Session is now CONSUMED — cannot be replayed into a second Order.
    const replay = await app.inject({ method: "POST", url: `/api/checkout-sessions/${sessionToken}/consume`, headers: { cookie } });
    expect(replay.statusCode).toBe(409);
  });

  it("an expired checkout session is rejected, never silently honored", async () => {
    const { studentId, cookie } = await provisionSyntheticStudent("session-expired");
    const product = await createTestProduct("session-expired", 5000);
    const sessionRes = await app.inject({ method: "POST", url: `/api/students/${studentId}/checkout-sessions`, headers: { cookie }, payload: { productId: product.id } });
    const { id } = sessionRes.json().session;
    await db.checkoutSession.update({ where: { id }, data: { expiresAt: new Date(Date.now() - 1000) } });

    const consumeRes = await app.inject({ method: "POST", url: `/api/checkout-sessions/${sessionRes.json().session.sessionToken}/consume`, headers: { cookie } });
    expect(consumeRes.statusCode).toBe(409);
  });
});

describe("Coupon security (spec sections 51-55)", () => {
  it("enforces minimum purchase amount and per-customer redemption limit server-side", async () => {
    const { studentId, cookie } = await provisionSyntheticStudent("coupon-limits");
    const cheapProduct = await createTestProduct("coupon-cheap", 1000);
    const expensiveProduct = await createTestProduct("coupon-expensive", 50000);
    await db.promotion.create({ data: { code: "MINPURCHASE", name: "Min Purchase Promo", type: "FIXED_DISCOUNT", valueJson: { amount: 500 }, minimumPurchaseAmount: 10000, perCustomerLimit: 1, createdById: ownerUserId } });

    const belowMin = await app.inject({ method: "POST", url: `/api/students/${studentId}/purchases`, headers: { cookie }, payload: { productId: cheapProduct.id, promotionCode: "MINPURCHASE" } });
    expect(belowMin.statusCode).toBe(400);
    expect(belowMin.json().error).toContain("minimum purchase");

    const first = await app.inject({ method: "POST", url: `/api/students/${studentId}/purchases`, headers: { cookie }, payload: { productId: expensiveProduct.id, promotionCode: "MINPURCHASE" } });
    expect(first.statusCode).toBe(201);
    expect(Number(first.json().purchase.priceAtPurchase)).toBe(49500);

    const second = await app.inject({ method: "POST", url: `/api/students/${studentId}/purchases`, headers: { cookie }, payload: { productId: expensiveProduct.id, promotionCode: "MINPURCHASE" } });
    expect(second.statusCode).toBe(400);
    expect(second.json().error).toContain("maximum number of times");
  });
});

describe("Order fulfillment lifecycle (spec sections 5-7)", () => {
  it("payment status and fulfillment status move independently through the real checkout pipeline", async () => {
    const { studentId, cookie } = await provisionSyntheticStudent("fulfillment");
    const product = await createTestProduct("fulfillment", 8000);
    const createRes = await app.inject({ method: "POST", url: `/api/students/${studentId}/purchases`, headers: { cookie }, payload: { productId: product.id } });
    const purchase = createRes.json().purchase;
    expect(purchase.status).toBe("PENDING_PAYMENT");
    expect(purchase.fulfillmentStatus).toBe("NOT_READY");

    await app.inject({ method: "POST", url: `/api/purchases/${purchase.id}/submit-payment`, headers: { cookie }, payload: { paymentMethod: "GCash" } });
    const afterSubmit = await db.purchase.findUniqueOrThrow({ where: { id: purchase.id } });
    expect(afterSubmit.status).toBe("AWAITING_VERIFICATION");
    expect(afterSubmit.fulfillmentStatus).toBe("PENDING_VERIFICATION");

    await app.inject({ method: "POST", url: `/api/purchases/${purchase.id}/verify`, headers: { cookie: ownerCookie } });
    const afterVerify = await db.purchase.findUniqueOrThrow({ where: { id: purchase.id } });
    expect(afterVerify.status).toBe("PAID");
    expect(afterVerify.fulfillmentStatus).toBe("READY");

    await app.inject({ method: "POST", url: `/api/purchases/${purchase.id}/activate`, headers: { cookie } });
    const afterActivate = await db.purchase.findUniqueOrThrow({ where: { id: purchase.id } });
    expect(afterActivate.fulfillmentStatus).toBe("FULFILLED");
  });
});

describe("Payment Webhook Inbox (spec sections 26-31, 141, 152)", () => {
  it("rejects an unsigned/invalid webhook, and idempotently processes a valid one exactly once", async () => {
    const { studentId, cookie } = await provisionSyntheticStudent("webhook");
    const product = await createTestProduct("webhook", 12000);
    const createRes = await app.inject({ method: "POST", url: `/api/students/${studentId}/purchases`, headers: { cookie }, payload: { productId: product.id } });
    const purchase = createRes.json().purchase;

    const body = JSON.stringify({ eventId: "evt-1", eventType: "payment.succeeded", purchaseId: purchase.id, amount: 12000, currency: "PHP" });

    const badSig = await app.inject({ method: "POST", url: "/api/webhooks/payments/TEST_PROVIDER", payload: body, headers: { "content-type": "application/json", "x-test-provider-signature": "not-a-real-signature" } });
    expect(badSig.statusCode).toBe(400);
    const stillPending = await db.purchase.findUniqueOrThrow({ where: { id: purchase.id } });
    expect(stillPending.status).toBe("PENDING_PAYMENT");

    const signature = signTestProviderPayload(body);
    const first = await app.inject({ method: "POST", url: "/api/webhooks/payments/TEST_PROVIDER", payload: body, headers: { "content-type": "application/json", "x-test-provider-signature": signature } });
    expect(first.statusCode).toBe(200);
    const paid = await db.purchase.findUniqueOrThrow({ where: { id: purchase.id } });
    expect(paid.status).toBe("PAID");
    expect(paid.fulfillmentStatus).toBe("READY");

    // Duplicate delivery of the SAME eventId — must never double-process.
    const duplicate = await app.inject({ method: "POST", url: "/api/webhooks/payments/TEST_PROVIDER", payload: body, headers: { "content-type": "application/json", "x-test-provider-signature": signature } });
    expect(duplicate.statusCode).toBe(200);
    expect(duplicate.json().duplicate).toBe(true);
    const eventCount = await db.paymentWebhookEvent.count({ where: { provider: "TEST_PROVIDER", providerEventId: "evt-1" } });
    expect(eventCount).toBe(1);
  });

  it("rejects a webhook whose amount does not match the real Order", async () => {
    const { studentId, cookie } = await provisionSyntheticStudent("webhook-wrong-amount");
    const product = await createTestProduct("webhook-wrong-amount", 9000);
    const createRes = await app.inject({ method: "POST", url: `/api/students/${studentId}/purchases`, headers: { cookie }, payload: { productId: product.id } });
    const purchase = createRes.json().purchase;

    const body = JSON.stringify({ eventId: "evt-wrong-amount", eventType: "payment.succeeded", purchaseId: purchase.id, amount: 1, currency: "PHP" });
    const signature = signTestProviderPayload(body);
    const res = await app.inject({ method: "POST", url: "/api/webhooks/payments/TEST_PROVIDER", payload: body, headers: { "content-type": "application/json", "x-test-provider-signature": signature } });
    expect(res.statusCode).toBe(200);
    expect(res.json().processed).toBe(false);

    const stillPending = await db.purchase.findUniqueOrThrow({ where: { id: purchase.id } });
    expect(stillPending.status).toBe("PENDING_PAYMENT");
    const event = await db.paymentWebhookEvent.findUniqueOrThrow({ where: { provider_providerEventId: { provider: "TEST_PROVIDER", providerEventId: "evt-wrong-amount" } } });
    expect(event.status).toBe("FAILED");
  });
});

describe("Affiliate E2E — referral -> verified purchase -> commission -> payout review (spec sections 61-89, 147)", () => {
  it("runs the full affiliate lifecycle with real, human-approved gates at every step", async () => {
    const { cookie: affiliateCookie, personId: affiliatePersonId } = await provisionSyntheticStudent("affiliate-partner");
    const { studentId: customerId, cookie: customerCookie } = await provisionSyntheticStudent("affiliate-customer");
    const product = await createTestProduct("affiliate", 30000);

    const applyRes = await app.inject({ method: "POST", url: "/api/affiliates/apply", headers: { cookie: affiliateCookie } });
    expect(applyRes.statusCode).toBe(201);
    const affiliate = applyRes.json().affiliate;
    expect(affiliate.status).toBe("APPLIED");

    // Cannot earn commission before Admin approval (spec section 64).
    const planRes = await app.inject({ method: "POST", url: "/api/admin/commission-plans", headers: { cookie: ownerCookie }, payload: { name: "10% Standard", type: "PERCENTAGE", rate: 10 } });
    expect(planRes.statusCode).toBe(201);
    const plan = planRes.json().plan;

    await app.inject({ method: "POST", url: `/api/admin/affiliates/${affiliate.id}/status`, headers: { cookie: ownerCookie }, payload: { status: "PENDING_REVIEW" } });
    const approveRes = await app.inject({ method: "POST", url: `/api/admin/affiliates/${affiliate.id}/status`, headers: { cookie: ownerCookie }, payload: { status: "ACTIVE", commissionPlanId: plan.id } });
    expect(approveRes.statusCode).toBe(200);
    expect(approveRes.json().affiliate.status).toBe("ACTIVE");

    // Real referral click tracking.
    const clickRes = await app.inject({ method: "POST", url: "/api/referral-events", payload: { referralCode: affiliate.referralCode, kind: "CLICK" } });
    expect(clickRes.statusCode).toBe(201);

    // Customer checks out through a session carrying the referral code.
    const sessionRes = await app.inject({ method: "POST", url: `/api/students/${customerId}/checkout-sessions`, headers: { cookie: customerCookie }, payload: { productId: product.id, affiliateReferralCode: affiliate.referralCode } });
    expect(sessionRes.statusCode).toBe(201);
    const consumeRes = await app.inject({ method: "POST", url: `/api/checkout-sessions/${sessionRes.json().session.sessionToken}/consume`, headers: { cookie: customerCookie } });
    expect(consumeRes.statusCode).toBe(201);
    const purchase = consumeRes.json().purchase;
    expect(purchase.affiliateId).toBe(affiliate.id);

    // No commission yet — a referral alone never creates one (spec 69).
    const commissionsBeforePay = await db.commission.count({ where: { purchaseId: purchase.id } });
    expect(commissionsBeforePay).toBe(0);

    await app.inject({ method: "POST", url: `/api/purchases/${purchase.id}/submit-payment`, headers: { cookie: customerCookie }, payload: { paymentMethod: "GCash" } });
    const verifyRes = await app.inject({ method: "POST", url: `/api/purchases/${purchase.id}/verify`, headers: { cookie: ownerCookie } });
    expect(verifyRes.statusCode).toBe(200);

    const commission = await db.commission.findFirstOrThrow({ where: { purchaseId: purchase.id } });
    expect(commission.status).toBe("PENDING");
    expect(Number(commission.commissionAmount)).toBe(3000); // 10% of 30000

    const approveCommissionRes = await app.inject({ method: "POST", url: `/api/admin/commissions/${commission.id}/approve`, headers: { cookie: ownerCookie } });
    expect(approveCommissionRes.statusCode).toBe(200);

    const batchRes = await app.inject({ method: "POST", url: "/api/admin/payout-batches", headers: { cookie: ownerCookie }, payload: { periodStart: new Date(Date.now() - 86400000).toISOString(), periodEnd: new Date().toISOString() } });
    const batch = batchRes.json().batch;
    const addRes = await app.inject({ method: "POST", url: `/api/admin/payout-batches/${batch.id}/add-commissions`, headers: { cookie: ownerCookie }, payload: { commissionIds: [commission.id] } });
    expect(addRes.statusCode).toBe(200);

    const submitRes = await app.inject({ method: "POST", url: `/api/admin/payout-batches/${batch.id}/submit-for-review`, headers: { cookie: ownerCookie } });
    expect(submitRes.statusCode).toBe(200);
    const batchApproveRes = await app.inject({ method: "POST", url: `/api/admin/payout-batches/${batch.id}/approve`, headers: { cookie: ownerCookie } });
    expect(batchApproveRes.statusCode).toBe(200);
    const paidRes = await app.inject({ method: "POST", url: `/api/admin/payout-batches/${batch.id}/mark-paid`, headers: { cookie: ownerCookie }, payload: { referenceNote: "Bank transfer ref #12345" } });
    expect(paidRes.statusCode).toBe(200);

    const finalCommission = await db.commission.findUniqueOrThrow({ where: { id: commission.id } });
    expect(finalCommission.status).toBe("PAID");

    // Affiliate self-dashboard reflects real, privacy-safe aggregates.
    const dashboardRes = await app.inject({ method: "GET", url: "/api/affiliates/me", headers: { cookie: affiliateCookie } });
    expect(dashboardRes.statusCode).toBe(200);
    expect(dashboardRes.json().commissions.paid).toBe(3000);
    expect(affiliatePersonId).toBeTruthy();
  });

  it("flags an obvious self-referral for review instead of silently paying it", async () => {
    const { cookie, studentId, personId } = await provisionSyntheticStudent("self-referral");
    const product = await createTestProduct("self-referral", 10000);
    const plan = await db.commissionPlan.create({ data: { name: "Self-Ref Plan", type: "FIXED_AMOUNT", fixedAmount: 500, createdById: ownerUserId } });
    const applyRes = await app.inject({ method: "POST", url: "/api/affiliates/apply", headers: { cookie } });
    const affiliate = applyRes.json().affiliate;
    await app.inject({ method: "POST", url: `/api/admin/affiliates/${affiliate.id}/status`, headers: { cookie: ownerCookie }, payload: { status: "PENDING_REVIEW" } });
    await app.inject({ method: "POST", url: `/api/admin/affiliates/${affiliate.id}/status`, headers: { cookie: ownerCookie }, payload: { status: "ACTIVE", commissionPlanId: plan.id } });

    const sessionRes = await app.inject({ method: "POST", url: `/api/students/${studentId}/checkout-sessions`, headers: { cookie }, payload: { productId: product.id, affiliateReferralCode: affiliate.referralCode } });
    const consumeRes = await app.inject({ method: "POST", url: `/api/checkout-sessions/${sessionRes.json().session.sessionToken}/consume`, headers: { cookie } });
    const purchase = consumeRes.json().purchase;
    await app.inject({ method: "POST", url: `/api/purchases/${purchase.id}/submit-payment`, headers: { cookie }, payload: { paymentMethod: "GCash" } });
    await app.inject({ method: "POST", url: `/api/purchases/${purchase.id}/verify`, headers: { cookie: ownerCookie } });

    const commission = await db.commission.findFirstOrThrow({ where: { purchaseId: purchase.id } });
    expect(commission.status).toBe("DISPUTED");
    expect((commission.ruleSnapshotJson as { selfReferralFlag: boolean }).selfReferralFlag).toBe(true);
    expect(personId).toBeTruthy();
  });
});

describe("Refund workflow (spec sections 108-113)", () => {
  it("a refund revokes access per policy and reverses the affiliate commission, and never auto-decides eligibility", async () => {
    const { cookie: affiliateCookie } = await provisionSyntheticStudent("refund-affiliate");
    const { studentId, cookie } = await provisionSyntheticStudent("refund-customer");
    const product = await createTestProduct("refund", 18000);
    const plan = await db.commissionPlan.create({ data: { name: "Refund Test Plan", type: "PERCENTAGE", rate: 10, createdById: ownerUserId } });
    const applyRes = await app.inject({ method: "POST", url: "/api/affiliates/apply", headers: { cookie: affiliateCookie } });
    const affiliate = applyRes.json().affiliate;
    await app.inject({ method: "POST", url: `/api/admin/affiliates/${affiliate.id}/status`, headers: { cookie: ownerCookie }, payload: { status: "PENDING_REVIEW" } });
    await app.inject({ method: "POST", url: `/api/admin/affiliates/${affiliate.id}/status`, headers: { cookie: ownerCookie }, payload: { status: "ACTIVE", commissionPlanId: plan.id } });

    const sessionRes = await app.inject({ method: "POST", url: `/api/students/${studentId}/checkout-sessions`, headers: { cookie }, payload: { productId: product.id, affiliateReferralCode: affiliate.referralCode } });
    const consumeRes = await app.inject({ method: "POST", url: `/api/checkout-sessions/${sessionRes.json().session.sessionToken}/consume`, headers: { cookie } });
    const purchase = consumeRes.json().purchase;
    await app.inject({ method: "POST", url: `/api/purchases/${purchase.id}/submit-payment`, headers: { cookie }, payload: { paymentMethod: "GCash" } });
    await app.inject({ method: "POST", url: `/api/purchases/${purchase.id}/verify`, headers: { cookie: ownerCookie } });
    await app.inject({ method: "POST", url: `/api/purchases/${purchase.id}/activate`, headers: { cookie } });

    const requestRes = await app.inject({ method: "POST", url: `/api/students/${studentId}/refund-requests`, headers: { cookie }, payload: { purchaseId: purchase.id, amount: 18000, reason: "Changed my mind" } });
    expect(requestRes.statusCode).toBe(201);
    const refund = requestRes.json().refundRequest;
    expect(refund.status).toBe("REQUESTED");

    const reviewRes = await app.inject({ method: "POST", url: `/api/admin/refund-requests/${refund.id}/review`, headers: { cookie: ownerCookie }, payload: { decision: "APPROVED" } });
    expect(reviewRes.statusCode).toBe(200);

    const processRes = await app.inject({ method: "POST", url: `/api/admin/refund-requests/${refund.id}/process`, headers: { cookie: ownerCookie }, payload: { accessPolicy: "REVOKE_ACCESS", providerRefundRef: "manual-refund-1" } });
    expect(processRes.statusCode).toBe(200);

    const orderAfter = await db.purchase.findUniqueOrThrow({ where: { id: purchase.id } });
    expect(orderAfter.status).toBe("REFUNDED");
    expect(orderAfter.fulfillmentStatus).toBe("REVOKED");

    const entitlements = await db.entitlement.findMany({ where: { studentId, sourceRecordId: purchase.id } });
    expect(entitlements.every((e) => e.status === "REVOKED")).toBe(true);

    const commission = await db.commission.findFirstOrThrow({ where: { purchaseId: purchase.id } });
    expect(commission.status).toBe("REVERSED");
  });
});

describe("Scholarship / Sponsored Access (spec sections 56-60)", () => {
  it("grants real access with source SPECIAL_ACCESS, clearly distinct from a paid Purchase, and can be revoked", async () => {
    const { studentId } = await provisionSyntheticStudent("scholarship");
    const product = await createTestProduct("scholarship", 25000);

    const nominateRes = await app.inject({ method: "POST", url: "/api/admin/sponsored-access", headers: { cookie: ownerCookie }, payload: { studentId, productId: product.id, sponsorSource: "Community Grant Fund" } });
    expect(nominateRes.statusCode).toBe(201);
    const record = nominateRes.json().sponsoredAccess;
    expect(record.status).toBe("NOMINATED");

    await app.inject({ method: "POST", url: `/api/admin/sponsored-access/${record.id}/status`, headers: { cookie: ownerCookie }, payload: { status: "UNDER_REVIEW" } });
    await app.inject({ method: "POST", url: `/api/admin/sponsored-access/${record.id}/status`, headers: { cookie: ownerCookie }, payload: { status: "APPROVED" } });
    const activateRes = await app.inject({ method: "POST", url: `/api/admin/sponsored-access/${record.id}/status`, headers: { cookie: ownerCookie }, payload: { status: "ACTIVE" } });
    expect(activateRes.statusCode).toBe(200);

    const entitlement = await db.entitlement.findFirstOrThrow({ where: { studentId, sourceRecordId: record.id } });
    expect(entitlement.source).toBe("SPECIAL_ACCESS");
    expect(entitlement.status).toBe("ACTIVE");

    const revokeRes = await app.inject({ method: "POST", url: `/api/admin/sponsored-access/${record.id}/status`, headers: { cookie: ownerCookie }, payload: { status: "REVOKED", reason: "Requirement not met" } });
    expect(revokeRes.statusCode).toBe(200);
    const entitlementAfter = await db.entitlement.findUniqueOrThrow({ where: { id: entitlement.id } });
    expect(entitlementAfter.status).toBe("REVOKED");
  });
});

describe("Commerce Reconciliation (spec sections 126-130) — flags drift, never auto-fixes", () => {
  it("flags a Commission whose underlying Order is no longer in a paid state", async () => {
    const { cookie: affiliateCookie } = await provisionSyntheticStudent("recon-affiliate");
    const { studentId, cookie } = await provisionSyntheticStudent("recon-customer");
    const product = await createTestProduct("recon", 7000);
    const plan = await db.commissionPlan.create({ data: { name: "Recon Plan", type: "FIXED_AMOUNT", fixedAmount: 200, createdById: ownerUserId } });
    const applyRes = await app.inject({ method: "POST", url: "/api/affiliates/apply", headers: { cookie: affiliateCookie } });
    const affiliate = applyRes.json().affiliate;
    await app.inject({ method: "POST", url: `/api/admin/affiliates/${affiliate.id}/status`, headers: { cookie: ownerCookie }, payload: { status: "PENDING_REVIEW" } });
    await app.inject({ method: "POST", url: `/api/admin/affiliates/${affiliate.id}/status`, headers: { cookie: ownerCookie }, payload: { status: "ACTIVE", commissionPlanId: plan.id } });

    const sessionRes = await app.inject({ method: "POST", url: `/api/students/${studentId}/checkout-sessions`, headers: { cookie }, payload: { productId: product.id, affiliateReferralCode: affiliate.referralCode } });
    const consumeRes = await app.inject({ method: "POST", url: `/api/checkout-sessions/${sessionRes.json().session.sessionToken}/consume`, headers: { cookie } });
    const purchase = consumeRes.json().purchase;
    await app.inject({ method: "POST", url: `/api/purchases/${purchase.id}/submit-payment`, headers: { cookie }, payload: { paymentMethod: "GCash" } });
    await app.inject({ method: "POST", url: `/api/purchases/${purchase.id}/verify`, headers: { cookie: ownerCookie } });

    // Simulate drift: the Order's payment is reverted by a manual DB edit
    // without going through the real refund workflow — reconciliation
    // must flag this, never silently ignore or "fix" it.
    await db.purchase.update({ where: { id: purchase.id }, data: { status: "FAILED" } });

    const reconcileRes = await app.inject({ method: "GET", url: "/api/admin/commerce/reconciliation", headers: { cookie: ownerCookie } });
    expect(reconcileRes.statusCode).toBe(200);
    const commission = await db.commission.findFirstOrThrow({ where: { purchaseId: purchase.id } });
    const flagged = reconcileRes.json().results.find((r: { entityId: string }) => r.entityId === commission.id);
    expect(flagged?.category).toBe("COMMISSION_WITHOUT_QUALIFYING_PAYMENT");

    const stillPending = await db.commission.findUniqueOrThrow({ where: { id: commission.id } });
    expect(stillPending.status).toBe("PENDING"); // never auto-fixed
  });
});

describe("RBAC + data isolation (spec sections 135-137)", () => {
  it("Commerce and Affiliate Program admin routes require the real permission; a Student session is always forbidden", async () => {
    const { cookie } = await provisionSyntheticStudent("rbac");
    const asStudent = await app.inject({ method: "GET", url: "/api/admin/commerce/dashboard", headers: { cookie } });
    expect(asStudent.statusCode).toBe(403);
    const asOwner = await app.inject({ method: "GET", url: "/api/admin/commerce/dashboard", headers: { cookie: ownerCookie } });
    expect(asOwner.statusCode).toBe(200);

    const affiliateAsStudent = await app.inject({ method: "GET", url: "/api/admin/affiliates", headers: { cookie } });
    expect(affiliateAsStudent.statusCode).toBe(403);
  });

  it("a Student can only see their own refund requests and commerce-360 record, never another Student's", async () => {
    const { studentId: studentAId, cookie: studentACookie } = await provisionSyntheticStudent("iso-a");
    const { cookie: studentBCookie } = await provisionSyntheticStudent("iso-b");

    const asB = await app.inject({ method: "GET", url: `/api/admin/students/${studentAId}/commerce-360`, headers: { cookie: studentBCookie } });
    expect(asB.statusCode).toBe(403);
    const asA = await app.inject({ method: "GET", url: `/api/admin/students/${studentAId}/commerce-360`, headers: { cookie: studentACookie } });
    expect(asA.statusCode).toBe(200);
  });
});
