// Inbound GHL webhook endpoint (spec sections 33-36) — this is a PUBLIC
// route (HighLevel calls it, no M.A.I.A. session exists), so signature
// verification IS the entire security boundary here, not an add-on.
//
// Per current HighLevel documentation researched for this phase: webhook
// deliveries are signed with Ed25519 and carried in the `X-GHL-Signature`
// header (the legacy `X-WH-Signature`/RSA scheme is deprecated). The raw
// request body bytes — before any JSON parsing/reserialization — are what
// gets signed, so this module installs its own content-type parser (scoped
// to this plugin only, via Fastify's encapsulation) that captures the raw
// buffer before Fastify's default parser ever touches it.

import type { FastifyInstance, FastifyRequest } from "fastify";
import { createPublicKey, verify as verifyEd25519 } from "node:crypto";
import { db } from "../../db.js";
import { env } from "../../env.js";

declare module "fastify" {
  interface FastifyRequest {
    rawBody?: Buffer;
  }
}

// Accepts either a real multi-line PEM (as most hosting env-var UIs store
// it) or a single-line .env value with literal "\n" escapes (the common
// .env-file convention for multi-line secrets) — normalized here so both
// work identically.
function normalizePem(value: string): string {
  return value.includes("\\n") ? value.replace(/\\n/g, "\n") : value;
}

function verifySignature(rawBody: Buffer, signatureHeader: string): boolean {
  if (!env.GHL_WEBHOOK_SIGNATURE_PUBLIC_KEY) return false;
  try {
    const publicKey = createPublicKey(normalizePem(env.GHL_WEBHOOK_SIGNATURE_PUBLIC_KEY));
    const signature = Buffer.from(signatureHeader, "base64");
    // Ed25519 signs the message directly (no separate digest algorithm) —
    // passing `null` here is the correct, documented Node.js API usage.
    return verifyEd25519(null, rawBody, publicKey, signature);
  } catch {
    return false;
  }
}

interface GhlWebhookPayload {
  eventId?: string;
  id?: string;
  webhookId?: string;
  type?: string;
  event?: string;
  contactId?: string;
  locationId?: string;
  dnd?: boolean;
  unsubscribed?: boolean;
  channel?: "Email" | "SMS" | "WhatsApp";
}

export async function ghlWebhookRoutes(app: FastifyInstance) {
  // Scoped to this plugin's encapsulation context only (Fastify plugins are
  // isolated by default) — every other route in the app keeps using
  // Fastify's normal JSON body parser untouched.
  app.addContentTypeParser("application/json", { parseAs: "buffer" }, (request: FastifyRequest, body: Buffer, done) => {
    request.rawBody = body;
    if (body.length === 0) return done(null, {});
    try {
      done(null, JSON.parse(body.toString("utf8")));
    } catch {
      // Malformed JSON is handled inside the route (as an invalid-payload
      // rejection with a real GhlWebhookEvent audit row), never as a
      // generic 400 that skips logging.
      done(null, undefined);
    }
  });

  app.post(
    "/api/ghl/webhook",
    { config: { rateLimit: { max: 120, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const rawBody = request.rawBody ?? Buffer.alloc(0);
      const signatureHeader = request.headers["x-ghl-signature"];

      if (!env.GHL_WEBHOOK_SIGNATURE_PUBLIC_KEY) {
        return reply.code(503).send({ error: "Webhook signature verification is not configured on this server." });
      }
      if (!signatureHeader || typeof signatureHeader !== "string") {
        return reply.code(401).send({ error: "Missing signature." });
      }

      const signatureValid = verifySignature(rawBody, signatureHeader);
      if (!signatureValid) {
        // Logged even when rejected (spec section 62's security-test
        // expectations) — but with no payload trusted or acted on.
        await db.ghlWebhookEvent.create({
          data: {
            externalEventId: `rejected_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            signatureValid: false,
            payloadJson: { note: "Signature verification failed; payload not parsed for trust." },
            processingNote: "REJECTED: invalid signature.",
          },
        });
        return reply.code(401).send({ error: "Invalid signature." });
      }

      const payload = request.body as GhlWebhookPayload | undefined;
      if (!payload || typeof payload !== "object") {
        return reply.code(400).send({ error: "Malformed payload." });
      }

      const externalEventId = payload.eventId ?? payload.id ?? payload.webhookId;
      if (!externalEventId) {
        return reply.code(400).send({ error: "Payload is missing an event id; cannot be safely deduplicated." });
      }

      const existing = await db.ghlWebhookEvent.findUnique({ where: { externalEventId } });
      if (existing) {
        // Idempotent (spec section 31): HighLevel may redeliver — a 200
        // here stops it retrying, without reprocessing anything.
        return reply.code(200).send({ status: "duplicate-ignored" });
      }

      const eventType = payload.type ?? payload.event ?? null;
      const record = await db.ghlWebhookEvent.create({
        data: { externalEventId, eventType, signatureValid: true, payloadJson: payload as object },
      });

      const note = await applyInboundUpdate(payload);
      await db.ghlWebhookEvent.update({ where: { id: record.id }, data: { processedAt: new Date(), processingNote: note } });

      return reply.code(200).send({ status: "received" });
    },
  );
}

/**
 * Field-authority enforcement (spec section 10): an inbound webhook may
 * ONLY ever update DND / unsubscribe / channel-preference fields on a
 * M.A.I.A. Lead — never Enrollment, Finance, Course Access, Progress,
 * Attendance, Requirements, Master Brain, Certificates, or operational
 * status, all of which stay exclusively M.A.I.A.-authoritative regardless
 * of what any webhook payload claims.
 */
async function applyInboundUpdate(payload: GhlWebhookPayload): Promise<string> {
  if (!payload.contactId) return "No contactId in payload; nothing to apply.";

  const contactMap = await db.ghlContactMap.findFirst({ where: { ghlContactId: payload.contactId } });
  if (!contactMap) return "No known GhlContactMap for this contactId; nothing to apply.";

  const lead = await db.lead.findUnique({ where: { personId: contactMap.personId } });
  if (!lead) return "Contact has no Lead record; DND/unsubscribe fields have nowhere to apply.";

  const updates: { dnd?: boolean; optedOut?: boolean } = {};
  // Loop prevention (spec section 32): only write fields that actually
  // differ from current state — an echo of M.A.I.A.'s own last outbound
  // sync must never trigger a further write.
  if (typeof payload.dnd === "boolean" && payload.dnd !== lead.dnd) updates.dnd = payload.dnd;
  if (typeof payload.unsubscribed === "boolean" && payload.unsubscribed !== lead.optedOut) updates.optedOut = payload.unsubscribed;

  if (Object.keys(updates).length === 0) {
    return "No DND/unsubscribe field changed; no-op (loop prevention).";
  }

  await db.$transaction([
    db.lead.update({ where: { id: lead.id }, data: updates }),
    db.ghlContactMap.update({ where: { id: contactMap.id }, data: { lastSyncDirection: "Inbound", lastSyncedAt: new Date() } }),
  ]);

  return `Applied inbound update: ${Object.keys(updates).join(", ")}.`;
}
