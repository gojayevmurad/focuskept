import { chromium, type FullConfig } from "@playwright/test";

// `next dev` compiles each route on first request. On a cold CI runner that
// can outlast an assertion timeout, and a click before hydration submits the
// form natively, so compile the routes the specs rely on before they start.
const PAGES = [
  "/en",
  "/en/focus",
  "/en/sign-up",
  "/en/sign-in",
  "/en/verify-email",
  "/en/forgot-password",
  "/en/pricing",
  "/en/app",
  "/en/app/review",
  "/en/app/cards",
  "/en/app/settings",
  "/en/app/billing",
  "/en/app/tasks",
  // Dynamic routes compile once per pattern; the id doesn't need to exist.
  "/en/app/learn/warm-up/explain",
  "/en/app/cards/warm-up",
];
const ROUTES = ["/api/health", "/api/auth/ok"];

export default async function warmUp(config: FullConfig) {
  if (process.env.E2E_BASE_URL) return; // an already-running server is warm
  const baseURL = config.projects[0].use.baseURL!;
  for (const path of ROUTES) await fetch(baseURL + path).catch(() => {});
  const browser = await chromium.launch();
  const page = await browser.newPage({ baseURL });
  for (const path of PAGES)
    await page
      .goto(path, { waitUntil: "networkidle", timeout: 180_000 })
      .catch(() => {});
  await browser.close();
}
