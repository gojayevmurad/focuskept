// SPDX-License-Identifier: AGPL-3.0-only
// Checks every messages/<locale>.json against en.json: same keys, same placeholders and tags.
import { readdirSync, readFileSync } from "node:fs";

const flatten = (obj, prefix = "") =>
  Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === "object" ? flatten(v, `${prefix}${k}.`) : [[`${prefix}${k}`, String(v)]],
  );
// Argument names ({name}, {count, plural, ...}) and rich-text tags (<link>), not the text inside branches.
const tokens = (text) => {
  const args = [...text.matchAll(/\{\s*([a-zA-Z_][\w]*)\s*[,}]/g)].map((m) => m[1]);
  const tags = [...text.matchAll(/<\/?([a-z]+)>/g)].map((m) => m[0]);
  return [...new Set([...args, ...tags])].sort().join(" ");
};

const base = new Map(flatten(JSON.parse(readFileSync("messages/en.json", "utf8"))));
let problems = 0;
for (const file of readdirSync("messages").filter((f) => f.endsWith(".json") && f !== "en.json")) {
  const other = new Map(flatten(JSON.parse(readFileSync(`messages/${file}`, "utf8"))));
  for (const [key, text] of base) {
    if (!other.has(key)) {
      console.error(`${file}: missing ${key}`);
      problems++;
    } else if (tokens(text) !== tokens(other.get(key))) {
      console.error(`${file}: placeholders differ in ${key}: "${other.get(key)}"`);
      problems++;
    }
  }
  for (const key of other.keys())
    if (!base.has(key)) {
      console.error(`${file}: extra ${key}`);
      problems++;
    }
}
if (problems) {
  console.error(`${problems} problem(s)`);
  process.exit(1);
}
console.log("Translations match en.json");
