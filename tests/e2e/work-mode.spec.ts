import { test, expect, type Page } from "./support/test";
import { Pool } from "pg";

async function runShortFocusBlock(page: Page) {
  await page.goto("/en/focus");
  await page.getByRole("radio", { name: "Working" }).click();
  await page
    .getByLabel("What are you working on? (optional)")
    .fill("Write chapter outline");
  await expect(page.getByRole("button", { name: /Rhythm/ })).toContainText(
    "25/5",
  );
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect(page.getByRole("timer")).toHaveText(/25:00|24:5\d/);
  await page.clock.fastForward("25:01");
  await expect(page.getByText("Break · block 1 of 4 done")).toBeVisible({
    timeout: 5000,
  });
  await page.getByRole("button", { name: "End session" }).click();
  await expect(
    page.getByRole("heading", { name: "How did it go?" }),
  ).toBeVisible();
  await page.getByRole("radio", { name: /great/ }).click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("25 min of focus today")).toBeVisible();
}

test("anonymous 25/5 session → rating → today's stats", async ({ page }) => {
  await page.clock.install();
  await runShortFocusBlock(page);
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("focuskept:v1") || "{}"),
  );
  expect(stored.sessions).toHaveLength(1);
  expect(stored.sessions[0]).toMatchObject({
    timeTechnique: "pomodoro",
    focusRating: 4,
    focusedSeconds: 1500,
  });
  // Reloading mid-session resumes from timestamps.
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.clock.fastForward("03:00");
  await page.reload();
  await expect(page.getByRole("timer")).toHaveText(/21:5\d|22:00/);
});

const url = process.env.TEST_DATABASE_URL;

/** Signs up and follows the verification link, landing in the signed-in app. */
async function signUpAndVerify(page: Page, pool: Pool, email: string) {
  // Isolated test DB only: earlier runs must not trip the per-minute sign-up limit.
  await pool.query("delete from rate_limit");
  await page.goto("/en/sign-up");
  await page.getByLabel("Your name").fill("Importer");
  await page.getByLabel("Email address").fill(email);
  await page
    .getByLabel("Password", { exact: true })
    .fill("import-password-long");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/verify-email/);
  const link = await pool.query(
    "select url from email_preview where recipient=$1 order by created_at desc limit 1",
    [email],
  );
  await page.goto(link.rows[0].url);
}

async function removeUser(pool: Pool, email: string) {
  await pool.query('delete from "user" where email=$1', [email]);
  await pool.query("delete from email_preview where recipient=$1", [email]);
  await pool.end();
}

test("sign-up imports the sessions recorded on this device", async ({
  page,
}) => {
  test.skip(!url, "Requires the isolated test database");
  test.setTimeout(90_000);
  await page.clock.install();
  await runShortFocusBlock(page);
  const email = `e2e-import-${Date.now()}@example.test`;
  const pool = new Pool({ connectionString: url });
  try {
    await signUpAndVerify(page, pool, email);
    await expect(
      page.getByRole("heading", { name: "Bring your sessions with you?" }),
    ).toBeVisible();
    await expect(page.getByText(/1 session and 1 task/)).toBeVisible();
    await page.getByRole("button", { name: "Import" }).click();
    await expect(page.getByText(/Imported 1 session and 1 task/)).toBeVisible();
    const rows = await pool.query(
      `select s.time_technique, s.focus_rating, t.title from focus_session s join "user" u on u.id = s.user_id left join task t on t.id = s.task_id where u.email=$1`,
      [email],
    );
    expect(rows.rows).toEqual([
      {
        time_technique: "pomodoro",
        focus_rating: 4,
        title: "Write chapter outline",
      },
    ]);
    const local = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("focuskept:v1") || "{}"),
    );
    expect(local.sessions).toEqual([]);
    expect(local.importedAt).toBeTruthy();
  } finally {
    await removeUser(pool, email);
  }
});

test("declining the import keeps the prompt away after a reload", async ({
  page,
}) => {
  test.skip(!url, "Requires the isolated test database");
  test.setTimeout(90_000);
  await page.clock.install();
  await runShortFocusBlock(page);
  const email = `e2e-decline-${Date.now()}@example.test`;
  const pool = new Pool({ connectionString: url });
  try {
    await signUpAndVerify(page, pool, email);
    const prompt = page.getByRole("heading", {
      name: "Bring your sessions with you?",
    });
    await expect(prompt).toBeVisible();
    await page.getByRole("button", { name: "Not now" }).click();
    await expect(prompt).toBeHidden();
    await page.goto("/en/app");
    // The prompt mounts right after hydration; give it a moment before
    // asserting that it stays away.
    await page.waitForTimeout(1000);
    await expect(prompt).toHaveCount(0);
    // The local data stays on the device, unimported.
    const local = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("focuskept:v1") || "{}"),
    );
    expect(local.sessions).toHaveLength(1);
    expect(local.importedAt).toBeUndefined();
    expect(local.importDeclinedAt).toBeTruthy();
  } finally {
    await removeUser(pool, email);
  }
});
