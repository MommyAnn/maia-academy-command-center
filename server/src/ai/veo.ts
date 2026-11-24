// Real Google Veo video generation client (Gemini Developer API surface —
// generativelanguage.googleapis.com — the same API/key type Google's text
// models use, NOT the separate Vertex AI/GCP-service-account flow). This
// has never been exercised against a live Veo response in this build: no
// real GOOGLE_AI_API_KEY with Veo access has been configured in any
// environment this code has run in.
//
// Request/response shapes below were verified this session against
// Google's own current documentation and official SDK examples
// (GoogleCloudPlatform/generative-ai repo, ai.google.dev's Veo 3.1 guide,
// and the Gemini API forum) — not assumed from training data. They MUST be
// re-verified against Google's current developer documentation before this
// is relied on in production; Google's preview APIs change without
// deprecation notice.
//
// Model/base-URL are centralized in src/env.ts (GOOGLE_VEO_MODEL,
// GOOGLE_VEO_BASE_URL) — never scattered through the codebase. Verified
// current constraints for veo-3.1-generate-preview (as of this session):
// aspectRatio "9:16" or "16:9" only; durationSeconds 4, 6, or 8 only.

import { env } from "../env.js";

export const VEO_ASPECT_RATIOS = ["9:16", "16:9"] as const;
export type VeoAspectRatio = (typeof VEO_ASPECT_RATIOS)[number];

export const VEO_DURATIONS_SECONDS = [4, 6, 8] as const;
export type VeoDurationSeconds = (typeof VEO_DURATIONS_SECONDS)[number];

export type VeoErrorCategory = "NotConfigured" | "InvalidRequest" | "ContentPolicy" | "QuotaBilling" | "Timeout" | "ProviderError";

export type VeoResult<T> = { ok: true; data: T } | { ok: false; errorCategory: VeoErrorCategory; message: string; httpStatus?: number };

const CONTENT_POLICY_PATTERN = /safety|unsafe|harmful|policy|responsible ai|\brai\b|prohibited|celebrity|sexual|violen/i;

export function isVeoConfigured(): boolean {
  return !!env.GOOGLE_AI_API_KEY;
}

interface VeoReferenceImage {
  bytesBase64Encoded: string;
  mimeType: string;
}

interface SubmitInput {
  prompt: string;
  negativePrompt?: string;
  aspectRatio: VeoAspectRatio;
  durationSeconds: VeoDurationSeconds;
  referenceImage?: VeoReferenceImage;
  /** Overrides env.GOOGLE_VEO_MODEL for this request (the AI Video Creator's admin-selected model). */
  model?: string;
  /** "720p" | "1080p" — omitted means Google's own default. */
  resolution?: string;
  /** Defaults to "allow_adult" (the only value Google documents for image-to-video). */
  personGeneration?: string;
}

interface GoogleOperation {
  name: string;
  done?: boolean;
  error?: { code: number; message: string };
  response?: {
    generateVideoResponse?: {
      generatedSamples?: { video?: { uri?: string } }[];
      raiMediaFilteredCount?: number;
      raiMediaFilteredReasons?: string[];
    };
  };
}

function headers(): Record<string, string> {
  return { "x-goog-api-key": env.GOOGLE_AI_API_KEY ?? "", "Content-Type": "application/json" };
}

async function fetchJson(url: string, init: RequestInit, timeoutMs = 30_000): Promise<VeoResult<unknown>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    clearTimeout(timeout);
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      const message = (body as { error?: { message?: string } } | null)?.error?.message ?? `HTTP ${res.status}`;
      if (res.status === 401 || res.status === 403) return { ok: false, errorCategory: "NotConfigured", message: `Google rejected the configured API key: ${message}`, httpStatus: res.status };
      if (res.status === 400) return { ok: false, errorCategory: CONTENT_POLICY_PATTERN.test(message) ? "ContentPolicy" : "InvalidRequest", message, httpStatus: res.status };
      if (res.status === 404) return { ok: false, errorCategory: "InvalidRequest", message: `Model or operation not found: ${message}`, httpStatus: res.status };
      if (res.status === 429) return { ok: false, errorCategory: "QuotaBilling", message, httpStatus: res.status };
      return { ok: false, errorCategory: "ProviderError", message, httpStatus: res.status };
    }
    return { ok: true, data: body };
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === "AbortError") {
      return { ok: false, errorCategory: "Timeout", message: `Request to Google timed out after ${timeoutMs}ms.` };
    }
    return { ok: false, errorCategory: "ProviderError", message: err instanceof Error ? err.message : "Unknown network error contacting Google." };
  }
}

/** Submits a real generation request. Returns the operation name to poll. Never fabricates acceptance. */
export async function submitVideoGeneration(input: SubmitInput): Promise<VeoResult<{ operationName: string }>> {
  if (!isVeoConfigured()) {
    return { ok: false, errorCategory: "NotConfigured", message: "GOOGLE_AI_API_KEY is not set on this server." };
  }

  const instance: Record<string, unknown> = { prompt: input.prompt };
  if (input.referenceImage) instance.image = { bytesBase64Encoded: input.referenceImage.bytesBase64Encoded, mimeType: input.referenceImage.mimeType };

  const parameters: Record<string, unknown> = { aspectRatio: input.aspectRatio, durationSeconds: input.durationSeconds, personGeneration: input.personGeneration ?? "allow_adult" };
  if (input.negativePrompt) parameters.negativePrompt = input.negativePrompt;
  if (input.resolution) parameters.resolution = input.resolution;

  const model = input.model ?? env.GOOGLE_VEO_MODEL;
  if (!/^[a-zA-Z0-9._-]+$/.test(model)) return { ok: false, errorCategory: "InvalidRequest", message: `Invalid model id: ${model}` };
  const url = `${env.GOOGLE_VEO_BASE_URL}/models/${model}:predictLongRunning`;
  const result = await fetchJson(url, { method: "POST", headers: headers(), body: JSON.stringify({ instances: [instance], parameters }) }, 30_000);
  if (!result.ok) return result;

  const operation = result.data as GoogleOperation;
  if (!operation.name) return { ok: false, errorCategory: "ProviderError", message: "Google accepted the request but returned no operation name." };
  return { ok: true, data: { operationName: operation.name } };
}

export interface PollResult {
  done: boolean;
  videoUri?: string;
  errorMessage?: string;
  /** Set when Google's own safety filters removed the output. */
  safetyFiltered?: boolean;
  safetyReasons?: string[];
}

/** Real status poll. `done: false` means genuinely still processing — never assumed complete. */
export async function pollVideoOperation(operationName: string): Promise<VeoResult<PollResult>> {
  if (!isVeoConfigured()) {
    return { ok: false, errorCategory: "NotConfigured", message: "GOOGLE_AI_API_KEY is not set on this server." };
  }
  const url = `${env.GOOGLE_VEO_BASE_URL}/${operationName}`;
  const result = await fetchJson(url, { method: "GET", headers: headers() }, 15_000);
  if (!result.ok) return result;

  const operation = result.data as GoogleOperation;
  if (!operation.done) return { ok: true, data: { done: false } };
  if (operation.error) return { ok: true, data: { done: true, errorMessage: operation.error.message, safetyFiltered: CONTENT_POLICY_PATTERN.test(operation.error.message ?? "") } };

  const generated = operation.response?.generateVideoResponse;
  const videoUri = generated?.generatedSamples?.[0]?.video?.uri;
  if (!videoUri) {
    if ((generated?.raiMediaFilteredCount ?? 0) > 0 || (generated?.raiMediaFilteredReasons?.length ?? 0) > 0) {
      const reasons = generated?.raiMediaFilteredReasons ?? [];
      return { ok: true, data: { done: true, safetyFiltered: true, safetyReasons: reasons, errorMessage: `Google's safety filters blocked this video.${reasons.length ? " " + reasons.join(" ") : ""}` } };
    }
    return { ok: true, data: { done: true, errorMessage: "Operation completed but returned no video URI." } };
  }
  return { ok: true, data: { done: true, videoUri } };
}

const MAX_VIDEO_DOWNLOAD_BYTES = 500 * 1024 * 1024;

/** Downloads the actual generated video bytes. This is the only step that proves a real video was produced — nothing upstream of this is sufficient on its own. Redirects are followed manually so the API key is only ever sent to Google's API host, never to whatever storage host the redirect points at. */
export async function downloadVideo(videoUri: string): Promise<VeoResult<{ buffer: Buffer; mimeType: string }>> {
  if (!isVeoConfigured()) {
    return { ok: false, errorCategory: "NotConfigured", message: "GOOGLE_AI_API_KEY is not set on this server." };
  }
  const apiHost = new URL(env.GOOGLE_VEO_BASE_URL).host;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 180_000);
  try {
    let url = videoUri;
    let res: Response | null = null;
    for (let hop = 0; hop < 5; hop++) {
      const sendKey = new URL(url).host === apiHost;
      res = await fetch(url, { headers: sendKey ? { "x-goog-api-key": env.GOOGLE_AI_API_KEY ?? "" } : {}, signal: controller.signal, redirect: "manual" });
      if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
        url = new URL(res.headers.get("location")!, url).toString();
        continue;
      }
      break;
    }
    if (!res || !res.ok) {
      clearTimeout(timeout);
      return { ok: false, errorCategory: "ProviderError", message: `Video download failed: HTTP ${res?.status ?? "no response"}` };
    }
    const declared = Number(res.headers.get("content-length") ?? 0);
    if (declared > MAX_VIDEO_DOWNLOAD_BYTES) {
      clearTimeout(timeout);
      return { ok: false, errorCategory: "ProviderError", message: `Video is larger than the ${MAX_VIDEO_DOWNLOAD_BYTES} byte safety limit.` };
    }
    const arrayBuffer = await res.arrayBuffer();
    clearTimeout(timeout);
    if (arrayBuffer.byteLength === 0) {
      return { ok: false, errorCategory: "ProviderError", message: "Video download returned zero bytes." };
    }
    if (arrayBuffer.byteLength > MAX_VIDEO_DOWNLOAD_BYTES) {
      return { ok: false, errorCategory: "ProviderError", message: "Video is larger than the safety limit." };
    }
    const mimeType = res.headers.get("content-type") ?? "video/mp4";
    return { ok: true, data: { buffer: Buffer.from(arrayBuffer), mimeType } };
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === "AbortError") {
      return { ok: false, errorCategory: "Timeout", message: "Video download timed out." };
    }
    return { ok: false, errorCategory: "ProviderError", message: err instanceof Error ? err.message : "Unknown error downloading video." };
  }
}

export interface VeoModelInfo {
  name: string; // e.g. "models/veo-3.1-generate-preview"
  id: string; // e.g. "veo-3.1-generate-preview"
  displayName?: string;
  description?: string;
  supportedGenerationMethods: string[];
}

/** Lists the Veo models this API key can actually use, straight from Google (GET /models). Used by the admin "Check Google connection" button — the only trustworthy source for current model ids. */
export async function listVeoModels(): Promise<VeoResult<VeoModelInfo[]>> {
  if (!isVeoConfigured()) {
    return { ok: false, errorCategory: "NotConfigured", message: "GOOGLE_AI_API_KEY is not set on this server." };
  }
  const found: VeoModelInfo[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < 10; page++) {
    const url = `${env.GOOGLE_VEO_BASE_URL}/models?pageSize=1000${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`;
    const result = await fetchJson(url, { method: "GET", headers: headers() }, 15_000);
    if (!result.ok) return result;
    const body = result.data as { models?: { name: string; displayName?: string; description?: string; supportedGenerationMethods?: string[] }[]; nextPageToken?: string };
    for (const m of body.models ?? []) {
      if (!/veo/i.test(m.name)) continue;
      found.push({ name: m.name, id: m.name.replace(/^models\//, ""), displayName: m.displayName, description: m.description, supportedGenerationMethods: m.supportedGenerationMethods ?? [] });
    }
    if (!body.nextPageToken) break;
    pageToken = body.nextPageToken;
  }
  return { ok: true, data: found };
}
