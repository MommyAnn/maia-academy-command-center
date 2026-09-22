import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    testTimeout: 15000,
    fileParallelism: false, // all suites share one Postgres test database
    // Set BEFORE any test file's imports run, so src/env.ts always loads
    // .env.test regardless of import order within a given test file.
    env: { NODE_ENV: "test" },
  },
});
