import { readFileSync } from "node:fs";
import { createFakeVeoServer } from "./tests/veo-fake-server.js";
const s = createFakeVeoServer(4012);
s.setVideoBytes(readFileSync("/tmp/claude-0/-home-user-maia-academy-command-center/b781dbb4-122d-518b-abc5-ead2866d4ae2/scratchpad/ui/synthetic.mp4"));
s.setDoneAfterPolls(3);
await s.start();
console.log("UI-TEST stand-in Google server on :4012 (synthetic video, NOT Veo)");
