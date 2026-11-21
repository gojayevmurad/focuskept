// SPDX-License-Identifier: AGPL-3.0-only
import { execFileSync } from "node:child_process";
import { test, expect } from "@playwright/test";
import {
  PASSWORD,
  createMember,
  removeUsers,
  signIn,
  testDb,
  verificationUrl,
} from "./helpers";

test.skip(
  !process.env.TEST_DATABASE_URL,
  "Requires the isolated test database",
);

test("sign up, onboard, book up to the free limit, then upgrade", async ({
  page,
}) => {
  const pool = testDb();
  const email = `e2e-core-${Date.now()}@example.test`;
  try {
    await page.goto("/sign-up");
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Your name").fill("Casey Tester");
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();
    // The 18+ confirmation is required.
    await expect(page.getByRole("status")).toContainText("18 or older");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/verify-email/);
    await page.request.get(await verificationUrl(pool, email), {
      maxRedirects: 0,
    });
    await signIn(page, email);

    await expect(page).toHaveURL(/onboarding/);
    await page
      .getByRole("checkbox", { name: "I confirm I am 18 or older." })
      .check();
    await page.getByRole("button", { name: "Next" }).first().click();
    await page.getByText("Studying").click();
    await page.getByRole("button", { name: "Next" }).last().click();
    await page.getByRole("button", { name: "I'll book later" }).click();
    await expect(page).toHaveURL(/dashboard/);
    await expect(
      page.getByRole("heading", { name: /Welcome, Casey/ }),
    ).toBeVisible();

    // Book three sessions on the same day (same week), then hit the free limit.
    await page.goto("/book");
    const tomorrow = 2; // grid columns: time, today, tomorrow
    const slots = page.locator(
      `.cal-scroll > button.slot:nth-child(8n+${tomorrow + 1}):not([disabled])`,
    );
    const book = async (index: number) => {
      await slots.nth(index).click();
      await page.getByRole("button", { name: /^Book 50 min$/ }).click();
      await expect(page.locator(".notice.ok")).toContainText("Booked");
    };
    await book(20);
    await book(24);
    await book(28);
    await slots.nth(32).click();
    await expect(page.locator("dialog .notice.warn")).toContainText(
      "free sessions",
    );
    await expect(
      page.getByRole("button", { name: /^Book 50 min$/ }),
    ).toBeDisabled();
    await page.keyboard.press("Escape");

    // Upgrade through a signed fixture webhook, then the limit is gone.
    const { rows } = await pool.query('select id from "user" where email=$1', [
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
        env: { ...process.env, E2E_GRANT_USER_ID: rows[0].id },
        timeout: 30_000,
      },
    );
    await page.reload();
    await book(32);

    // Cancel one booking from its calendar tile.
    await page.locator(".slot .mine").first().click();
    await page.getByRole("button", { name: "Cancel booking" }).click();
    await expect(page.locator(".notice.ok")).toContainText("cancelled");
  } finally {
    await removeUsers(pool, [email]);
    await pool.end();
  }
});

test("two partners meet in the room, share goals and one blocks the other", async ({
  browser,
}) => {
  const pool = testDb();
  const a = await browser.newContext();
  const b = await browser.newContext();
  const pageA = await a.newPage();
  const pageB = await b.newPage();
  await pageA.goto("/");
  await pageB.goto("/");
  const alice = await createMember(pageA, pool, "Alice");
  const bob = await createMember(pageB, pool, "Bob");
  try {
    const sessionId = crypto.randomUUID();
    await pool.query(
      "insert into focus_session (id, start_at, duration_min, type) values ($1, date_trunc('minute', now()) - interval '1 minute', 25, 'pair')",
      [sessionId],
    );
    for (const person of [alice, bob]) {
      const bookingId = crypto.randomUUID();
      await pool.query(
        "insert into booking (id, user_id, start_at, duration_min, status, session_id) select $1, $2, start_at, 25, 'matched', id from focus_session where id = $3",
        [bookingId, person.id, sessionId],
      );
      await pool.query(
        "insert into session_participant (session_id, user_id, booking_id) values ($1, $2, $3)",
        [sessionId, person.id, bookingId],
      );
    }
    await signIn(pageA, alice.email);
    await signIn(pageB, bob.email);
    await pageA.goto(`/session/${sessionId}`);
    await pageB.goto(`/session/${sessionId}`);

    for (const p of [pageA, pageB]) {
      await p.getByRole("button", { name: "Join with camera" }).click();
      await expect(
        p.getByRole("button", { name: /Mute|Unmute/ }),
      ).toBeEnabled();
    }
    await pageA
      .getByLabel("Your goal for this session")
      .fill("Outline chapter two");
    await pageA.getByRole("button", { name: "Share goal" }).click();
    // Bob sees Alice's goal through the realtime stream.
    await expect(
      pageB.locator(".tile-goal", { hasText: "Outline chapter two" }),
    ).toBeVisible({ timeout: 15_000 });

    await pageB.getByRole("button", { name: "Report" }).click();
    await pageB.getByRole("button", { name: "Block only" }).click();
    await expect(pageB.getByRole("heading", { name: "Blocked" })).toBeVisible();
    const blocked = await pool.query(
      "select 1 from block where blocker_id=$1 and blocked_id=$2",
      [bob.id, alice.id],
    );
    expect(blocked.rowCount).toBe(1);
  } finally {
    await removeUsers(pool, [alice.email, bob.email]);
    await pool.query(
      "delete from focus_session where id not in (select session_id from session_participant)",
    );
    await a.close();
    await b.close();
    await pool.end();
  }
});
