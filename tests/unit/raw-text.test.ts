import { it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

// Every user-facing string must come from messages/*.json. This scans JSX for
// raw text and for literal user-facing attributes.
const roots = [
  "app",
  join("src", "components"),
  join("src", "features"),
  join("src", "emails"),
];
const userFacingAttributes = new Set([
  "aria-label",
  "aria-description",
  "aria-placeholder",
  "aria-valuetext",
  "placeholder",
  "title",
  "alt",
  "label",
]);
const letters = /\p{L}/u;

function files(dir: string, out: string[] = []) {
  try {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) files(path, out);
      else if (name.endsWith(".tsx")) out.push(path);
    }
  } catch {}
  return out;
}

it("has no hard-coded user-facing text in JSX", () => {
  const violations: string[] = [];
  for (const file of roots.flatMap((r) => files(r))) {
    const text = readFileSync(file, "utf8");
    const source = ts.createSourceFile(
      file,
      text,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    const report = (node: ts.Node, value: string) => {
      const { line } = source.getLineAndCharacterOfPosition(node.getStart());
      violations.push(`${file}:${line + 1}: ${value.trim().slice(0, 60)}`);
    };
    const visit = (node: ts.Node) => {
      if (ts.isJsxText(node) && letters.test(node.text))
        report(node, node.text);
      if (
        ts.isJsxAttribute(node) &&
        userFacingAttributes.has(node.name.getText(source)) &&
        node.initializer &&
        ts.isStringLiteral(node.initializer) &&
        letters.test(node.initializer.text)
      )
        report(node, node.initializer.text);
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  expect(violations).toEqual([]);
});
