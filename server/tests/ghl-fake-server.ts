// A tiny local HTTP server standing in for the real HighLevel API
// (services.leadconnectorhq.com) — this sandbox's own egress proxy blocks
// GHL's real domains outright, so this is the only way to exercise the
// real GHL client/outbox code paths (success, 401, 403, 429, 500, network
// error) end-to-end without a live GHL account. It is explicitly NOT a
// claim that M.A.I.A. is actually connected to HighLevel — see the Phase 5
// completion report's Authentication Status / GHL Sandbox Test Results
// sections for the honest distinction.

import http from "node:http";
import type { AddressInfo } from "node:net";

export type FakeGhlMode = "success" | "auth_failed" | "insufficient_permissions" | "rate_limited" | "server_error" | "no_id_in_response";

export function createFakeGhlServer(port = 4009) {
  let mode: FakeGhlMode = "success";
  let requestCount = 0;
  let contactCounter = 0;

  const server = http.createServer((req, res) => {
    requestCount++;
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      res.setHeader("Content-Type", "application/json");

      if (mode === "auth_failed") {
        res.writeHead(401);
        return res.end(JSON.stringify({ error: "unauthorized" }));
      }
      if (mode === "insufficient_permissions") {
        res.writeHead(403);
        return res.end(JSON.stringify({ error: "forbidden" }));
      }
      if (mode === "rate_limited") {
        res.writeHead(429);
        return res.end(JSON.stringify({ error: "rate limited" }));
      }
      if (mode === "server_error") {
        res.writeHead(500);
        return res.end(JSON.stringify({ error: "server error" }));
      }

      const url = req.url ?? "";
      if (url.startsWith("/contacts/upsert") && req.method === "POST") {
        contactCounter++;
        res.writeHead(200);
        if (mode === "no_id_in_response") return res.end(JSON.stringify({ contact: {} }));
        return res.end(JSON.stringify({ contact: { id: `fake-contact-${contactCounter}` } }));
      }
      if (/^\/contacts\/[^/]+\/tags$/.test(url) && req.method === "POST") {
        res.writeHead(200);
        return res.end(JSON.stringify({ tags: [] }));
      }
      if (/^\/contacts\/[^/]+\/workflow\/[^/]+$/.test(url) && req.method === "POST") {
        res.writeHead(200);
        return res.end(JSON.stringify({ status: "ok" }));
      }
      if (/^\/contacts\/[^/]+$/.test(url) && req.method === "PUT") {
        res.writeHead(200);
        return res.end(JSON.stringify({ status: "ok" }));
      }
      if (url.startsWith("/contacts") && req.method === "GET") {
        res.writeHead(200);
        return res.end(JSON.stringify({ contacts: [] }));
      }
      if (url.startsWith("/conversations/messages") && req.method === "POST") {
        res.writeHead(200);
        return res.end(JSON.stringify({ messageId: `fake-message-${Date.now()}-${Math.random().toString(36).slice(2)}` }));
      }

      res.writeHead(404);
      res.end(JSON.stringify({ error: "not found" }));
    });
  });

  return {
    setMode: (m: FakeGhlMode) => {
      mode = m;
    },
    getRequestCount: () => requestCount,
    start: () =>
      new Promise<void>((resolve) => {
        server.listen(port, "127.0.0.1", () => resolve());
      }),
    stop: () => new Promise<void>((resolve) => server.close(() => resolve())),
    address: () => server.address() as AddressInfo,
  };
}
