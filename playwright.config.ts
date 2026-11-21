// SPDX-License-Identifier: AGPL-3.0-only
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  // CI runners compile dev routes slowly on first use.
  timeout: process.env.CI ? 300_000 : 120_000,
  expect: { timeout: process.env.CI ? 30_000 : 10_000 },
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:3000",
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
    // A synthetic camera and microphone, so the session room can be tested.
    permissions: ["camera", "microphone"],
    launchOptions: {
      args: [
        "--use-fake-ui-for-media-stream",
        "--use-fake-device-for-media-stream",
      ],
    },
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "pnpm exec next dev --port 3000",
        env: {
          APP_URL: "http://localhost:3000",
          VIDEO_PROVIDER: "none",
          // Billing runs against fixtures only: no request reaches Polar.
          BILLING_ENABLED: "true",
          POLAR_ACCESS_TOKEN: "e2e-not-a-real-token",
          POLAR_WEBHOOK_SECRET: "e2e-only-signing-key",
          POLAR_PRO_BENEFIT_ID: "fixture-pro",
          POLAR_MONTHLY_PRODUCT_ID: "",
          POLAR_YEARLY_PRODUCT_ID: "",
          ANALYTICS_ENABLED: "false",
          MARKETING_ENABLED: "true",
          SIGNUPS_MODE: "open",
        },
        url: "http://localhost:3000/api/health",
        reuseExistingServer: false,
        timeout: 180_000,
      },
});
