import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:3000",
    trace: "retain-on-failure",
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "pnpm exec next dev --port 3000",
        env: { APP_URL: "http://localhost:3000" },
        url: "http://localhost:3000",
        reuseExistingServer: false,
        timeout: 120000,
      },
});
