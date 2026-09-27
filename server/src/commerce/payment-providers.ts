// Payment Provider Adapter (Production Phase 17, spec sections 15-20).
// Provider-neutral interface + a capability matrix each provider must
// report honestly. Only ONE real provider exists in this environment —
// MANUAL (staff-verified proof, no external gateway credentials needed,
// so it is genuinely LIVE) — everything else is architecture-ready only.
//
// TEST_PROVIDER exists purely so the webhook inbox pipeline (signature
// verification, idempotency, replay protection) can be exercised
// end-to-end by the automated test suite, exactly like this codebase's
// existing fake-server convention (tests/anthropic-fake-server.ts,
// the fake Veo server) — it is never connected to real money and its
// status always reports TEST_MODE, never CONNECTED/LIVE.

import { createHmac, timingSafeEqual } from "node:crypto";

export type ProviderStatus = "NOT_CONFIGURED" | "CONFIGURATION_REQUIRED" | "TEST_MODE" | "CONNECTED" | "LIVE" | "DEGRADED" | "ERROR" | "DISABLED";

export interface ProviderCapabilities {
  oneTimePayment: boolean;
  card: boolean;
  recurring: boolean;
  refund: boolean;
  webhook: boolean;
  paymentLink: boolean;
}

export interface WebhookVerification {
  valid: boolean;
  eventId?: string;
  eventType?: string;
  reason?: string;
}

export interface PaymentProviderAdapter {
  name: string;
  status: ProviderStatus;
  capabilities: ProviderCapabilities;
  verifyWebhook(rawBody: string, headers: Record<string, string | string[] | undefined>): WebhookVerification;
}

// --- MANUAL — the one real, LIVE provider in this build ---------------------
// "LIVE" here is honest, not aspirational (spec section 19: "LIVE only
// after an authorized end-to-end transaction path has been validated") —
// manual payment requires no external credentials at all; the real
// end-to-end path is Student submits proof -> Finance verifies -> access
// activates, and that path is real and tested (server/tests/*checkout*).
export const ManualProvider: PaymentProviderAdapter = {
  name: "MANUAL",
  status: "LIVE",
  capabilities: { oneTimePayment: true, card: false, recurring: false, refund: true, webhook: false, paymentLink: false },
  verifyWebhook: () => ({ valid: false, reason: "MANUAL has no webhook capability — payments are confirmed by staff verification, not a provider callback." }),
};

// --- TEST_PROVIDER — test-fixture only, never real money -------------------
const TEST_PROVIDER_WEBHOOK_SECRET = process.env.TEST_PROVIDER_WEBHOOK_SECRET ?? "test-provider-dev-secret-not-for-production";

export const TestProvider: PaymentProviderAdapter = {
  name: "TEST_PROVIDER",
  status: "TEST_MODE",
  capabilities: { oneTimePayment: true, card: true, recurring: true, refund: true, webhook: true, paymentLink: true },
  verifyWebhook(rawBody, headers) {
    const signatureHeader = headers["x-test-provider-signature"];
    const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
    if (!signature) return { valid: false, reason: "Missing signature header." };
    const expected = createHmac("sha256", TEST_PROVIDER_WEBHOOK_SECRET).update(rawBody).digest("hex");
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return { valid: false, reason: "Signature mismatch." };
    let parsed: { eventId?: string; eventType?: string };
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      return { valid: false, reason: "Malformed payload." };
    }
    if (!parsed.eventId || !parsed.eventType) return { valid: false, reason: "Payload missing eventId/eventType." };
    return { valid: true, eventId: parsed.eventId, eventType: parsed.eventType };
  },
};

const PROVIDERS: Record<string, PaymentProviderAdapter> = {
  MANUAL: ManualProvider,
  TEST_PROVIDER: TestProvider,
};

export function getPaymentProvider(name: string): PaymentProviderAdapter | undefined {
  return PROVIDERS[name];
}

export function listPaymentProviders(): PaymentProviderAdapter[] {
  return Object.values(PROVIDERS);
}
