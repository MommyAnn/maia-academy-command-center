import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    testTimeout: 15000,
    fileParallelism: false, // all suites share one Postgres test database
    // Set BEFORE any test file's imports run, so src/env.ts always loads
    // .env.test regardless of import order within a given test file.
    // ANTHROPIC_BASE_URL/ANTHROPIC_API_KEY are forced here (not left to
    // .env.test's own loader) because this sandbox's own outer environment
    // already sets a real ANTHROPIC_BASE_URL (https://api.anthropic.com,
    // used by Claude Code itself) — src/env.ts's loader only fills in a key
    // that ISN'T already present in process.env, so without this override
    // the Phase 6 test suite would silently hit the real Anthropic API
    // instead of the local fake server it starts and controls.
    env: { NODE_ENV: "test", ANTHROPIC_BASE_URL: "http://127.0.0.1:4011", ANTHROPIC_API_KEY: "test-anthropic-key-not-real" },
  },
});
