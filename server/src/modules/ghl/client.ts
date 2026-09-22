// Real HighLevel (GHL) API v2 client (spec sections 1-2, 5, 27-30).
//
// Architecture decision (spec section 2, documented for the completion
// report): all methods here are OUTBOUND calls, authenticated with a
// Private Integration Token (PIT) — the correct choice for M.A.I.A. as a
// single-location internal system, since a PIT needs no OAuth
// user-consent flow. Inbound webhook RECEIVING is a materially different
// setup (a Marketplace app registration with a configured webhook URL —
// see modules/ghl/webhook.ts) and is not part of this client.
//
// Base URL, version header, and endpoint shapes below are taken from
// HighLevel's current v2 API (services.leadconnectorhq.com,
// `Version: 2021-07-28`) as researched from current documentation and the
// official highlevel-api-sdk repository; the V1 API reached end-of-support
// 2025-12-31 and is never used here.
//
// Every credential is read ONLY from server-side env vars (spec section
// 3) — never persisted, never echoed in a response, never sent to the
// frontend. Every method returns a typed result instead of throwing, so a
// GHL outage/misconfiguration/network block can never take down core
// M.A.I.A. business logic (enrollment, payments, requirements, ...) —
// this sandbox's own egress proxy is known to block GHL's domains
// outright, which is exactly the "CONNECTION_ERROR, handled gracefully"
// case this design exists for.

import { env } from "../../env.js";

export type GhlConnectionStatus =
  | "CONNECTED"
  | "AUTHENTICATION_FAILED"
  | "INSUFFICIENT_PERMISSIONS"
  | "RATE_LIMITED"
  | "CONNECTION_ERROR"
  | "NOT_CONFIGURED";

export type GhlResult<T> = { ok: true; data: T } | { ok: false; status: GhlConnectionStatus; message: string };

export function isGhlConfigured(): boolean {
  return !!(env.GHL_PRIVATE_INTEGRATION_TOKEN && env.GHL_LOCATION_ID);
}

const REQUEST_TIMEOUT_MS = 10_000;

async function ghlFetch(path: string, init: RequestInit = {}): Promise<GhlResult<unknown>> {
  if (!isGhlConfigured()) {
    return {
      ok: false,
      status: "NOT_CONFIGURED",
      message: "GHL_PRIVATE_INTEGRATION_TOKEN and/or GHL_LOCATION_ID are not set on this server.",
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${env.GHL_API_BASE_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${env.GHL_PRIVATE_INTEGRATION_TOKEN}`,
        Version: env.GHL_API_VERSION,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });

    if (res.status === 401) {
      return { ok: false, status: "AUTHENTICATION_FAILED", message: "GHL rejected the configured Private Integration Token." };
    }
    if (res.status === 403) {
      return { ok: false, status: "INSUFFICIENT_PERMISSIONS", message: "The configured GHL credential lacks the required scope for this action." };
    }
    if (res.status === 429) {
      return { ok: false, status: "RATE_LIMITED", message: "GHL rate limit exceeded (see X-RateLimit-* response headers)." };
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, status: "CONNECTION_ERROR", message: `GHL returned HTTP ${res.status}: ${body.slice(0, 300)}` };
    }
    const data = await res.json().catch(() => ({}));
    return { ok: true, data };
  } catch (err) {
    return {
      ok: false,
      status: "CONNECTION_ERROR",
      message: err instanceof Error ? err.message : "Unknown network error contacting GHL.",
    };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * A safe, read-only authenticated request (spec section 5) — never a
 * write. Returns the exact enumerated status the ADMIN -> GHL INTEGRATION
 * screen is allowed to show; never exposes the raw GHL response.
 */
export async function testConnection(): Promise<GhlResult<{ locationId: string }>> {
  const result = await ghlFetch(`/contacts/?locationId=${encodeURIComponent(env.GHL_LOCATION_ID ?? "")}&limit=1`);
  if (!result.ok) return result;
  return { ok: true, data: { locationId: env.GHL_LOCATION_ID! } };
}

export interface GhlContactInput {
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  tags?: string[];
  customFields?: { id: string; value: string }[];
}

export async function upsertContact(input: GhlContactInput): Promise<GhlResult<{ contactId: string }>> {
  if (!input.email && !input.phone) {
    return { ok: false, status: "CONNECTION_ERROR", message: "A GHL contact requires at least an email or a phone number." };
  }
  const result = await ghlFetch(`/contacts/upsert`, {
    method: "POST",
    body: JSON.stringify({ locationId: env.GHL_LOCATION_ID, ...input }),
  });
  if (!result.ok) return result;
  const contactId = (result.data as { contact?: { id?: string }; id?: string })?.contact?.id ?? (result.data as { id?: string })?.id;
  if (!contactId) {
    return { ok: false, status: "CONNECTION_ERROR", message: "GHL's response did not include a contact id." };
  }
  return { ok: true, data: { contactId } };
}

export async function applyTag(contactId: string, tagName: string): Promise<GhlResult<void>> {
  const result = await ghlFetch(`/contacts/${encodeURIComponent(contactId)}/tags`, {
    method: "POST",
    body: JSON.stringify({ tags: [tagName] }),
  });
  if (!result.ok) return result;
  return { ok: true, data: undefined };
}

export async function setCustomFields(contactId: string, fields: { id: string; value: string }[]): Promise<GhlResult<void>> {
  const result = await ghlFetch(`/contacts/${encodeURIComponent(contactId)}`, {
    method: "PUT",
    body: JSON.stringify({ customFields: fields }),
  });
  if (!result.ok) return result;
  return { ok: true, data: undefined };
}

export interface GhlMessageInput {
  contactId: string;
  type: "Email" | "SMS" | "WhatsApp";
  message?: string; // SMS / WhatsApp body
  subject?: string; // Email only
  html?: string; // Email only
}

export async function sendMessage(input: GhlMessageInput): Promise<GhlResult<{ messageId: string }>> {
  const result = await ghlFetch(`/conversations/messages`, {
    method: "POST",
    body: JSON.stringify({ type: input.type, contactId: input.contactId, message: input.message, subject: input.subject, html: input.html }),
  });
  if (!result.ok) return result;
  const messageId = (result.data as { messageId?: string; id?: string })?.messageId ?? (result.data as { id?: string })?.id;
  if (!messageId) {
    return { ok: false, status: "CONNECTION_ERROR", message: "GHL's response did not include a message id." };
  }
  return { ok: true, data: { messageId } };
}

export async function triggerWorkflow(contactId: string, workflowId: string): Promise<GhlResult<void>> {
  const result = await ghlFetch(`/contacts/${encodeURIComponent(contactId)}/workflow/${encodeURIComponent(workflowId)}`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  if (!result.ok) return result;
  return { ok: true, data: undefined };
}
