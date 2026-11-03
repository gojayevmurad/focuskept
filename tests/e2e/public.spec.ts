import { test, expect } from "./support/test";

test("root redirects to the browser language and renders the landing page", async ({
  browser,
}) => {
  const context = await browser.newContext({ locale: "en-US" });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page).toHaveURL(/\/en$/);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Focus deeply. Keep what you learn.",
    }),
  ).toBeVisible();
  await context.close();
});

test("protected app pages redirect to localized sign-in and remember the target", async ({
  page,
}) => {
  await page.goto("/en/app/settings");
  await expect(page).toHaveURL(/\/en\/sign-in\?next=%2Fapp%2Fsettings/);
});

test("mobile layout has no horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ["/en", "/en/sign-up", "/en/pricing"]) {
    await page.goto(path);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      path,
    ).toBe(true);
  }
});

test("Arabic renders right-to-left without overflow at 390px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("dark by default; light can be chosen from the menu", async ({ page }) => {
  await page.goto("/en");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("radio", { name: "Light" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("pricing shows monthly and yearly Pro and asks visitors to sign in at checkout", async ({
  page,
}) => {
  await page.goto("/en/pricing");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Start free. Upgrade when it’s worth it.",
    }),
  ).toBeVisible();
  await expect(page.getByText("$5")).toBeVisible();
  await expect(page.getByText("$40")).toBeVisible();
  await expect(page.getByText(/lifetime/i)).toHaveCount(1); // only the FAQ answer saying there is none
  await page.getByRole("button", { name: "Choose monthly" }).click();
  await expect(page).toHaveURL(/\/en\/sign-in\?next=%2Fpricing/);
});

test("technique pages are pre-rendered with SEO metadata and a working timer", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("/de/techniques/25-5");
  await expect(page.locator("html")).toHaveAttribute("lang", "de");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://focuskept.com/de/techniques/25-5",
  );
  await expect(
    page.locator('link[rel="alternate"][hreflang="x-default"]'),
  ).toHaveAttribute("href", "https://focuskept.com/en/techniques/25-5");
  expect(await page.locator('link[rel="alternate"][hreflang]').count()).toBe(
    25,
  );
  const jsonLd = await page
    .locator('script[type="application/ld+json"]')
    .first()
    .textContent();
  expect(jsonLd).toContain('"HowTo"');
  await page.goto("/en/techniques/pomodoro");
  await expect(page).toHaveURL(/\/en\/techniques\/25-5$/);
  await expect(page.getByText("not affiliated with")).toBeVisible();
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.clock.fastForward("25:01");
  await expect(page.locator(".phase-label")).toHaveText("Short break", {
    timeout: 5000,
  });
});

test("the chosen theme survives a language switch without script warnings", async ({
  page,
}) => {
  const warnings: string[] = [];
  page.on("console", (m) => {
    if (m.text().includes("Encountered a script tag")) warnings.push(m.text());
  });
  await page.goto("/en/pricing");
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("radio", { name: "Light" }).click();
  await page.locator("#site-menu select").selectOption("az");
  await expect(page).toHaveURL(/\/az\/pricing/);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(warnings).toEqual([]);
});
