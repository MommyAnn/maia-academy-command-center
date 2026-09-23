// M.A.I.A. Ads provider abstraction (spec sections 3-12, 110-114). Every
// provider is a plain string, never a fixed Prisma enum, so adding a future
// platform (Google Ads, TikTok Ads, ...) never needs a schema migration
// (spec section 111) — Meta is simply the first one configured (spec 112).
//
// CONNECTED is only ever reported after a real authenticated provider
// request succeeds (spec section 5). This build ships with NO real Meta
// App credentials — META_APP_ID/META_APP_SECRET/META_SYSTEM_USER_TOKEN are
// all unset in every environment this code has actually run in — so the
// "META" provider's connection test path below has never been exercised
// against a live Graph API response. It is written to the shape of the
// Graph API as documented at the time this was written (Graph API
// META_GRAPH_API_VERSION, centralized in src/env.ts per spec section 110)
// and MUST be re-verified against Meta's current developer documentation
// before a real App is ever connected — do not trust this as current
// without that check.
//
// The capability matrix below is NOT "what Meta's API supports" — it is
// "what THIS SYSTEM implements a call for". Meta's real API can create/edit
// campaigns, change budgets, and pause/resume; this build calls none of
// that (spec sections 9-12's read-first, no-autonomous-spend mandate), so
// those capabilities stay false here regardless of what Meta allows.

import { env } from "../../env.js";

export const ADS_PROVIDERS = ["META", "MANUAL"] as const;
export type AdsProvider = (typeof ADS_PROVIDERS)[number];

export function isAdsProvider(value: string): value is AdsProvider {
  return (ADS_PROVIDERS as readonly string[]).includes(value);
}

export const CONNECTION_STATUSES = [
  "NOT_CONNECTED",
  "CONFIGURATION_REQUIRED",
  "AUTHORIZING",
  "CONNECTED",
  "DEGRADED",
  "EXPIRED",
  "ERROR",
  "DISABLED",
] as const;
export type ConnectionStatus = (typeof CONNECTION_STATUSES)[number];

export const CONNECTION_MODES = ["READ_ONLY", "LIVE_ACTION"] as const;
export type ConnectionMode = (typeof CONNECTION_MODES)[number];

export const AD_CAPABILITIES = [
  "READ_CAMPAIGNS",
  "READ_METRICS",
  "READ_CREATIVES",
  "CREATE_CAMPAIGN",
  "EDIT_CAMPAIGN",
  "CHANGE_BUDGET",
  "PAUSE",
  "WEBHOOK",
] as const;
export type AdCapability = (typeof AD_CAPABILITIES)[number];

// Spec section 113 — tracked per provider. Spec section 12/59/114 — no live
// write capability exists anywhere in this build; every mutation-shaped
// capability is deliberately false for every provider until a future phase
// implements the write path AND is granted explicit permission to.
const CAPABILITY_MATRIX: Record<AdsProvider, Record<AdCapability, boolean>> = {
  META: {
    READ_CAMPAIGNS: true,
    READ_METRICS: true,
    READ_CREATIVES: true,
    CREATE_CAMPAIGN: false,
    EDIT_CAMPAIGN: false,
    CHANGE_BUDGET: false,
    PAUSE: false,
    WEBHOOK: false,
  },
  // MANUAL has no provider API at all — its data always arrives via direct
  // entry or CSV import (spec sections 83-87), never a sync call.
  MANUAL: {
    READ_CAMPAIGNS: false,
    READ_METRICS: false,
    READ_CREATIVES: false,
    CREATE_CAMPAIGN: false,
    EDIT_CAMPAIGN: false,
    CHANGE_BUDGET: false,
    PAUSE: false,
    WEBHOOK: false,
  },
};

export function hasCapability(provider: AdsProvider, capability: AdCapability): boolean {
  return CAPABILITY_MATRIX[provider][capability];
}

export function getCapabilities(provider: AdsProvider): Record<AdCapability, boolean> {
  return { ...CAPABILITY_MATRIX[provider] };
}

export interface ConnectionTestResult {
  ok: boolean;
  status: ConnectionStatus;
  reason?: string;
}

/**
 * Attempts a real connection test for the given provider. Never fabricates
 * CONNECTED (spec section 5). For MANUAL, there is no external auth step,
 * so a "connection" is trivially always available. For META, this reports
 * CONFIGURATION_REQUIRED honestly whenever no server-side credentials are
 * on file — which is the case in every environment this code has run in —
 * and only attempts a real Graph API call when credentials ARE present.
 */
export async function testProviderConnection(provider: AdsProvider): Promise<ConnectionTestResult> {
  if (provider === "MANUAL") {
    return { ok: true, status: "CONNECTED" };
  }

  // provider === "META"
  if (!env.META_APP_ID || !env.META_SYSTEM_USER_TOKEN) {
    return {
      ok: false,
      status: "CONFIGURATION_REQUIRED",
      reason: "No Meta App ID / System User Token configured on this server. Configure META_APP_ID and META_SYSTEM_USER_TOKEN (and META_APP_SECRET) to attempt a real connection.",
    };
  }

  const url = `${env.META_GRAPH_API_BASE_URL}/${env.META_GRAPH_API_VERSION}/me/adaccounts?access_token=${encodeURIComponent(env.META_SYSTEM_USER_TOKEN)}`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(url, { method: "GET", signal: controller.signal });
    clearTimeout(timeout);
    if (res.status === 401 || res.status === 403) {
      return { ok: false, status: "EXPIRED", reason: `Meta rejected the configured System User Token (HTTP ${res.status}).` };
    }
    if (!res.ok) {
      return { ok: false, status: "ERROR", reason: `Meta Graph API returned HTTP ${res.status}.` };
    }
    return { ok: true, status: "CONNECTED" };
  } catch (err) {
    return { ok: false, status: "ERROR", reason: err instanceof Error ? err.message : "Unknown error contacting the Meta Graph API." };
  }
}
