// Admin-editable AI Video Creator configuration (singleton row). Nothing
// about credit costs, the active model, or limits is hardcoded in route
// handlers — everything reads through getVideoCreatorSettings().

import type { Prisma, VideoCreatorSettings } from "@prisma/client";
import { db } from "../../db.js";
import { env } from "../../env.js";

export const VIDEO_STYLES = ["PRODUCT_COMMERCIAL", "UGC_PROMO", "SALES_PROMOTION"] as const;
export type VideoStyle = (typeof VIDEO_STYLES)[number];

export const VIDEO_LANGUAGES = ["ENGLISH", "FILIPINO", "TAGLISH"] as const;
export type VideoLanguage = (typeof VIDEO_LANGUAGES)[number];

export const ASPECT_RATIOS = ["9:16", "16:9"] as const;
export type AspectRatio = (typeof ASPECT_RATIOS)[number];

// Every duration/resolution Google has documented for Veo 3.x. The admin's
// allowedDurations/allowedResolutions must be a subset of these; a model that
// rejects a combination fails honestly at Google and the credit is refunded.
export const KNOWN_DURATIONS = [4, 6, 8] as const;
export const KNOWN_RESOLUTIONS = ["720p", "1080p"] as const;

export type ModelPricing = Record<string, Partial<Record<(typeof KNOWN_RESOLUTIONS)[number], number>>>;

// USD per generated second. ESTIMATES ONLY, used for the admin cost report —
// Google bills your Cloud project directly. Figures are the most widely cited
// Gemini API list prices as of Nov 2026 and MUST be checked against
// https://ai.google.dev/gemini-api/docs/pricing; the admin can edit them.
export const DEFAULT_MODEL_PRICING: ModelPricing = {
  "veo-3.1-lite-generate-preview": { "720p": 0.05, "1080p": 0.08 },
  "veo-3.1-fast-generate-preview": { "720p": 0.1, "1080p": 0.12 },
  "veo-3.1-generate-preview": { "720p": 0.4, "1080p": 0.4 },
};

const DEFAULTS = {
  allowedDurations: [4, 6, 8],
  allowedResolutions: ["720p", "1080p"],
  modelPricing: DEFAULT_MODEL_PRICING,
} satisfies Partial<Prisma.VideoCreatorSettingsCreateInput>;

export async function getVideoCreatorSettings(): Promise<VideoCreatorSettings> {
  return db.videoCreatorSettings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton", ...DEFAULTS },
  });
}

export function activeModelOf(settings: VideoCreatorSettings): string {
  return settings.activeModel || env.GOOGLE_VEO_MODEL;
}

export function allowedDurationsOf(settings: VideoCreatorSettings): number[] {
  const raw = Array.isArray(settings.allowedDurations) ? (settings.allowedDurations as unknown[]) : [];
  const list = raw.filter((d): d is number => typeof d === "number" && (KNOWN_DURATIONS as readonly number[]).includes(d));
  return list.length ? list.sort((a, b) => a - b) : [8];
}

export function allowedResolutionsOf(settings: VideoCreatorSettings): string[] {
  const raw = Array.isArray(settings.allowedResolutions) ? (settings.allowedResolutions as unknown[]) : [];
  const list = raw.filter((r): r is string => typeof r === "string" && (KNOWN_RESOLUTIONS as readonly string[]).includes(r));
  return list.length ? list : ["720p"];
}

export function creditCostFor(settings: VideoCreatorSettings, resolution: string): number {
  return settings.creditsPerVideo + (resolution === "1080p" ? settings.extraCreditsFor1080p : 0);
}

/** Estimated provider cost in USD, or null when no price is configured for this model. */
export function estimateProviderCostUsd(settings: VideoCreatorSettings, model: string, resolution: string, durationSeconds: number): number | null {
  const pricing = (settings.modelPricing ?? {}) as ModelPricing;
  let perSecond = pricing[model]?.[resolution as "720p" | "1080p"];
  if (perSecond === undefined) {
    // Fall back to the closest family price (lite / fast / standard) so a
    // renamed model id (e.g. preview -> GA) still gets an estimate.
    const family = /lite/i.test(model) ? "lite" : /fast/i.test(model) ? "fast" : "standard";
    const match = Object.entries(pricing).find(([id]) => (family === "standard" ? !/lite|fast/i.test(id) : new RegExp(family, "i").test(id)));
    perSecond = match?.[1]?.[resolution as "720p" | "1080p"];
  }
  if (perSecond === undefined || !Number.isFinite(perSecond)) return null;
  return Math.round(perSecond * durationSeconds * 10000) / 10000;
}
