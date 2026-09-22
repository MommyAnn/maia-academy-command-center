// Config-driven provider/model resolution (spec sections 8-9, 65, 81) — the
// single place that turns an AiModelConfig row into a real, usable
// (provider, model) pair, honoring every kill switch and the one
// configured fallback hop. No route or generation engine ever hard-codes a
// provider or model name; they all call resolveModelConfig(key) instead.

import { db } from "../db.js";
import { anthropicProvider } from "./anthropic.js";
import { makeUnimplementedProvider } from "./unimplemented.js";
import type { AIProvider, AiProviderName } from "./types.js";

const PROVIDERS: Record<AiProviderName, AIProvider> = {
  ANTHROPIC: anthropicProvider,
  OPENAI: makeUnimplementedProvider("OPENAI"),
  GOOGLE: makeUnimplementedProvider("GOOGLE"),
};

export function getProvider(name: AiProviderName): AIProvider {
  return PROVIDERS[name];
}

export interface ResolvedModelConfig {
  configKey: string;
  provider: AiProviderName;
  model: string;
  maxOutputTokens: number;
  temperature?: number;
  supportsStructuredOutput: boolean;
  /** True when this is the result of a fallback hop, not the originally requested config. */
  isFallback: boolean;
}

export type ResolveOutcome = { ok: true; config: ResolvedModelConfig } | { ok: false; reason: string };

export async function resolveModelConfig(configKey: string, visited: Set<string> = new Set(), isFallback = false): Promise<ResolveOutcome> {
  if (visited.has(configKey)) {
    return { ok: false, reason: `Fallback loop detected starting at "${configKey}".` };
  }
  visited.add(configKey);

  const config = await db.aiModelConfig.findUnique({ where: { configKey } });
  if (!config) return { ok: false, reason: `No model configuration named "${configKey}" exists.` };

  if (!config.enabled) {
    if (config.fallbackConfigKey) return resolveModelConfig(config.fallbackConfigKey, visited, true);
    return { ok: false, reason: `Model configuration "${configKey}" is disabled and has no fallback configured.` };
  }

  const providerConfig = await db.aiProviderConfig.findUnique({ where: { provider: config.provider } });
  if (providerConfig && !providerConfig.enabled) {
    if (config.fallbackConfigKey) return resolveModelConfig(config.fallbackConfigKey, visited, true);
    return { ok: false, reason: `Provider "${config.provider}" has been disabled by an administrator (kill switch) and no fallback is configured.` };
  }

  const provider = getProvider(config.provider as AiProviderName);
  if (!provider.isConfigured()) {
    if (config.fallbackConfigKey) return resolveModelConfig(config.fallbackConfigKey, visited, true);
    return { ok: false, reason: `Provider "${config.provider}" is not configured on this server (no credential set) and no fallback is configured.` };
  }

  return {
    ok: true,
    config: {
      configKey: config.configKey,
      provider: config.provider as AiProviderName,
      model: config.model,
      maxOutputTokens: config.maxOutputTokens,
      temperature: config.temperature ?? undefined,
      supportsStructuredOutput: config.supportsStructuredOutput,
      isFallback,
    },
  };
}
