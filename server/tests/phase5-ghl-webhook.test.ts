import { beforeAll, afterAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { sign as signEd25519, createPrivateKey } from "node:crypto";
import { buildApp } from "../src/app.js";
import { db } from "../src/db.js";
import { resetDb, loginAs, DEV_USERS } from "./helpers.js";

let app: FastifyInstance;
let ownerCookie: string;

// The private half of the throwaway Ed25519 keypair whose PUBLIC half is
// configured as GHL_WEBHOOK_SIGNATURE_PUBLIC_KEY in .env.test — this test
// file is the only place the private key exists, exactly mirroring how
// only HighLevel itself would hold it for a real integration.
const TEST_PRIVATE_KEY_PEM = `-----BEGIN PRIVATE KEY-----
MC4CAQAwBQYDK2VwBCIEIMmhCql0UfdwP2Aue0sAgLhJxrDgnjQwEiLNQyKhgwAo
-----END PRIVATE KEY-----`;

function signPayload(rawBody: Buffer): string {
  const privateKey = createPrivateKey(TEST_PRIVATE_KEY_PEM);
  return signEd25519(null, rawBody, privateKey).toString("base64");
}

async function postWebhook(bodyString: string, signature?: string) {
  return app.inject({
    method: "POST",
    url: "/api/ghl/webhook",
    headers: { "content-type": "application/json", ...(signature ? { "x-ghl-signature": signature } : {}) },
    payload: bodyString,
  });
}

beforeAll(async () => {
  await resetDb();
  app = await buildApp();
  ownerCookie = await loginAs(app, DEV_USERS.owner.email, DEV_USERS.owner.password);
});

afterAll(async () => {
  await app.close();
  await db.$disconnect();
});

describe("Inbound GHL webhook — Ed25519 signature verification (spec sections 33-36, 62)", () => {
  it("REJECTS a request with no signature header at all", async () => {
    const res = await postWebhook(JSON.stringify({ eventId: "evt-nosig-1", type: "ContactUpdate" }));
    expect(res.statusCode).toBe(401);
  });

  it("REJECTS a tampered payload — signature was computed over different bytes", async () => {
    const original = JSON.stringify({ eventId: "evt-tamper-1", type: "ContactUpdate", dnd: true });
    const signature = signPayload(Buffer.from(original));
    const tampered = JSON.stringify({ eventId: "evt-tamper-1", type: "ContactUpdate", dnd: false });

    const res = await postWebhook(tampered, signature);
    expect(res.statusCode).toBe(401);

    const stored = await db.ghlWebhookEvent.findFirst({ where: { processingNote: { contains: "REJECTED" } }, orderBy: { receivedAt: "desc" } });
    expect(stored?.signatureValid).toBe(false);
  });

  it("REJECTS an invalid/garbage signature", async () => {
    const body = JSON.stringify({ eventId: "evt-garbage-1", type: "ContactUpdate" });
    const res = await postWebhook(body, Buffer.from("not-a-real-signature").toString("base64"));
    expect(res.statusCode).toBe(401);
  });

  it("ACCEPTS a correctly signed, well-formed payload", async () => {
    const body = JSON.stringify({ eventId: "evt-valid-1", type: "ContactUpdate", contactId: "no-such-contact" });
    const signature = signPayload(Buffer.from(body));
    const res = await postWebhook(body, signature);
    expect(res.statusCode).toBe(200);

    const stored = await db.ghlWebhookEvent.findUnique({ where: { externalEventId: "evt-valid-1" } });
    expect(stored?.signatureValid).toBe(true);
    expect(stored?.processedAt).not.toBeNull();
  });

  it("a REPLAYED (duplicate externalEventId) delivery is ignored, not reprocessed", async () => {
    const body = JSON.stringify({ eventId: "evt-replay-1", type: "ContactUpdate" });
    const signature = signPayload(Buffer.from(body));
    const first = await postWebhook(body, signature);
    expect(first.statusCode).toBe(200);

    const second = await postWebhook(body, signature);
    expect(second.statusCode).toBe(200);
    expect(second.json().status).toBe("duplicate-ignored");

    const count = await db.ghlWebhookEvent.count({ where: { externalEventId: "evt-replay-1" } });
    expect(count).toBe(1);
  });

  it("REJECTS a malformed (non-JSON) body even with a technically-missing signature", async () => {
    const res = await postWebhook("not json at all", undefined);
    expect(res.statusCode).toBe(401); // missing signature is checked first, exactly as it should be
  });
});

describe("Inbound field-authority + loop prevention (spec sections 10, 32, 39-40)", () => {
  it("a DND update from GHL updates ONLY the Lead's dnd flag, never anything else", async () => {
    const leadRes = await app.inject({ method: "POST", url: "/api/leads", headers: { cookie: ownerCookie }, payload: { fullName: "Webhook DND Lead", contactNumber: "09176660001" } });
    const lead = leadRes.json().lead;

    // Simulate this contact already having been synced outbound once, so the webhook can resolve it.
    await db.ghlContactMap.create({ data: { personId: lead.personId, ghlContactId: "ghl-contact-dnd-1", syncStatus: "SYNCED" } });

    const body = JSON.stringify({ eventId: "evt-dnd-1", type: "ContactDndUpdate", contactId: "ghl-contact-dnd-1", dnd: true });
    const signature = signPayload(Buffer.from(body));
    const res = await postWebhook(body, signature);
    expect(res.statusCode).toBe(200);

    const updated = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(updated.dnd).toBe(true);
    expect(updated.pipelineStage).toBe("NOT_CONTACTED"); // untouched — M.A.I.A. stays authoritative for everything else

    const contactMap = await db.ghlContactMap.findUniqueOrThrow({ where: { personId: lead.personId } });
    expect(contactMap.lastSyncDirection).toBe("Inbound");
  });

  it("an inbound update that matches current state is a no-op — it never re-triggers a write (loop prevention)", async () => {
    const leadRes = await app.inject({ method: "POST", url: "/api/leads", headers: { cookie: ownerCookie }, payload: { fullName: "Webhook Loop Lead", contactNumber: "09176660002" } });
    const lead = leadRes.json().lead; // dnd already false by default
    await db.ghlContactMap.create({ data: { personId: lead.personId, ghlContactId: "ghl-contact-loop-1", syncStatus: "SYNCED" } });

    const body = JSON.stringify({ eventId: "evt-loop-1", type: "ContactDndUpdate", contactId: "ghl-contact-loop-1", dnd: false });
    const signature = signPayload(Buffer.from(body));
    const res = await postWebhook(body, signature);
    expect(res.statusCode).toBe(200);

    const stored = await db.ghlWebhookEvent.findUniqueOrThrow({ where: { externalEventId: "evt-loop-1" } });
    expect(stored.processingNote).toContain("no-op");
  });
});
