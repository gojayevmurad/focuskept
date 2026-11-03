import { it, expect } from "vitest";
import {
  mkdtempSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  statSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initialize } from "../../scripts/setup.mjs";

const config = {
  slug: "my-product",
  domain: "app.example.com",
  repository: "owner/product",
  deployPath: "/srv/my-product",
  port: 3100,
  dbPort: 23100,
  testDbPort: 43100,
};
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "setup-"));
  writeFileSync(join(root, "saas.config.json"), JSON.stringify(config));
  writeFileSync(join(root, ".env.example"), readFileSync(".env.example"));
  return root;
}
const env = (root: string, path: string) =>
  Object.fromEntries(
    readFileSync(join(root, path), "utf8")
      .split("\n")
      .filter((l) => l && !l.startsWith("#"))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i), l.slice(i + 1)];
      }),
  );

it("creates separate local and production env files with random secrets", () => {
  const root = fixture();
  try {
    initialize(root);
    const local = env(root, ".env.local");
    const prod = env(root, "deploy/generated/.env");
    const runtime = env(root, "deploy/generated/runtime.env");
    expect(local.COMPOSE_PROJECT_NAME).toBe("my-product-dev");
    expect(local.APP_URL).toBe("http://localhost:3100");
    expect(prod.COMPOSE_PROJECT_NAME).toBe("my-product-prod");
    expect(prod.IMAGE_REPOSITORY).toBe("ghcr.io/owner/product");
    expect(prod.POSTGRES_PASSWORD).not.toBe(local.POSTGRES_PASSWORD);
    expect(runtime.DATABASE_URL).toContain(
      `:${prod.POSTGRES_PASSWORD}@db:5432/my_product`,
    );
    expect(runtime.CRON_SECRET).toBe(prod.CRON_SECRET);
    expect(runtime.BETTER_AUTH_SECRET).not.toBe(local.BETTER_AUTH_SECRET);
    expect(statSync(join(root, ".env.local")).mode & 0o777).toBe(0o600);
    expect(
      statSync(join(root, "deploy/generated/runtime.env")).mode & 0o777,
    ).toBe(0o600);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

it("keeps existing files on rerun and touches nothing else", () => {
  const root = fixture();
  try {
    initialize(root);
    const runtime = readFileSync(
      join(root, "deploy/generated/runtime.env"),
      "utf8",
    );
    const local = readFileSync(join(root, ".env.local"), "utf8");
    const before = readFileSync(join(root, "saas.config.json"), "utf8");
    const result = initialize(root);
    expect(result.preserved).toHaveLength(3);
    expect(
      readFileSync(join(root, "deploy/generated/runtime.env"), "utf8"),
    ).toBe(runtime);
    expect(readFileSync(join(root, ".env.local"), "utf8")).toBe(local);
    expect(readFileSync(join(root, "saas.config.json"), "utf8")).toBe(before);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

it("refuses partial production files instead of generating a mismatched password", () => {
  const root = fixture();
  try {
    mkdirSync(join(root, "deploy/generated"), { recursive: true });
    writeFileSync(join(root, "deploy/generated/.env"), "POSTGRES_PASSWORD=x");
    expect(() => initialize(root)).toThrow("Incomplete");
    expect(existsSync(join(root, "deploy/generated/runtime.env"))).toBe(false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
