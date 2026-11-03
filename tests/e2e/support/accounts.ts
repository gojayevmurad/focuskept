import { expect, type Page } from "./test";
import type { Pool } from "pg";

/** Signs up through the real UI and follows the verification link (isolated test DB). */
export async function signUpAndVerify(
  page: Page,
  pool: Pool,
  email: string,
  next?: string,
) {
  await pool.query("delete from rate_limit");
  await page.goto(
    `/en/sign-up${next ? `?next=${encodeURIComponent(next)}` : ""}`,
  );
  await page.getByLabel("Your name").fill("E2E Learner");
  await page.getByLabel("Email address").fill(email);
  await page
    .getByLabel("Password", { exact: true })
    .fill("e2e-password-long-enough");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/verify-email/);
  const link = await pool.query(
    "select url from email_preview where recipient=$1 order by created_at desc limit 1",
    [email],
  );
  await page.goto(link.rows[0].url);
}

export async function cleanupUser(pool: Pool, email: string) {
  await pool.query('delete from "user" where email=$1', [email]);
  await pool.query("delete from email_preview where recipient=$1", [email]);
}
