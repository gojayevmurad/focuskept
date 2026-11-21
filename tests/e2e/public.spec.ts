import { test, expect } from "@playwright/test";
test("landing, pricing and registration navigation", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Your idea deserves a head start." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Pricing", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "A plan for your next step." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Get started free" }).click();
  await expect(page.getByLabel("Email address")).toBeVisible();
});
test("protected dashboard requires authentication", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/sign-in/);
});
test("mobile layout has no horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("theme can be switched", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Toggle color theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});
