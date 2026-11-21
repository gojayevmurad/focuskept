import { execFileSync } from "node:child_process";
import { test, expect } from "@playwright/test";
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
  test.setTimeout(60000);
  if (process.env.DATABASE_URL !== url)
    throw new Error(
      "Browser app and test runner must use the same isolated DATABASE_URL",
    );
  const email = `e2e-${Date.now()}@example.test`;
  const pool = new Pool({ connectionString: url });
  try {
    await page.goto("/sign-up");
    await page.getByLabel("Your name").fill("Test Builder");
    await page.getByLabel("Email address").fill(email);
    await page
      .getByLabel("Password", { exact: true })
      .fill("test-password-very-long");
    await page.getByRole("button", { name: "Create your account" }).click();
    await expect(page).toHaveURL(/verify-email/);
    const result = await pool.query(
      "select url from email_preview where recipient=$1 order by created_at desc limit 1",
      [email],
    );
    await page.goto(result.rows[0].url);
    await page.goto("/sign-in");
    await page.getByLabel("Email address").fill(email);
    await page
      .getByLabel("Password", { exact: true })
      .fill("test-password-very-long");
    await page
      .getByRole("button", { name: "Sign in to your workspace" })
      .click();
    await expect(page).toHaveURL(/dashboard/);
    await page.goto("/feature");
    await expect(
      page.getByRole("heading", { name: "A little more room to build." }),
    ).toBeVisible();
    await page.goto("/settings");
    await page.getByLabel("Display name").fill("Updated Builder");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("status")).toHaveText("Changes saved.");
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
    await page.goto("/feature");
    await expect(
      page.getByRole("heading", { name: "Your Pro workspace is open." }),
    ).toBeVisible();

    await page.goto("/settings/security");
    await page.getByLabel("Current password").fill("test-password-very-long");
    await page.getByLabel("New password").fill("updated-password-very-long");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("status")).toHaveText("Changes saved.");
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await page.goto("/forgot-password");
    await page.getByLabel("Email address").fill(email);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByRole("status")).toContainText(
      "If an account exists",
    );
    const reset = await pool.query(
      "select url from email_preview where recipient=$1 and kind='reset' order by created_at desc limit 1",
      [email],
    );
    await page.goto(reset.rows[0].url);
    await page
      .getByLabel("Password", { exact: true })
      .fill("reset-password-very-long");
    await page.getByRole("button", { name: "Update password" }).click();
    await expect(page.getByRole("status")).toContainText("Password updated");
  } finally {
    await pool.query('delete from "user" where email=$1', [email]);
    await pool.query("delete from email_preview where recipient=$1", [email]);
    await pool.end();
  }
});
