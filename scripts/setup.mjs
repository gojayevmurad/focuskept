// Generates local and production env files with random secrets from
// saas.config.json and .env.example. Existing files are never overwritten.
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const secret = () => randomBytes(32).toString("hex");

function withValues(source, values) {
  return Object.entries(values).reduce((text, [key, value]) => {
    const line = `${key}=${value}`;
    const pattern = new RegExp(`^${key}=.*$`, "m");
    return pattern.test(text)
      ? text.replace(pattern, () => line)
      : `${text}\n${line}\n`;
  }, source);
}

export function initialize(root) {
  const config = JSON.parse(
    readFileSync(resolve(root, "saas.config.json"), "utf8"),
  );
  const { slug, domain, repository, deployPath, port, dbPort, testDbPort } =
    config;
  if (
    existsSync(resolve(root, "deploy/generated/.env")) !==
    existsSync(resolve(root, "deploy/generated/runtime.env"))
  )
    throw new Error(
      "Incomplete production files in deploy/generated: restore the missing one or delete both.",
    );

  const preserved = [];
  const write = (path, content, mode) => {
    const target = resolve(root, path);
    if (existsSync(target)) return preserved.push(path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content, { mode });
  };

  const defaults = readFileSync(resolve(root, ".env.example"), "utf8");
  const dbName = slug.replaceAll("-", "_");
  const localPassword = secret();
  const prodPassword = secret();
  const cronSecret = secret();

  write(
    ".env.local",
    withValues(defaults, {
      APP_URL: `http://localhost:${port}`,
      APP_PORT: port,
      DB_PORT: dbPort,
      TEST_DB_PORT: testDbPort,
      COMPOSE_PROJECT_NAME: `${slug}-dev`,
      POSTGRES_DB: dbName,
      POSTGRES_USER: dbName,
      POSTGRES_PASSWORD: localPassword,
      DATABASE_URL: `postgres://${dbName}:${localPassword}@localhost:${dbPort}/${dbName}`,
      TEST_DATABASE_URL: `postgres://${dbName}:${localPassword}@localhost:${testDbPort}/${dbName}_test`,
      BETTER_AUTH_SECRET: secret(),
      CRON_SECRET: secret(),
      EMAIL_MODE: "preview",
      EMAIL_FROM: `no-reply@${domain}`,
    }),
    0o600,
  );
  write(
    "deploy/generated/.env",
    [
      `COMPOSE_PROJECT_NAME=${slug}-prod`,
      `APP_PROXY_ALIAS=${slug}-app`,
      `IMAGE_REPOSITORY=ghcr.io/${repository.toLowerCase()}`,
      `APP_ENV_FILE=${deployPath}/runtime.env`,
      `POSTGRES_DB=${dbName}`,
      `POSTGRES_USER=${dbName}`,
      `POSTGRES_PASSWORD=${prodPassword}`,
      "# Must equal CRON_SECRET in runtime.env.",
      `CRON_SECRET=${cronSecret}`,
    ].join("\n") + "\n",
    0o600,
  );
  write(
    "deploy/generated/runtime.env",
    withValues(defaults, {
      APP_URL: `https://${domain}`,
      DATABASE_URL: `postgres://${dbName}:${prodPassword}@db:5432/${dbName}`,
      BETTER_AUTH_SECRET: secret(),
      EMAIL_MODE: "send",
      EMAIL_FROM: `no-reply@${domain}`,
      CRON_SECRET: cronSecret,
      TEST_DATABASE_URL: "",
    }),
    0o600,
  );
  return { port, preserved };
}

if (resolve(process.argv[1] || "") === fileURLToPath(import.meta.url)) {
  try {
    const { port, preserved } = initialize(process.cwd());
    console.log(
      `Env files ready. The app will run at http://localhost:${port}`,
    );
    if (preserved.length) console.log(`Kept existing: ${preserved.join(", ")}`);
    console.log("Next: pnpm local:up && pnpm local:migrate");
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
