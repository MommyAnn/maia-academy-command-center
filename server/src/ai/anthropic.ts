// Real Anthropic provider adapter (spec sections 1-4). Credentials are read
// ONLY from env.ANTHROPIC_API_KEY — never persisted, never echoed in a
// response, never sent to the frontend. ANTHROPIC_BASE_URL exists solely so
// the test suite can point this adapter at a local fake server (this
// sandbox's egress proxy is the same one that blocked GHL's domains in
// Phase 5 — see the completion report's honest Authentication Status).
//
// Structured output note: rather than relying on the SDK's Zod-schema-only
// `output_config.format` path (unsuitable here since AiTool.outputSchemaJson
// is a runtime, DB-stored JSON Schema, not a compile-time Zod object), this
// adapter enforces structure at the application layer: an explicit
// JSON-only instruction plus post-hoc parsing and a required-key check.
// This is a deliberate, disclosed design choice — see the Phase 6 report.

import Anthropic from "@anthropic-ai/sdk";
import { env } from "../env.js";
import type {
  AIProvider,
  AiConnectionStatus,
  AiErrorCategory,
  AiGenerateInput,
  AiGenerateOutput,
  AiResult,
  AiStructuredGenerateInput,
  AiStructuredGenerateOutput,
} from "./types.js";

function client(): Anthropic {
  return new Anthropic({
    apiKey: env.ANTHROPIC_API_KEY,
    baseURL: env.ANTHROPIC_BASE_URL,
  });
}

interface MappedError {
  status: AiConnectionStatus;
  errorCategory: AiErrorCategory;
  message: string;
}

function mapError(err: unknown): MappedError {
  const message = err instanceof Error ? err.message : String(err);
  if (err instanceof Anthropic.AuthenticationError) {
    return { status: "AUTHENTICATION_FAILED", errorCategory: "InvalidApiKey", message };
  }
  if (err instanceof Anthropic.RateLimitError) {
    return { status: "RATE_LIMITED", errorCategory: "RateLimited", message };
  }
  if (err instanceof Anthropic.NotFoundError) {
    return { status: "MODEL_UNAVAILABLE", errorCategory: "ModelRemoved", message };
  }
  if (err instanceof Anthropic.PermissionDeniedError) {
    return { status: "QUOTA_BILLING_ISSUE", errorCategory: "QuotaExhausted", message };
  }
  if (err instanceof Anthropic.APIConnectionTimeoutError) {
    return { status: "PROVIDER_ERROR", errorCategory: "Timeout", message };
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return { status: "PROVIDER_ERROR", errorCategory: "NetworkError", message };
  }
  if (err instanceof Anthropic.APIError) {
    return { status: "PROVIDER_ERROR", errorCategory: "ProviderUnavailable", message };
  }
  return { status: "PROVIDER_ERROR", errorCategory: "ProviderUnavailable", message };
}

function extractText(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n");
}

function parseJsonLoosely(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  const candidate = fenced ? fenced[1]! : trimmed;
  return JSON.parse(candidate);
}

function hasRequiredKeys(data: unknown, schema: Record<string, unknown>): boolean {
  if (typeof data !== "object" || data === null) return false;
  const required = Array.isArray(schema.required) ? (schema.required as string[]) : [];
  return required.every((key) => key in (data as Record<string, unknown>));
}

export const anthropicProvider: AIProvider = {
  name: "ANTHROPIC",

  isConfigured() {
    return !!env.ANTHROPIC_API_KEY;
  },

  async generate(input: AiGenerateInput): Promise<AiResult<AiGenerateOutput>> {
    if (!this.isConfigured()) {
      return { ok: false, status: "NOT_CONNECTED", errorCategory: "NotConfigured", message: "ANTHROPIC_API_KEY is not set on this server." };
    }
    try {
      const response = await client().messages.create({
        model: input.model,
        max_tokens: input.maxOutputTokens,
        system: input.systemInstruction,
        messages: [{ role: "user", content: input.userMessage }],
        ...(input.temperature !== undefined ? { temperature: input.temperature } : {}),
      });
      return {
        ok: true,
        data: {
          text: extractText(response.content),
          usage: { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens },
          stopReason: response.stop_reason ?? "unknown",
        },
      };
    } catch (err) {
      const mapped = mapError(err);
      return { ok: false, ...mapped };
    }
  },

  async generateStructured<T = unknown>(input: AiStructuredGenerateInput): Promise<AiResult<AiStructuredGenerateOutput<T>>> {
    if (!this.isConfigured()) {
      return { ok: false, status: "NOT_CONNECTED", errorCategory: "NotConfigured", message: "ANTHROPIC_API_KEY is not set on this server." };
    }
    const structuredInstruction = `${input.systemInstruction}\n\nRespond with ONLY a single valid JSON object matching this JSON Schema (no markdown code fences, no commentary before or after):\n${JSON.stringify(input.schema)}`;
    try {
      const response = await client().messages.create({
        model: input.model,
        max_tokens: input.maxOutputTokens,
        system: structuredInstruction,
        messages: [{ role: "user", content: input.userMessage }],
        ...(input.temperature !== undefined ? { temperature: input.temperature } : {}),
      });
      const text = extractText(response.content);
      const usage = { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens };
      let parsed: unknown;
      try {
        parsed = parseJsonLoosely(text);
      } catch {
        return { ok: false, status: "PROVIDER_ERROR", errorCategory: "InvalidStructuredOutput", message: "Model response was not valid JSON." };
      }
      if (!hasRequiredKeys(parsed, input.schema)) {
        return { ok: false, status: "PROVIDER_ERROR", errorCategory: "InvalidStructuredOutput", message: "Model response is missing required fields from the schema." };
      }
      return { ok: true, data: { data: parsed as T, usage } };
    } catch (err) {
      const mapped = mapError(err);
      return { ok: false, ...mapped };
    }
  },

  async *stream(input: AiGenerateInput) {
    if (!this.isConfigured()) {
      return { ok: false, status: "NOT_CONNECTED", errorCategory: "NotConfigured", message: "ANTHROPIC_API_KEY is not set on this server." };
    }
    try {
      const stream = client().messages.stream({
        model: input.model,
        max_tokens: input.maxOutputTokens,
        system: input.systemInstruction,
        messages: [{ role: "user", content: input.userMessage }],
        ...(input.temperature !== undefined ? { temperature: input.temperature } : {}),
      });
      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          yield event.delta.text;
        }
      }
      const final = await stream.finalMessage();
      return {
        ok: true,
        data: {
          text: extractText(final.content),
          usage: { inputTokens: final.usage.input_tokens, outputTokens: final.usage.output_tokens },
          stopReason: final.stop_reason ?? "unknown",
        },
      } as AiResult<AiGenerateOutput>;
    } catch (err) {
      const mapped = mapError(err);
      return { ok: false, ...mapped } as AiResult<AiGenerateOutput>;
    }
  },

  supportsModel(model: string) {
    return model.startsWith("claude-");
  },

  estimateUsage(input: AiGenerateInput) {
    // A rough, conservative heuristic (~4 chars/token) — never sent to the
    // provider, used only for a pre-flight context-size sanity check.
    return { estimatedInputTokens: Math.ceil((input.systemInstruction.length + input.userMessage.length) / 4) };
  },

  async healthCheck(): Promise<AiResult<{ model: string }>> {
    if (!this.isConfigured()) {
      return { ok: false, status: "NOT_CONNECTED", errorCategory: "NotConfigured", message: "ANTHROPIC_API_KEY is not set on this server." };
    }
    try {
      const response = await client().messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 8,
        messages: [{ role: "user", content: "ping" }],
      });
      return { ok: true, data: { model: response.model } };
    } catch (err) {
      const mapped = mapError(err);
      return { ok: false, ...mapped };
    }
  },
};
