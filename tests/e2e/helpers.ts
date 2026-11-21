// SPDX-License-Identifier: AGPL-3.0-only
import { expect, type Page } from "@playwright/test";
import { Pool } from "pg";

export const PASSWORD = "e2e-password-long-enough";

export function testDb() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !new URL(url).pathname.endsWith("_test"))
    throw new Error("Use an isolated _test database");
  return new Pool({ connectionString: url });
}

export async function verificationUrl(pool: Pool, email: string) {
  for (let i = 0; i < 20; i++) {
    const r = await pool.query(
      "select url from email_preview where recipient=$1 and kind='verification' order by created_at desc limit 1",
      [email],
    );
    if (r.rows[0]) return r.rows[0].url as string;
    await new Promise((res) => setTimeout(res, 250));
  }
  throw new Error("No verification email");
}

/** Creates a verified, onboarded account through the real auth API. */
export async function createMember(page: Page, pool: Pool, name: string) {
  const email = `${name.toLowerCase()}-${Date.now()}-${Math.round(Math.random() * 1e6)}@example.test`;
  const base = new URL(
    page.context().pages()[0]?.url() || "http://localhost:3000",
  ).origin;
  const origin = base.startsWith("http") ? base : "http://localhost:3000";
  const res = await page.request.post("/api/auth/sign-up/email", {
    data: { email, password: PASSWORD, name, callbackURL: "/dashboard" },
    headers: { Origin: origin },
  });
  expect(res.ok()).toBeTruthy();
  await page.request
    .get(await verificationUrl(pool, email), { maxRedirects: 0 })
    .catch(() => {});
  const { rows } = await pool.query('select id from "user" where email=$1', [
    email,
  ]);
  const id = rows[0].id as string;
  const username = `${name.toLowerCase()}${Math.round(Math.random() * 1e6)}`;
  await pool.query(
    `insert into profile (user_id, username, display_name, referral_code, timezone, onboarded_at, birthdate_confirmed, segments)
     values ($1, $2, $3, $4, 'America/New_York', now(), true, '{study}')`,
    [id, username, name, `c${Math.round(Math.random() * 1e9).toString(36)}`],
  );
  return { id, email, username };
}

export async function signIn(page: Page, email: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(/dashboard|onboarding/);
}

export async function removeUsers(pool: Pool, emails: string[]) {
  await pool.query('delete from "user" where email = any($1)', [emails]);
  await pool.query("delete from email_preview where recipient = any($1)", [
    emails,
  ]);
}
