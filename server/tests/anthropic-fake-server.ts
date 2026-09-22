// A tiny local HTTP server standing in for api.anthropic.com — this
// sandbox's egress proxy is the same one that blocked GHL's real domains
// in Phase 5, so this is the only way to exercise the real Anthropic
// client/engine code paths (success, 401, 403, 404, 429, 500) end-to-end
// without a real ANTHROPIC_API_KEY. It speaks the real Messages API
// response shape the @anthropic-ai/sdk client parses — NOT a claim that
// M.A.I.A. is actually connected to Anthropic; see the Phase 6 completion
// report's honest Connection Status section.

import http from "node:http";

export type FakeAnthropicMode = "success" | "structured_success" | "malformed_json" | "auth_failed" | "forbidden" | "not_found" | "rate_limited" | "server_error";

export function createFakeAnthropicServer(port: number) {
  let mode: FakeAnthropicMode = "success";
  let responseText = "This is a synthetic AI-generated response for testing.";
  let requestCount = 0;

  function errorBody(type: string, message: string) {
    return JSON.stringify({ type: "error", error: { type, message } });
  }

  const server = http.createServer((req, res) => {
    requestCount++;
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      res.setHeader("Content-Type", "application/json");

      if (mode === "auth_failed") {
        res.writeHead(401);
        return res.end(errorBody("authentication_error", "invalid x-api-key"));
      }
      if (mode === "forbidden") {
        res.writeHead(403);
        return res.end(errorBody("permission_error", "insufficient permissions"));
      }
      if (mode === "not_found") {
        res.writeHead(404);
        return res.end(errorBody("not_found_error", "model not found"));
      }
      if (mode === "rate_limited") {
        res.writeHead(429);
        return res.end(errorBody("rate_limit_error", "rate limited"));
      }
      if (mode === "server_error") {
        res.writeHead(500);
        return res.end(errorBody("api_error", "internal server error"));
      }

      const text = mode === "malformed_json" ? "not valid json at all" : mode === "structured_success" ? responseText : responseText;

      res.writeHead(200);
      return res.end(
        JSON.stringify({
          id: `msg_fake_${requestCount}`,
          type: "message",
          role: "assistant",
          model: "claude-opus-5",
          content: [{ type: "text", text }],
          stop_reason: "end_turn",
          stop_sequence: null,
          usage: { input_tokens: 42, output_tokens: 128 },
        }),
      );
    });
  });

  return {
    setMode: (m: FakeAnthropicMode) => {
      mode = m;
    },
    setResponseText: (t: string) => {
      responseText = t;
    },
    getRequestCount: () => requestCount,
    start: () => new Promise<void>((resolve) => server.listen(port, "127.0.0.1", () => resolve())),
    stop: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
