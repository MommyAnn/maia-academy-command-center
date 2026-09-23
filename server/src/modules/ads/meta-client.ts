// Real Meta Marketing/Graph API read client (spec sections 3, 15, 18-20).
// This has NEVER been exercised against a live Graph API response in this
// build — META_APP_ID/META_SYSTEM_USER_TOKEN are unset in every environment
// this code has actually run in (see provider.ts's header comment). The
// request shapes below follow the Graph API's documented conventions
// (campaign/adset/ad edges, the `insights` edge with a `time_range` and
// `fields` parameter) as understood at the time this was written, using the
// centralized META_GRAPH_API_VERSION from src/env.ts (spec section 110).
// MUST be re-verified against Meta's current developer documentation before
// a real connection is ever configured — do not trust this as current
// without that check.
//
// Read-only (spec sections 9-10): this module only ever issues GET requests
// against the Graph API. No campaign/ad-set/ad creation, edit, budget
// change, or pause/resume call exists anywhere in this codebase.

import { env } from "../../env.js";

async function graphGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${env.META_GRAPH_API_BASE_URL}/${env.META_GRAPH_API_VERSION}/${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  url.searchParams.set("access_token", env.META_SYSTEM_USER_TOKEN ?? "");
  const res = await fetch(url.toString(), { method: "GET" });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Meta Graph API GET ${path} failed: HTTP ${res.status} ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { data?: T; error?: { message?: string } };
  if (json.error) throw new Error(`Meta Graph API GET ${path} returned an error: ${json.error.message ?? "unknown"}`);
  return (json.data ?? json) as T;
}

export interface MetaCampaign {
  id: string;
  name: string;
  objective?: string;
  status?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  start_time?: string;
  stop_time?: string;
}

export interface MetaAdSet {
  id: string;
  name: string;
  status?: string;
  daily_budget?: string;
  targeting?: unknown;
  publisher_platforms?: string[];
}

export interface MetaAd {
  id: string;
  name: string;
  status?: string;
  creative?: { id?: string };
}

export interface MetaInsightRow {
  spend?: string;
  impressions?: string;
  reach?: string;
  frequency?: string;
  cpm?: string;
  clicks?: string;
  inline_link_clicks?: string;
  ctr?: string;
  cpc?: string;
  actions?: { action_type: string; value: string }[];
  action_values?: { action_type: string; value: string }[];
  date_start?: string;
  date_stop?: string;
}

export async function fetchMetaCampaigns(externalAdAccountId: string): Promise<MetaCampaign[]> {
  return graphGet<MetaCampaign[]>(`${externalAdAccountId}/campaigns`, {
    fields: "id,name,objective,status,daily_budget,lifetime_budget,start_time,stop_time",
    limit: "200",
  });
}

export async function fetchMetaAdSets(externalCampaignId: string): Promise<MetaAdSet[]> {
  return graphGet<MetaAdSet[]>(`${externalCampaignId}/adsets`, {
    fields: "id,name,status,daily_budget,targeting,publisher_platforms",
    limit: "200",
  });
}

export async function fetchMetaAds(externalAdSetId: string): Promise<MetaAd[]> {
  return graphGet<MetaAd[]>(`${externalAdSetId}/ads`, { fields: "id,name,status,creative{id}", limit: "200" });
}

/** dateFrom/dateTo as YYYY-MM-DD, honoring the ad account's own reporting timezone (spec section 22). */
export async function fetchMetaInsights(externalObjectId: string, dateFrom: string, dateTo: string): Promise<MetaInsightRow[]> {
  return graphGet<MetaInsightRow[]>(`${externalObjectId}/insights`, {
    fields: "spend,impressions,reach,frequency,cpm,clicks,inline_link_clicks,ctr,cpc,actions,action_values,date_start,date_stop",
    time_range: JSON.stringify({ since: dateFrom, until: dateTo }),
  });
}
