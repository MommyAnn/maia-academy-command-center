// Adapter stubs for providers not yet required (spec section 3: "Only
// implement providers actually required now. Do not create fake
// integrations and label them connected."). These exist so the provider
// registry and the ADMIN -> AI CONNECTIONS screen can list OpenAI/Google as
// real, selectable rows in AiProviderConfig — but every call honestly
// reports NOT_CONNECTED / CONFIGURATION_ERROR rather than pretending to work.

import type { AIProvider, AiConnectionStatus, AiGenerateInput, AiGenerateOutput, AiResult } from "./types.js";

function notImplemented<T>(providerName: string): AiResult<T> {
  return {
    ok: false,
    status: "CONFIGURATION_ERROR" as AiConnectionStatus,
    errorCategory: "NotConfigured",
    message: `${providerName} is not implemented in this build — no adapter SDK is installed. This is a prepared interface point, not a connected provider.`,
  };
}

export function makeUnimplementedProvider(name: "OPENAI" | "GOOGLE"): AIProvider {
  return {
    name,
    isConfigured: () => false,
    generate: async () => notImplemented(name),
    generateStructured: async () => notImplemented(name),
    // eslint-disable-next-line require-yield
    stream: async function* (_input: AiGenerateInput) {
      return notImplemented<AiGenerateOutput>(name);
    },
    supportsModel: () => false,
    estimateUsage: () => ({ estimatedInputTokens: 0 }),
    healthCheck: async () => notImplemented(name),
  };
}
