import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  // One worker: tests share the isolated database and one dev server.
  workers: 1,
  globalSetup: "./tests/e2e/support/warm-up.ts",
  // CI runs on a cold, slower `next dev`: routes compile on first visit.
  expect: { timeout: process.env.CI ? 20_000 : 5_000 },
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:3000",
    trace: "retain-on-failure",
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : [
        {
          // OpenAI-compatible mock so AI flows run without a real key.
          command: "node tests/e2e/support/openai-mock.mjs",
          port: 3999,
          reuseExistingServer: false,
        },
        {
          command: "pnpm exec next dev --port 3000",
          env: {
            APP_URL: "http://localhost:3000",
            OPENAI_API_KEY: "e2e-mock-key",
            AI_BASE_URL: "http://127.0.0.1:3999/v1",
          },
          url: "http://localhost:3000",
          reuseExistingServer: false,
          timeout: 120000,
        },
      ],
});
