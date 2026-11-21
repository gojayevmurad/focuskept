import { randomBytes, createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";

export function validate(options) {
  if (!/^[a-z][a-z0-9-]{1,39}$/.test(options.slug))
    throw new Error(
      "Slug: 2–40 lowercase letters, numbers and hyphens; start with a letter.",
    );
  if (!options.name?.trim() || /[\r\n\0]/.test(options.name))
    throw new Error("A project name is required.");
  if (
    !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(
      options.domain,
    )
  )
    throw new Error("Use a hostname only, e.g. app.example.com.");
  if (
    !/^[a-zA-Z0-9][a-zA-Z0-9-]*\/[a-zA-Z0-9_.-]+$/.test(options.repository) ||
    options.repository.endsWith("/..")
  )
    throw new Error("Repository must be owner/name.");
  if (!/^#[a-fA-F0-9]{6}$/.test(options.color))
    throw new Error("Brand color must be #RRGGBB.");
  const ports = [options.port, options.dbPort, options.testDbPort].map(Number);
  if (
    ports.some((p) => !Number.isInteger(p) || p < 1024 || p > 65535) ||
    new Set(ports).size !== 3
  )
    throw new Error("Choose three distinct ports between 1024 and 65535.");
  return { ...options, port: ports[0], dbPort: ports[1], testDbPort: ports[2] };
}
export function initialize(root, input) {
  const options = validate(input);
  const configPath = resolve(root, "saas.config.json");
  if (
    existsSync(configPath) &&
    JSON.parse(readFileSync(configPath, "utf8")).slug !== options.slug
  )
    throw new Error(
      "Existing project slug is immutable. Create a fresh template copy to initialize another SaaS.",
    );
  if (
    existsSync(resolve(root, "deploy/generated/.env")) !==
    existsSync(resolve(root, "deploy/generated/runtime.env"))
  )
    throw new Error(
      "Incomplete production bundle: restore the missing file from backup; credentials will not be regenerated.",
    );
  const dbName = options.slug.replaceAll("-", "_");
  const write = (path, content) => {
    mkdirSync(dirname(resolve(root, path)), { recursive: true });
    writeFileSync(resolve(root, path), content);
  };
  const preserved = [];
  const secretFile = (path, content) => {
    if (existsSync(resolve(root, path))) {
      preserved.push(path);
      return;
    }
    mkdirSync(dirname(resolve(root, path)), { recursive: true });
    writeFileSync(resolve(root, path), content, { mode: 0o600, flag: "wx" });
  };
  const password = randomBytes(32).toString("hex");
  const prodPassword = randomBytes(32).toString("hex");
  const deployPath = `/srv/saas/${options.slug}/deploy`;
  write(
    "saas.config.json",
    JSON.stringify({ ...options, deployPath }, null, 2) + "\n",
  );
  write(
    "src/config/brand.ts",
    `export const brand = {\n  name: ${JSON.stringify(options.name)},\n  description: ${JSON.stringify(options.description)},\n  supportEmail: ${JSON.stringify(`support@${options.domain}`)},\n};\n`,
  );
  write(
    "src/config/brand.css",
    `:root {\n  --accent: ${options.color};\n  --accent-hover: color-mix(in srgb, ${options.color}, black 12%);\n}\n[data-theme="dark"] {\n  --accent: color-mix(in srgb, ${options.color}, white 28%);\n  --accent-hover: color-mix(in srgb, ${options.color}, white 40%);\n}\n`,
  );
  const pkgPath = resolve(root, "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  pkg.name = options.slug;
  write("package.json", JSON.stringify(pkg, null, 2) + "\n");
  const defaults = readFileSync(resolve(root, ".env.example"), "utf8");
  const replace = (source, values) =>
    Object.entries(values).reduce((text, [key, value]) => {
      const line = `${key}=${value}`;
      const pattern = new RegExp(`^${key}=.*$`, "m");
      return pattern.test(text)
        ? text.replace(pattern, () => line)
        : text + "\n" + line + "\n";
    }, source);
  secretFile(
    ".env.local",
    replace(defaults, {
      APP_URL: `http://localhost:${options.port}`,
      APP_PORT: options.port,
      DB_PORT: options.dbPort,
      TEST_DB_PORT: options.testDbPort,
      COMPOSE_PROJECT_NAME: `${options.slug}-dev`,
      POSTGRES_DB: dbName,
      POSTGRES_USER: dbName,
      POSTGRES_PASSWORD: password,
      DATABASE_URL: `postgres://${dbName}:${password}@localhost:${options.dbPort}/${dbName}`,
      TEST_DATABASE_URL: `postgres://${dbName}:${password}@localhost:${options.testDbPort}/${dbName}_test`,
      BETTER_AUTH_SECRET: randomBytes(32).toString("hex"),
      EMAIL_MODE: "preview",
      EMAIL_FROM: `no-reply@${options.domain}`,
    }),
  );
  secretFile(
    "deploy/generated/.env",
    [
      `COMPOSE_PROJECT_NAME=${options.slug}-prod`,
      `APP_PROXY_ALIAS=${options.slug}-app`,
      `IMAGE_REPOSITORY=ghcr.io/${options.repository.toLowerCase()}`,
      `APP_ENV_FILE=${deployPath}/runtime.env`,
      `POSTGRES_DB=${dbName}`,
      `POSTGRES_USER=${dbName}`,
      `POSTGRES_PASSWORD=${prodPassword}`,
      "# First release: export APP_IMAGE=ghcr.io/owner/repo@sha256:... before compose commands.",
    ].join("\n") + "\n",
  );
  secretFile(
    "deploy/generated/runtime.env",
    replace(defaults, {
      APP_URL: `https://${options.domain}`,
      DATABASE_URL: `postgres://${dbName}:${prodPassword}@db:5432/${dbName}`,
      BETTER_AUTH_SECRET: randomBytes(32).toString("hex"),
      EMAIL_MODE: "send",
      EMAIL_FROM: `no-reply@${options.domain}`,
      TEST_DATABASE_URL: "",
    }),
  );
  write(
    "deploy/generated/Caddyfile.example",
    `${options.domain} {\n    reverse_proxy ${options.slug}-app:3000\n}\n`,
  );
  return { slug: options.slug, deployPath, preserved };
}
async function main() {
  const args = process.argv.slice(2);
  if (args[0] === "setup") args.shift();
  const flags = {};
  for (let i = 0; i < args.length; i += 2) {
    if (!args[i].startsWith("--") || !args[i + 1])
      throw new Error(
        "Use --name value --slug value --domain value --repository owner/repo [--color #RRGGBB]",
      );
    flags[args[i].slice(2)] = args[i + 1];
  }
  const previous = existsSync("saas.config.json")
    ? JSON.parse(readFileSync("saas.config.json", "utf8"))
    : {};
  const rl = process.stdin.isTTY
    ? createInterface({ input: process.stdin, output: process.stdout })
    : null;
  const ask = async (key, label, fallback) =>
    flags[key] ??
    (rl
      ? (
          await rl.question(`${label}${fallback ? ` [${fallback}]` : ""}: `)
        ).trim() || fallback
      : fallback);
  try {
    const name = await ask("name", "Project name", previous.name);
    const slug = await ask(
      "slug",
      "Unique project slug",
      previous.slug ||
        name
          ?.toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, ""),
    );
    const offset = slug
      ? createHash("sha256").update(slug).digest().readUInt16BE() % 10000
      : 0;
    const options = {
      name,
      slug,
      domain: await ask("domain", "Production domain", previous.domain),
      repository: await ask(
        "repository",
        "GitHub owner/repository",
        previous.repository,
      ),
      description: await ask(
        "description",
        "Description",
        previous.description || "A foundation for your next idea.",
      ),
      color: await ask("color", "Brand color", previous.color || "#7461d9"),
      port: Number(flags.port || previous.port || 3000 + offset),
      dbPort: Number(flags["db-port"] || previous.dbPort || 20000 + offset),
      testDbPort: Number(
        flags["test-db-port"] || previous.testDbPort || 40000 + offset,
      ),
    };
    const result = initialize(process.cwd(), options);
    console.log(
      `Initialized ${result.slug}. Local: http://localhost:${options.port}\nProduction directory: ${result.deployPath}\nNext: pnpm local:up && pnpm local:migrate\nGenerated production secrets: deploy/generated/ (gitignored; copy securely once).`,
    );
    if (result.preserved.length)
      console.log(
        `Preserved existing files (no secret rotation): ${result.preserved.join(", ")}. Review their non-secret values if changing domains or ports.`,
      );
  } finally {
    rl?.close();
  }
}
if (resolve(process.argv[1] || "") === fileURLToPath(import.meta.url))
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
