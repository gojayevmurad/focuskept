// SPDX-License-Identifier: AGPL-3.0-only
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const header = "// SPDX-License-Identifier: AGPL-3.0-only";
const extensions = new Set([".ts", ".tsx", ".mjs", ".js"]);
const directories = ["app", "src", "worker", "scripts", "tests"];
const configs = [
  "next.config.ts",
  "drizzle.config.ts",
  "playwright.config.ts",
  "vitest.config.ts",
  "eslint.config.mjs",
  "proxy.ts",
  "instrumentation.ts",
  "instrumentation-client.ts",
];
const args = process.argv.slice(2);
if (args.some((arg) => arg !== "--check")) {
  console.error("Usage: node scripts/spdx.mjs [--check]");
  process.exit(1);
}
const check = args.includes("--check");

function collect(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collect(path);
    return entry.isFile() && extensions.has(extname(path)) ? [path] : [];
  });
}

const files = [
  ...directories.flatMap((directory) => collect(join(root, directory))),
  ...configs.map((config) => join(root, config)).filter(existsSync),
].sort();
let missing = 0;
for (const file of files) {
  const source = readFileSync(file, "utf8");
  if (source.split(/\r?\n/, 1)[0] === header) continue;
  missing += 1;
  if (check) {
    console.error(relative(root, file));
  } else {
    const newline = source.includes("\r\n") ? "\r\n" : "\n";
    writeFileSync(file, `${header}${newline}${source}`);
  }
}

if (check && missing > 0) {
  console.error(`${missing} file(s) missing the SPDX header. Run pnpm spdx.`);
  process.exitCode = 1;
} else {
  console.log(
    check
      ? `SPDX headers present in all ${files.length} files.`
      : `Added SPDX headers to ${missing} file(s).`,
  );
}
