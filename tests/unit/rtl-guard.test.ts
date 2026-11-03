import { it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// Layout must use logical properties so RTL locales mirror automatically.
function files(dir: string, ext: RegExp, out: string[] = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) files(path, ext, out);
    else if (ext.test(name)) out.push(path);
  }
  return out;
}
const sources = [
  ...files("app", /\.(tsx|ts|css)$/),
  ...files("src", /\.(tsx|ts|css)$/),
].filter(
  // Emails render in mail clients without logical-property support.
  (f) => !f.startsWith(join("src", "emails")),
);
const physicalClass =
  /(?:^|[\s"'`{(])-?(?:ml|mr|pl|pr|left|right|border-l|border-r|rounded-l|rounded-r|rounded-tl|rounded-tr|rounded-bl|rounded-br|text-left|text-right|float-left|float-right|scroll-ml|scroll-mr)(?:-[\w./[\]%-]+)?(?=$|[\s"'`})])/;
const physicalCss = [
  /(?:^|[;{\s])(?:margin-left|margin-right|padding-left|padding-right|left|right|border-left[\w-]*|border-right[\w-]*)\s*:/,
  /(?:text-align|float)\s*:\s*(?:left|right)\b/,
];

it("uses only logical spacing/position utilities and CSS properties", () => {
  const violations: string[] = [];
  for (const file of sources) {
    readFileSync(file, "utf8")
      .split("\n")
      .forEach((line, i) => {
        if (line.includes("rtl-guard-ignore")) return;
        const css =
          file.endsWith(".css") && physicalCss.some((r) => r.test(line));
        const tw =
          /className|class=|cn\(|clsx\(/.test(line) && physicalClass.test(line);
        if (css || tw) violations.push(`${file}:${i + 1}: ${line.trim()}`);
      });
  }
  expect(violations).toEqual([]);
});
