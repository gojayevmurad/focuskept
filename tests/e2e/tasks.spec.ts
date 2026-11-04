import { test, expect } from "./support/test";
import { Pool } from "pg";
import { cleanupUser, signUpAndVerify } from "./support/accounts";

const url = process.env.TEST_DATABASE_URL;
test.skip(!url, "Requires the isolated test database");

test("day board: quick add fills slots, Incoming flags, plan tomorrow", async ({
  page,
}) => {
  test.setTimeout(90000);
  const pool = new Pool({ connectionString: url });
  const email = `e2e-tasks-${Date.now()}@example.test`;
  try {
    await signUpAndVerify(page, pool, email, "/app/tasks");
    await page.goto("/en/app/tasks");
    // The device-import prompt may appear for a fresh account.
    const notNow = page.getByRole("button", { name: "Not now" });
    if (await notNow.isVisible().catch(() => false)) await notNow.click();

    const add = page.getByLabel("New task");
    await add.fill("Write lab report 50m today !! #uni");
    await expect(page.locator(".board-chips")).toContainText("Medium slot");
    await add.press("Enter");
    const medium = page.getByRole("list", { name: "Then these" });
    await expect(medium).toContainText("Write lab report");
    await expect(medium).toContainText("#uni");

    await add.fill("Read the syllabus 90m today");
    await add.press("Enter");
    await expect(page.locator(".board-first")).toContainText(
      "Read the syllabus",
    );

    await add.fill("Plan next week");
    await add.press("Enter");
    const incoming = page.locator(".board-aside");
    await expect(incoming).toContainText("Plan next week");
    await incoming
      .getByRole("button", { name: "“Plan next week” is important" })
      .click();
    await expect(
      incoming.getByRole("button", { name: "“Plan next week” is important" }),
    ).toHaveAttribute("aria-pressed", "true");

    // Evening step: put two tasks on tomorrow's list, in order.
    await incoming.getByRole("button", { name: /Plan tomorrow/ }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: /Plan next week/ }).click();
    await dialog.getByRole("button", { name: /Write lab report/ }).click();
    await dialog.getByRole("button", { name: "Save for tomorrow" }).click();
    await expect(page.getByText("Tomorrow’s list is saved.")).toBeVisible();

    await page.reload();
    const tomorrow = page.locator(".board-aside .incoming-group").first();
    await expect(tomorrow.locator(".incoming-row").nth(0)).toContainText(
      "Plan next week",
    );
    await expect(tomorrow.locator(".incoming-row").nth(1)).toContainText(
      "Write lab report",
    );
    await expect(medium).not.toContainText("Write lab report");
  } finally {
    await cleanupUser(pool, email);
    await pool.end();
  }
});

test("day board: edits made while a new task is saving are kept", async ({
  page,
}) => {
  test.setTimeout(90000);
  const pool = new Pool({ connectionString: url });
  const email = `e2e-tasks-slow-${Date.now()}@example.test`;
  try {
    await signUpAndVerify(page, pool, email, "/app/tasks");
    await page.goto("/en/app/tasks");
    const notNow = page.getByRole("button", { name: "Not now" });
    if (await notNow.isVisible().catch(() => false)) await notNow.click();

    await page.route("**/api/tasks", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.continue();
    });
    await page.getByLabel("New task").fill("Slow task");
    await page.getByLabel("New task").press("Enter");

    const incoming = page.locator(".board-aside");
    await incoming
      .getByRole("button", { name: "“Slow task” is important" })
      .click();
    await incoming.getByRole("button", { name: /Plan tomorrow/ }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: /Slow task/ }).click();
    await dialog.getByRole("button", { name: "Save for tomorrow" }).click();
    await expect(page.getByText("Tomorrow’s list is saved.")).toBeVisible();

    await page.reload();
    const tomorrow = page.locator(".board-aside .incoming-group").first();
    await expect(tomorrow.locator(".incoming-row").first()).toContainText(
      "Slow task",
    );
    await expect(
      tomorrow.getByRole("button", { name: "“Slow task” is important" }),
    ).toHaveAttribute("aria-pressed", "true");
  } finally {
    await cleanupUser(pool, email);
    await pool.end();
  }
});

test("day board: the planner does not say saved when saving fails", async ({
  page,
}) => {
  test.setTimeout(90000);
  const pool = new Pool({ connectionString: url });
  const email = `e2e-tasks-fail-${Date.now()}@example.test`;
  try {
    await signUpAndVerify(page, pool, email, "/app/tasks");
    await page.goto("/en/app/tasks");
    const notNow = page.getByRole("button", { name: "Not now" });
    if (await notNow.isVisible().catch(() => false)) await notNow.click();

    await page.getByLabel("New task").fill("Failing task");
    await page.getByLabel("New task").press("Enter");
    const incoming = page.locator(".board-aside");
    await expect(incoming).toContainText("Failing task");

    await page.route("**/api/tasks/*", (route) =>
      route.fulfill({ status: 500, json: { error: "internal" } }),
    );
    await incoming.getByRole("button", { name: /Plan tomorrow/ }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: /Failing task/ }).click();
    await dialog.getByRole("button", { name: "Save for tomorrow" }).click();

    await expect(dialog).toBeVisible();
    await expect(page.getByText("Tomorrow’s list is saved.")).toHaveCount(0);
  } finally {
    await cleanupUser(pool, email);
    await pool.end();
  }
});
