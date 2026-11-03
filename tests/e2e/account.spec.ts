import { execFileSync } from "node:child_process";
import { test, expect } from "./support/test";
import { Pool } from "pg";
const url = process.env.TEST_DATABASE_URL;
test.skip(
  !url,
  "Requires an isolated PostgreSQL database and app running with DATABASE_URL=TEST_DATABASE_URL",
);
test("verified registration, login, profile and paid access", async ({
  page,
}) => {
  if (!url || !new URL(url).pathname.endsWith("_test"))
    throw new Error("Use an isolated _test database");
  test.setTimeout(90000);
  if (process.env.DATABASE_URL !== url)
    throw new Error(
      "Browser app and test runner must use the same isolated DATABASE_URL",
    );
  const email = `e2e-${Date.now()}@example.test`;
  const pool = new Pool({ connectionString: url });
  try {
    // Isolated test DB only: earlier runs must not trip the per-minute sign-up limit.
    await pool.query("delete from rate_limit");
    await page.goto("/en/sign-up");
    await page.getByLabel("Your name").fill("Test Builder");
    await page.getByLabel("Email address").fill(email);
    await page
      .getByLabel("Password", { exact: true })
      .fill("test-password-very-long");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/en\/verify-email/);
    const result = await pool.query(
      "select url from email_preview where recipient=$1 order by created_at desc limit 1",
      [email],
    );
    // The verification link signs the user in and returns to the app.
    await page.goto(result.rows[0].url);
    await expect(page).toHaveURL(/\/en\/app/);
    // Signed-in users never see the sign-in or sign-up forms.
    await page.goto("/en/sign-in");
    await expect(page).toHaveURL(/\/en\/app$/);
    await page.goto("/en/sign-up?next=/app/tasks");
    await expect(page).toHaveURL(/\/en\/app\/tasks$/);
    await page.goto("/en/app/settings");
    await page.getByLabel("Display name").fill("Updated Builder");
    await page
      .locator("form")
      .filter({ has: page.getByLabel("Display name") })
      .getByRole("button", { name: "Save", exact: true })
      .click();
    await expect(
      page.getByRole("status").filter({ hasText: "Changes saved." }),
    ).toBeVisible();
    await page.goto("/en/app/billing");
    await expect(
      page.getByRole("heading", { name: "Free", exact: true }),
    ).toBeVisible();
    const owner = await pool.query('select id from "user" where email=$1', [
      email,
    ]);
    execFileSync(
      process.execPath,
      [
        "node_modules/vitest/vitest.mjs",
        "run",
        "tests/integration/paid-access.test.ts",
      ],
      {
        env: { ...process.env, E2E_GRANT_USER_ID: owner.rows[0].id },
        timeout: 20000,
      },
    );
    await page.goto("/en/app/billing");
    await expect(
      page.getByRole("heading", { name: "Pro", exact: true }),
    ).toBeVisible();

    await page.goto("/en/app/settings/security");
    await page.getByLabel("Current password").fill("test-password-very-long");
    await page.getByLabel("New password").fill("updated-password-very-long");
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Password changed." }),
    ).toBeVisible();
    await page.goto("/en/app/settings");
    await page.getByRole("button", { name: "Account and settings" }).click();
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(page).toHaveURL(/\/en\/sign-in/);
    await page.goto("/en/forgot-password");
    await page.getByLabel("Email address").fill(email);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "reset link is on its way" }),
    ).toBeVisible();
    const reset = await pool.query(
      "select url from email_preview where recipient=$1 and kind='reset' order by created_at desc limit 1",
      [email],
    );
    await page.goto(reset.rows[0].url);
    await page.getByLabel("New password").fill("reset-password-very-long");
    await page.getByRole("button", { name: "Update password" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Password updated" }),
    ).toBeVisible();
  } finally {
    await pool.query('delete from "user" where email=$1', [email]);
    await pool.query("delete from email_preview where recipient=$1", [email]);
    await pool.end();
  }
});
