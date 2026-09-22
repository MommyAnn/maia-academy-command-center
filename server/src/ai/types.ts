// Provider-agnostic AI abstraction (spec sections 1-3) — application code
// (Master Brain generation, the AI Tools engine) calls only this interface,
// never a provider SDK directly. Adding a second real provider means
// writing one more file that implements AIProvider; nothing else changes.

export type AiProviderName = "ANTHROPIC" | "OPENAI" | "GOOGLE";

export type AiConnectionStatus =
  | "CONNECTED"
  | "AUTHENTICATION_FAILED"
  | "MODEL_UNAVAILABLE"
  | "RATE_LIMITED"
  | "QUOTA_BILLING_ISSUE"
  | "PROVIDER_ERROR"
  | "CONFIGURATION_ERROR"
  | "NOT_CONNECTED";

export type AiErrorCategory =
  | "ProviderUnavailable"
  | "RateLimited"
  | "QuotaExhausted"
  | "InvalidApiKey"
  | "ModelRemoved"
  | "Timeout"
  | "InvalidStructuredOutput"
  | "ContextTooLarge"
  | "SafetyRejection"
  | "NetworkError"
  | "NotConfigured";

export type AiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: AiConnectionStatus; errorCategory: AiErrorCategory; message: string };

export interface AiUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface AiGenerateInput {
  model: string;
  systemInstruction: string;
  userMessage: string;
  maxOutputTokens: number;
  temperature?: number;
}

export interface AiGenerateOutput {
  text: string;
  usage: AiUsage;
  stopReason: string;
}

export interface AiStructuredGenerateInput extends AiGenerateInput {
  /** A JSON Schema object describing the required output shape. */
  schema: Record<string, unknown>;
  schemaName: string;
}

export interface AiStructuredGenerateOutput<T = unknown> {
  data: T;
  usage: AiUsage;
}

export interface AIProvider {
  readonly name: AiProviderName;
  isConfigured(): boolean;
  generate(input: AiGenerateInput): Promise<AiResult<AiGenerateOutput>>;
  generateStructured<T = unknown>(input: AiStructuredGenerateInput): Promise<AiResult<AiStructuredGenerateOutput<T>>>;
  /** Async-iterable text deltas. Provider-real where implemented; callers that don't need streaming should use generate() instead. */
  stream(input: AiGenerateInput): AsyncGenerator<string, AiResult<AiGenerateOutput>, void>;
  supportsModel(model: string): boolean;
  estimateUsage(input: AiGenerateInput): { estimatedInputTokens: number };
  /** A safe, read-only authenticated request — never a claim of CONNECTED without one actually succeeding. */
  healthCheck(): Promise<AiResult<{ model: string }>>;
}
