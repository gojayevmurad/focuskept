// Deep-merges a JSON patch into messages/<locale>.json: node scripts/merge-messages.mjs en patch.json
import { readFileSync, writeFileSync, existsSync } from "node:fs";
const [locale, patchFile] = process.argv.slice(2);
const target = `messages/${locale}.json`;
const base = existsSync(target) ? JSON.parse(readFileSync(target, "utf8")) : {};
const patch = JSON.parse(readFileSync(patchFile, "utf8"));
const merge = (a, b) => {
  for (const [k, v] of Object.entries(b))
    a[k] = v && typeof v === "object" && !Array.isArray(v) ? merge(a[k] ?? {}, v) : v;
  return a;
};
writeFileSync(target, JSON.stringify(merge(base, patch), null, 2) + "\n");
