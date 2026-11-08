import { test, expect } from "./support/test";
import { Pool } from "pg";
import { cleanupUser, signUpAndVerify } from "./support/accounts";

const url = process.env.TEST_DATABASE_URL;
test.skip(!url, "Requires the isolated test database");

test("timer: today's tasks from the day sheet and the side panel", async ({
  page,
}) => {
  test.setTimeout(90000);
  const pool = new Pool({ connectionString: url });
  const email = `e2e-day-${Date.now()}@example.test`;
  try {
    await signUpAndVerify(page, pool, email, "/app/tasks");
    await page.goto("/en/app/tasks");
    const notNow = page.getByRole("button", { name: "Not now" });
    if (await notNow.isVisible().catch(() => false)) await notNow.click();
    const add = page.getByLabel("New task");
    await add.fill("Draft slides 30m today");
    await add.press("Enter");
    await expect(page.locator(".board-main")).toContainText("Draft slides");
    await add.fill("Email the team 10m today");
    await add.press("Enter");
    await expect(page.locator(".board-main")).toContainText("Email the team");

    await page.goto("/en/app");
    const strip = page.locator(".day-strip");
    await expect(strip).toContainText("0/2");
    await strip.click();
    const sheet = page.getByRole("dialog", { name: "Today" });
    await sheet
      .getByRole("button", { name: "Focus on “Draft slides”" })
      .click();
    await expect(page.getByLabel("What are you working on?")).toHaveValue(
      "Draft slides",
    );
    await page.getByRole("button", { name: "Start", exact: true }).click();

    const panel = page.locator(".focus-panel");
    await expect(panel).toContainText("Draft slides");
    await panel
      .getByRole("button", { name: "Switch to “Email the team”" })
      .click();
    await expect(page.locator(".run-title")).toHaveText("Email the team");
    await panel.getByRole("button", { name: "Task done" }).click();
    await expect(panel).toContainText("Draft slides");
    await expect(panel.locator(".board-check.is-done")).toHaveCount(0);

    await expect
      .poll(async () => {
        const { rows } = await pool.query(
          `select t.status from task t join "user" u on u.id = t.user_id
           where u.email = $1 and t.title = 'Email the team'`,
          [email],
        );
        return rows[0]?.status;
      })
      .toBe("done");
  } finally {
    await cleanupUser(pool, email);
    await pool.end();
  }
});

test("timer: a learning session keeps the chosen subject", async ({ page }) => {
  test.setTimeout(90000);
  const pool = new Pool({ connectionString: url });
  const email = `e2e-subject-${Date.now()}@example.test`;
  try {
    await page.clock.install();
    await signUpAndVerify(page, pool, email, "/app");
    await page.goto("/en/app");
    const notNow = page.getByRole("button", { name: "Not now" });
    if (await notNow.isVisible().catch(() => false)) await notNow.click();
    await page.getByRole("button", { name: "New subject" }).click();
    await page.getByLabel("New subject").fill("Chemistry");
    await page.getByLabel("New subject").press("Enter");
    await expect(
      page.getByRole("button", { name: "Chemistry", pressed: true }),
    ).toBeVisible();
    await page.getByLabel("What are you learning?").fill("Acids and bases");
    await page.getByRole("button", { name: "Start", exact: true }).click();
    await expect(page.locator(".focus-panel")).toContainText("Chemistry");
    await page.clock.fastForward("25:01");
    await page.getByRole("button", { name: "End session" }).click();
    await expect(page).toHaveURL(/\/en\/app\/learn\/.+\/explain/);

    const { rows } = await pool.query(
      `select s.name from focus_session f
       join subject s on s.id = f.subject_id
       join "user" u on u.id = f.user_id
       where u.email = $1`,
      [email],
    );
    expect(rows.map((r) => r.name)).toEqual(["Chemistry"]);
  } finally {
    await cleanupUser(pool, email);
    await pool.end();
  }
});
