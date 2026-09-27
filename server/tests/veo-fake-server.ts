// A tiny local HTTP server standing in for
// generativelanguage.googleapis.com's Veo surface — the same rationale as
// tests/anthropic-fake-server.ts: this sandbox's egress proxy blocks
// Google's real domains, so this is the only way to exercise the real
// src/ai/veo.ts client + src/modules/video/jobs.ts orchestration end-to-end
// (submit, poll-until-done, download, and every documented failure mode)
// without a real GOOGLE_AI_API_KEY. It is NOT a claim that M.A.I.A. is
// actually connected to Google Veo — see the Video Director backend
// completion report's honest Connection Status section. No credential
// value is ever asserted against here; the "key" below is an arbitrary
// string this fake server never validates.

import http from "node:http";

export type FakeVeoMode =
  | "success" // done only after `doneAfterPolls` polls
  | "immediate_done" // done on the very first poll
  | "auth_failed" // submission rejected 401 (invalid key)
  | "content_policy" // submission rejected 400
  | "quota" // submission rejected 429
  | "server_error" // submission rejected 500
  | "malformed_no_operation_name" // 200 but no operation name
  | "provider_error_on_poll" // poll transport itself fails (500)
  | "operation_error" // poll returns done:true with an operation-level error
  | "done_no_video_uri" // poll returns done:true but no video sample
  | "download_fails"; // video URI download itself fails

export function createFakeVeoServer(port: number) {
  let mode: FakeVeoMode = "success";
  let doneAfterPolls = 2;
  let submitCount = 0;
  const pollCounts = new Map<string, number>();
  let lastSubmitBody: { instances?: { prompt?: string; image?: unknown }[]; parameters?: Record<string, unknown> } | null = null;
  // Deliberately NOT a real video file — just enough bytes to prove the
  // exact bytes returned by "download" are the exact bytes stored/served.
  const videoBytes = Buffer.from("FAKE-MP4-BYTES-NOT-A-REAL-VIDEO-FILE-FOR-TESTING-ONLY");

  function sendJson(res: http.ServerResponse, status: number, obj: unknown) {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(obj));
  }

  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      const url = req.url ?? "";

      if (req.method === "POST" && url.includes(":predictLongRunning")) {
        submitCount++;
        try {
          lastSubmitBody = JSON.parse(body);
        } catch {
          lastSubmitBody = null;
        }
        if (mode === "auth_failed") return sendJson(res, 401, { error: { message: "API key not valid." } });
        if (mode === "content_policy") return sendJson(res, 400, { error: { message: "Prompt violates content policy." } });
        if (mode === "quota") return sendJson(res, 429, { error: { message: "Quota exceeded for this project." } });
        if (mode === "server_error") return sendJson(res, 500, { error: { message: "Internal error." } });
        if (mode === "malformed_no_operation_name") return sendJson(res, 200, {});

        const operationName = `operations/fake-op-${submitCount}`;
        pollCounts.set(operationName, 0);
        return sendJson(res, 200, { name: operationName });
      }

      if (req.method === "GET" && url.startsWith("/operations/")) {
        const operationName = url.slice(1);
        const n = (pollCounts.get(operationName) ?? 0) + 1;
        pollCounts.set(operationName, n);

        if (mode === "provider_error_on_poll") return sendJson(res, 500, { error: { message: "Transient poll transport error." } });

        const isDone = mode === "immediate_done" || n >= doneAfterPolls;
        if (!isDone) return sendJson(res, 200, { name: operationName, done: false });

        if (mode === "operation_error") return sendJson(res, 200, { name: operationName, done: true, error: { code: 3, message: "Generation failed: unsafe content detected." } });
        if (mode === "done_no_video_uri") return sendJson(res, 200, { name: operationName, done: true, response: { generateVideoResponse: { generatedSamples: [] } } });

        const videoUri = `http://127.0.0.1:${port}/download/${operationName.replace("operations/", "")}.mp4`;
        return sendJson(res, 200, { name: operationName, done: true, response: { generateVideoResponse: { generatedSamples: [{ video: { uri: videoUri } }] } } });
      }

      if (req.method === "GET" && url.startsWith("/download/")) {
        if (mode === "download_fails") {
          res.writeHead(500, { "Content-Type": "application/json" });
          return res.end(JSON.stringify({ error: { message: "Video download failed." } }));
        }
        res.writeHead(200, { "Content-Type": "video/mp4" });
        return res.end(videoBytes);
      }

      sendJson(res, 404, { error: { message: "Not found." } });
    });
  });

  return {
    setMode: (m: FakeVeoMode) => {
      mode = m;
    },
    setDoneAfterPolls: (n: number) => {
      doneAfterPolls = n;
    },
    getSubmitCount: () => submitCount,
    getLastSubmitBody: () => lastSubmitBody,
    getVideoBytes: () => videoBytes,
    start: () => new Promise<void>((resolve) => server.listen(port, "127.0.0.1", () => resolve())),
    stop: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
