import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const action = process.argv[2];
const commands = {
  up: ["up", "-d", "--build", "--wait", "app", "db"],
  stop: ["stop", "app", "db", "test-db"],
  logs: ["logs", "-f", "app"],
  migrate: ["run", "--rm", "--no-deps", "app", "pnpm", "db:migrate"],
  "test-db": ["--profile", "test", "up", "-d", "test-db"],
};
let result;
if (action === "e2e") {
  if (
    !process.env.TEST_DATABASE_URL ||
    !new URL(process.env.TEST_DATABASE_URL).pathname.endsWith("_test")
  )
    throw new Error("Configure an isolated TEST_DATABASE_URL ending in _test");
  result = spawnSync("pnpm", ["exec", "playwright", "test"], {
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: process.env.TEST_DATABASE_URL,
      APP_URL: "http://localhost:3000",
      APP_PORT: "3000",
    },
  });
} else if (action === "dev") {
  result = spawnSync("pnpm", ["exec", "next", "dev"], {
    stdio: "inherit",
    env: { ...process.env, PORT: process.env.APP_PORT || "3000" },
  });
} else {
  if (!existsSync(".env.local") || !process.env.COMPOSE_PROJECT_NAME)
    throw new Error(
      "Run pnpm setup first. Existing env files are preserved; add the generated project values if needed.",
    );
  if (!commands[action]) throw new Error("Unknown local command");
  result = spawnSync(
    "docker",
    ["compose", "--env-file", ".env.local", ...commands[action]],
    { stdio: "inherit", env: process.env },
  );
}
if (result.error) {
  console.error(result.error.message);
  process.exitCode = 1;
} else process.exitCode = result.status ?? 1;
