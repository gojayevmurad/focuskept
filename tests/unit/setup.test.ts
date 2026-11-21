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
// Native setup has no framework or database dependency.
import { initialize, validate } from "../../scripts/setup.mjs";
const options = {
  name: "My Product",
  slug: "my-product",
  domain: "app.example.com",
  repository: "owner/product",
  description: "Useful software",
  color: "#123456",
  port: 3100,
  dbPort: 23100,
  testDbPort: 43100,
};
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "saas-init-"));
  writeFileSync(join(root, "package.json"), "{}");
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
it("creates distinct per-product local and production identities, secrets and branding", () => {
  const a = fixture();
  const b = fixture();
  try {
    initialize(a, options);
    initialize(b, { ...options, slug: "other-product" });
    const local = env(a, ".env.local");
    const prod = env(a, "deploy/generated/.env");
    const runtime = env(a, "deploy/generated/runtime.env");
    expect(local.COMPOSE_PROJECT_NAME).toBe("my-product-dev");
    expect(prod.COMPOSE_PROJECT_NAME).toBe("my-product-prod");
    expect(prod.APP_PROXY_ALIAS).toBe("my-product-app");
    expect(prod.POSTGRES_PASSWORD).not.toBe(local.POSTGRES_PASSWORD);
    expect(prod.POSTGRES_PASSWORD).not.toBe(
      env(b, "deploy/generated/.env").POSTGRES_PASSWORD,
    );
    expect(runtime.DATABASE_URL).toContain(
      `:${prod.POSTGRES_PASSWORD}@db:5432/my_product`,
    );
    expect(runtime.BETTER_AUTH_SECRET).not.toBe(local.BETTER_AUTH_SECRET);
    expect(readFileSync(join(a, "src/config/brand.ts"), "utf8")).toContain(
      "My Product",
    );
    expect(statSync(join(a, "deploy/generated/runtime.env")).mode & 0o777).toBe(
      0o600,
    );
  } finally {
    rmSync(a, { recursive: true, force: true });
    rmSync(b, { recursive: true, force: true });
  }
});
it("reruns without rotating or overwriting secrets or service settings", () => {
  const root = fixture();
  try {
    initialize(root, options);
    const previous = readFileSync(
      join(root, "deploy/generated/runtime.env"),
      "utf8",
    );
    const local = readFileSync(join(root, ".env.local"), "utf8");
    const result = initialize(root, { ...options, name: "New name" });
    expect(result.preserved).toHaveLength(3);
    expect(
      readFileSync(join(root, "deploy/generated/runtime.env"), "utf8"),
    ).toBe(previous);
    expect(readFileSync(join(root, ".env.local"), "utf8")).toBe(local);
    expect(() => initialize(root, { ...options, slug: "other-slug" })).toThrow(
      "immutable",
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
it("refuses partial production credentials rather than generating a mismatched password", () => {
  const root = fixture();
  try {
    mkdirSync(join(root, "deploy/generated"), { recursive: true });
    writeFileSync(
      join(root, "deploy/generated/.env"),
      "POSTGRES_PASSWORD=preserved",
    );
    expect(() => initialize(root, options)).toThrow("Incomplete");
    expect(existsSync(join(root, "deploy/generated/runtime.env"))).toBe(false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
it.each([
  { slug: "../../escape" },
  { domain: "https://example.com/path" },
  { repository: "owner/repo;echo" },
  { color: "red;bad" },
  { port: 5432, dbPort: 5432 },
  { dbPort: 80 },
])("rejects unsafe configuration before writing %j", (change) => {
  expect(() => validate({ ...options, ...change })).toThrow();
});
