// Payment Webhook Inbox (Production Phase 17, spec sections 26-31, 141,
// 152). Every inbound event is verified, deduplicated on
// (provider, providerEventId) so a retried/replayed delivery can never be
// processed twice, and only ever advances an Order's real payment state —
// it never invents a PAID status for an unverified or pending event.

import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import { db } from "../db.js";
import { requireAuth, requirePermission } from "../rbac/middleware.js";
import { writeAuditLog } from "../audit/log.js";
import { getPaymentProvider } from "./payment-providers.js";
import { setFulfillmentStatus } from "./order.js";

interface TestProviderPayload {
  eventId: string;
  eventType: "payment.succeeded" | "payment.failed" | string;
  purchaseId?: string;
  amount?: number;
  currency?: string;
}

export async function webhookRoutes(app: FastifyInstance) {
  // Scoped to this plugin only (Fastify's per-plugin encapsulation) — the
  // rest of the app keeps its normal JSON body parsing. Raw bytes are
  // required here because a provider signs the EXACT payload it sent;
  // re-serializing an already-parsed object can never be guaranteed to
  // reproduce the same bytes.
  app.addContentTypeParser("application/json", { parseAs: "string" }, (_req, body, done) => done(null, body));

  app.post("/api/webhooks/payments/:provider", async (request, reply) => {
    const { provider: providerName } = request.params as { provider: string };
    const provider = getPaymentProvider(providerName);
    if (!provider || !provider.capabilities.webhook) return reply.code(404).send({ error: "Unknown or webhook-incapable payment provider." });

    const rawBody = request.body as unknown as string;
    const verification = provider.verifyWebhook(rawBody, request.headers as Record<string, string | string[] | undefined>);

    if (!verification.valid || !verification.eventId) {
      await writeAuditLog({ action: "Webhook Event Rejected", summary: `Rejected ${providerName} webhook: ${verification.reason ?? "invalid signature"}` });
      return reply.code(400).send({ error: "Invalid webhook signature or payload." });
    }

    // Idempotency + replay protection (spec sections 25, 28): the SAME
    // (provider, eventId) can arrive any number of times — only the
    // first delivery is ever processed.
    const existing = await db.paymentWebhookEvent.findUnique({ where: { provider_providerEventId: { provider: providerName, providerEventId: verification.eventId } } });
    if (existing) {
      if (existing.status === "PROCESSED" || existing.status === "IGNORED_DUPLICATE") {
        await db.paymentWebhookEvent.update({ where: { id: existing.id }, data: { status: "IGNORED_DUPLICATE" } });
        return reply.code(200).send({ ok: true, duplicate: true });
      }
      // A prior delivery is still mid-processing or previously failed —
      // fall through and retry processing rather than silently dropping it.
    }

    let payload: TestProviderPayload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return reply.code(400).send({ error: "Malformed JSON payload." });
    }

    const event = await db.paymentWebhookEvent.upsert({
      where: { provider_providerEventId: { provider: providerName, providerEventId: verification.eventId } },
      create: { provider: providerName, providerEventId: verification.eventId, eventType: verification.eventType ?? payload.eventType, payloadJson: payload as unknown as Prisma.InputJsonValue, signatureValid: true, status: "VERIFIED" },
      update: { status: "PROCESSING" },
    });
    await writeAuditLog({ action: "Webhook Event Received", summary: `${providerName} webhook ${verification.eventType} (${verification.eventId}) verified`, entityType: "PaymentWebhookEvent", entityId: event.id });

    try {
      await processTestProviderEvent(payload, event.id);
      await db.paymentWebhookEvent.update({ where: { id: event.id }, data: { status: "PROCESSED", processedAt: new Date() } });
      await writeAuditLog({ action: "Webhook Event Processed", summary: `${providerName} webhook ${verification.eventId} processed`, entityType: "PaymentWebhookEvent", entityId: event.id });
    } catch (err) {
      await db.paymentWebhookEvent.update({ where: { id: event.id }, data: { status: "FAILED", errorMessage: err instanceof Error ? err.message : "Unknown error" } });
      // Still 200 — the event was received and durably recorded; a
      // processing failure is retried by re-delivery, not by the caller
      // treating this as "never happened".
      return reply.code(200).send({ ok: true, processed: false });
    }
    return reply.code(200).send({ ok: true, processed: true });
  });

  app.get("/api/admin/webhooks/payments", { preHandler: [requireAuth, requirePermission("Commerce", "VIEW")] }, async (request, reply) => {
    const { status } = request.query as { status?: string };
    const events = await db.paymentWebhookEvent.findMany({ where: { status: status || undefined }, orderBy: { receivedAt: "desc" }, take: 100 });
    return reply.send({ events });
  });
}

async function processTestProviderEvent(payload: TestProviderPayload, webhookEventId: string) {
  if (!payload.purchaseId) return; // nothing to act on — recorded but no linked Order
  const purchase = await db.purchase.findUnique({ where: { id: payload.purchaseId } });
  if (!purchase) throw new Error(`Webhook references unknown Purchase ${payload.purchaseId}.`);

  // Wrong-amount / wrong-currency protection (spec section 141) — a
  // provider event that doesn't match the real Order it claims to be for
  // is a data-integrity problem, never silently accepted.
  if (payload.amount != null && Math.abs(payload.amount - Number(purchase.priceAtPurchase)) > 0.01) {
    throw new Error(`Webhook amount ${payload.amount} does not match Order ${purchase.purchaseDisplayId}'s total ${purchase.priceAtPurchase}.`);
  }
  if (payload.currency && payload.currency !== purchase.currency) {
    throw new Error(`Webhook currency ${payload.currency} does not match Order ${purchase.purchaseDisplayId}'s currency ${purchase.currency}.`);
  }

  await db.paymentWebhookEvent.update({ where: { id: webhookEventId }, data: { purchaseId: purchase.id } });

  if (payload.eventType === "payment.succeeded") {
    if (purchase.status === "PAID") return; // idempotent no-op
    await db.purchase.update({ where: { id: purchase.id }, data: { status: "PAID", verifiedAt: new Date() } });
    if (purchase.fulfillmentStatus !== "READY") await setFulfillmentStatus(purchase.id, "READY", null);
  } else if (payload.eventType === "payment.failed") {
    if (purchase.status === "PAID") return; // never downgrade an already-verified payment from an out-of-order event
    await db.purchase.update({ where: { id: purchase.id }, data: { status: "FAILED" } });
  }
}
