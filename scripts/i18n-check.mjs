// SPDX-License-Identifier: AGPL-3.0-only
// Checks every messages/<locale>.json against en.json: same keys, same placeholders and tags.
import { readdirSync, readFileSync } from "node:fs";

const flatten = (obj, prefix = "") =>
  Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === "object"
      ? flatten(v, `${prefix}${k}.`)
      : [[`${prefix}${k}`, String(v)]],
  );
// Argument names and rich-text tags, found by walking the ICU structure so the
// text inside plural branches ({count, plural, one {...}}) is not mistaken for arguments.
function argumentsOf(message, found = new Set()) {
  let i = 0;
  while (i < message.length) {
    const ch = message[i];
    // ICU only treats an apostrophe as quoting before { } # or another apostrophe.
    if (ch === "'" && "{}#'".includes(message[i + 1] ?? "")) {
      const end = message.indexOf("'", i + 1);
      i = end === -1 ? message.length : end + 1;
      continue;
    }
    if (ch !== "{") {
      i++;
      continue;
    }
    // Find the matching close brace.
    let depth = 0;
    let j = i;
    for (; j < message.length; j++) {
      if (message[j] === "{") depth++;
      else if (message[j] === "}" && --depth === 0) break;
    }
    const body = message.slice(i + 1, j);
    const [name, type, ...rest] = body.split(",");
    found.add(name.trim());
    if (type && ["plural", "select", "selectordinal"].includes(type.trim())) {
      const branches = rest.join(",");
      for (const m of branches.matchAll(/\{/g)) {
        let d = 0;
        let k = m.index;
        for (; k < branches.length; k++) {
          if (branches[k] === "{") d++;
          else if (branches[k] === "}" && --d === 0) break;
        }
        if (
          m.index === branches.indexOf("{", m.index) &&
          isBranchStart(branches, m.index)
        )
          argumentsOf(branches.slice(m.index + 1, k), found);
      }
    }
    i = j + 1;
  }
  return found;
}
// A branch body starts right after its selector (one, other, =0, ...).
function isBranchStart(text, index) {
  let depth = 0;
  for (let k = 0; k < index; k++) {
    if (text[k] === "{") depth++;
    else if (text[k] === "}") depth--;
  }
  return depth === 0;
}
const tokens = (text) => {
  const tags = [...text.matchAll(/<\/?([a-z]+)>/g)].map((m) => m[0]);
  return [...new Set([...argumentsOf(text), ...tags])].sort().join(" ");
};

const base = new Map(
  flatten(JSON.parse(readFileSync("messages/en.json", "utf8"))),
);
let problems = 0;
for (const file of readdirSync("messages").filter(
  (f) => f.endsWith(".json") && f !== "en.json",
)) {
  const other = new Map(
    flatten(JSON.parse(readFileSync(`messages/${file}`, "utf8"))),
  );
  for (const [key, text] of base) {
    if (!other.has(key)) {
      console.error(`${file}: missing ${key}`);
      problems++;
    } else if (tokens(text) !== tokens(other.get(key))) {
      console.error(
        `${file}: placeholders differ in ${key}: "${other.get(key)}"`,
      );
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
