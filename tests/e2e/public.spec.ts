// SPDX-License-Identifier: AGPL-3.0-only
import { test, expect } from "@playwright/test";
import { hydrated } from "./helpers";

test("landing and registration navigation", async ({ page }) => {
  await page.goto("/");
  await hydrated(page);
  await expect(
    page.getByRole("heading", {
      name: "Get it done with someone beside you",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "How it works", exact: true }).first(),
  ).toHaveAttribute("href", "/how-it-works");
  await expect(
    page.getByRole("link", { name: "FAQ", exact: true }).first(),
  ).toHaveAttribute("href", "/faq");
  // Billing is on in the browser test environment, so pricing is linked.
  await expect(
    page.getByRole("link", { name: "Pricing", exact: true }).first(),
  ).toHaveAttribute("href", "/pricing");
  await page
    .getByRole("link", { name: "Get started free", exact: true })
    .first()
    .click();
  await expect(page.getByLabel("Email address")).toBeVisible();
});

test("SEO page and sitemap expose study content", async ({ page, request }) => {
  await page.goto("/body-doubling-for/adhd");
  await expect(
    page.getByRole("heading", {
      name: "Gentle Body Doubling for ADHD Minds",
      exact: true,
    }),
  ).toBeVisible();
  const response = await request.get("/sitemap.xml");
  expect(response.ok()).toBe(true);
  expect(await response.text()).toContain("/study-with-me/bar-exam");
});

test("protected dashboard requires authentication", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/sign-in/, { timeout: 15000 });
});

for (const path of ["/", "/blog"]) {
  test(`mobile layout has no horizontal overflow on ${path}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(path);
    await hydrated(page);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });
}

test("theme cycles through system, light and dark", async ({ page }) => {
  await page.goto("/");
  await hydrated(page);
  const html = page.locator("html");
  // A first visit follows the device setting, so no explicit theme is set.
  await expect(html).not.toHaveAttribute("data-theme", /.+/);
  const toggle = page.getByRole("button", { name: /^Color theme:/ }).first();
  await toggle.click();
  await expect(html).toHaveAttribute("data-theme", "light");
  await toggle.click();
  await expect(html).toHaveAttribute("data-theme", "dark");
  await toggle.click();
  await expect(html).not.toHaveAttribute("data-theme", /.+/);
  await page.reload();
  await expect(html).not.toHaveAttribute("data-theme", /.+/);
});
