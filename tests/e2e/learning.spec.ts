import { test, expect, type Page } from "./support/test";
import { Pool } from "pg";
import { cleanupUser, signUpAndVerify } from "./support/accounts";

const url = process.env.TEST_DATABASE_URL;
test.skip(!url, "Requires the isolated test database");

const explanation =
  "Plants catch sunlight with their green leaves. They take water from the soil and carbon dioxide from the air and turn them into sugar, which is their food. Oxygen comes out as a leftover.";

async function learningSessionToExplain(page: Page, topic: string) {
  await page.goto(`/en/app/learn/new?topic=${encodeURIComponent(topic)}`);
  await expect(page).toHaveURL(/\/en\/app\?topic=/);
  await expect(page.getByLabel("What are you learning?")).toHaveValue(topic);
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.clock.fastForward("25:01");
  await page.getByRole("button", { name: "End session" }).click();
  await expect(page).toHaveURL(/\/en\/app\/learn\/.+\/explain/);
  await expect(
    page.getByText("Your explanation is processed by OpenAI"),
  ).toBeVisible();
}

test("learning session → Feynman → AI questions → card → reviews pass and fail", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const pool = new Pool({ connectionString: url });
  const email = `e2e-learn-${Date.now()}@example.test`;
  try {
    await page.clock.install();
    await signUpAndVerify(
      page,
      pool,
      email,
      "/app/learn/new?topic=Photosynthesis",
    );
    await expect(page).toHaveURL(/\/en\/app\?topic=Photosynthesis/);
    await learningSessionToExplain(page, "Photosynthesis");
    const box = page.getByRole("textbox", {
      name: "What did you learn? Write it in your own words.",
    });
    await box.fill("Too short");
    await expect(page.getByRole("button", { name: "Check" })).toBeDisabled();
    await box.fill(explanation);
    await page.getByRole("button", { name: "Check" }).click();
    await expect(page.getByText("Clarity 78/100")).toBeVisible();
    await expect(
      page.getByText("Say where the plant gets its energy from."),
    ).toBeVisible();
    await expect(
      page.getByText("Question 3", { exact: true }).first(),
    ).toBeVisible();
    await page.getByRole("button", { name: /^Keep \d+ questions$/ }).click();
    await expect(
      page.getByRole("heading", { name: /questions are ready/ }),
    ).toBeVisible();

    // Due dates are in the user's local calendar, not the database's UTC date.
    const card = await pool.query(
      `select li.id, li.due_on::text as due, (li.due_on - (select (now() at time zone p.timezone)::date from user_preferences p where p.user_id = li.user_id)) as days, li.prompt_version from learning_item li join "user" u on u.id = li.user_id where u.email=$1`,
      [email],
    );
    expect(card.rows[0].days).toBe(5);
    expect(card.rows[0].prompt_version).toBeTruthy();

    // Make it due today, then pass the review.
    await pool.query(
      "update learning_item set due_on = (select (now() at time zone p.timezone)::date from user_preferences p where p.user_id = learning_item.user_id) where id=$1",
      [card.rows[0].id],
    );
    await page.goto("/en/app/review");
    await expect(page.getByText("Card 1 of 1")).toBeVisible();
    await page.getByRole("button", { name: "True", exact: true }).click();
    await page.getByRole("button", { name: "Next question" }).click();
    await page.getByLabel("Missing word").fill("Sugar");
    await page.getByRole("button", { name: "Check" }).click();
    await expect(page.getByText("Correct.")).toBeVisible();
    await page.getByRole("button", { name: "Next question" }).click();
    await page
      .getByPlaceholder("Your answer")
      .fill("Light gives them the energy to make sugar.");
    await page.getByRole("button", { name: "Check" }).click();
    await expect(
      page.getByText("Exactly: light gives the energy."),
    ).toBeVisible();
    await page.getByRole("button", { name: "Finish card" }).click();
    await expect(page.getByRole("heading", { name: "Passed" })).toBeVisible();
    let row = await pool.query(
      "select (due_on - (select (now() at time zone p.timezone)::date from user_preferences p where p.user_id = learning_item.user_id)) as days, current_step from learning_item where id=$1",
      [card.rows[0].id],
    );
    expect(row.rows[0]).toEqual({ days: 5, current_step: 1 });

    // Fail it: returns in 2 days at the same step.
    await pool.query(
      "update learning_item set due_on = (select (now() at time zone p.timezone)::date from user_preferences p where p.user_id = learning_item.user_id) where id=$1",
      [card.rows[0].id],
    );
    await page.goto("/en/app/review");
    await page.getByRole("button", { name: "False", exact: true }).click();
    await page.getByRole("button", { name: "Next question" }).click();
    await page.getByLabel("Missing word").fill("salt");
    await page.getByRole("button", { name: "Check" }).click();
    await page.getByRole("button", { name: "Next question" }).click();
    await page.getByPlaceholder("Your answer").fill("No idea");
    await page.getByRole("button", { name: "Check" }).click();
    await page.getByRole("button", { name: "Finish card" }).click();
    await expect(page.getByRole("heading", { name: /Not yet/ })).toBeVisible();
    row = await pool.query(
      "select (due_on - (select (now() at time zone p.timezone)::date from user_preferences p where p.user_id = learning_item.user_id)) as days, current_step, relearn from learning_item where id=$1",
      [card.rows[0].id],
    );
    expect(row.rows[0]).toEqual({ days: 2, current_step: 1, relearn: true });
  } finally {
    await cleanupUser(pool, email);
    await pool.end();
  }
});

test("free AI limit shows a calm upgrade card and still allows a manual card", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const pool = new Pool({ connectionString: url });
  const email = `e2e-limit-${Date.now()}@example.test`;
  try {
    await page.clock.install();
    await signUpAndVerify(page, pool, email);
    await expect(page).toHaveURL(/\/en\/app/);
    await pool.query(
      `insert into ai_usage (user_id, period, cards_analyzed) select id, to_char(now() at time zone 'UTC', 'YYYY-MM'), 10 from "user" where email=$1`,
      [email],
    );
    await learningSessionToExplain(page, "Volcanoes");
    await expect(
      page.getByRole("heading", { name: "AI analyses used up for this month" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "See Pro" })).toBeVisible();
    await page
      .getByRole("textbox", {
        name: "What did you learn? Write it in your own words.",
      })
      .fill(explanation);
    await page.getByRole("button", { name: "Write questions myself" }).click();
    await page.getByRole("button", { name: "Open question" }).click();
    await page
      .getByLabel("Question", { exact: true })
      .fill("What comes out of a volcano?");
    await page.getByLabel("Answer", { exact: true }).fill("Lava, ash and gas");
    await page.getByRole("button", { name: "Keep 1 question" }).click();
    await expect(
      page.getByRole("heading", { name: "1 question is ready." }),
    ).toBeVisible();
  } finally {
    await cleanupUser(pool, email);
    await pool.end();
  }
});
