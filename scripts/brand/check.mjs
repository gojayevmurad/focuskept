// SPDX-License-Identifier: AGPL-3.0-only
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(import.meta.url);
const sharp = createRequire(require.resolve("next/package.json"))("sharp");
const manifest = JSON.parse(
  await readFile(join(root, "brand/manifest.json"), "utf8"),
);
const tokens = JSON.parse(
  await readFile(join(root, "brand/tokens.json"), "utf8"),
);
const sha = (data) => createHash("sha256").update(data).digest("hex");
const all = new Set();
for (const source of manifest.sources)
  assert.equal(
    sha(await readFile(join(root, source.path))),
    source.sha256,
    `Source changed: ${source.path}; regenerate the kit`,
  );
for (const asset of manifest.exports) {
  assert(!all.has(asset.path), `Duplicate inventory entry: ${asset.path}`);
  all.add(asset.path);
  assert(
    !asset.path.includes("..") && !asset.path.startsWith("/"),
    "Asset path must be repository-relative",
  );
  const data = await readFile(join(root, asset.path));
  assert.equal(data.length, asset.bytes, `Wrong byte count: ${asset.path}`);
  assert.equal(sha(data), asset.sha256, `Checksum changed: ${asset.path}`);
  if (asset.format === "png") {
    const meta = await sharp(data).metadata();
    assert.equal(meta.format, "png");
    assert.equal(meta.width, asset.width, `Wrong width: ${asset.path}`);
    assert.equal(meta.height, asset.height, `Wrong height: ${asset.path}`);
    if (asset.purpose === "maskable") {
      const { data: rgba, info } = await sharp(data)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      const bg = [16, 47, 67];
      for (let y = 0; y < info.height; y++)
        for (let x = 0; x < info.width; x++) {
          const n = (y * info.width + x) * 4;
          assert.equal(rgba[n + 3], 255, "Maskable icon must be opaque");
          if (bg.some((v, i) => Math.abs(v - rgba[n + i]) > 2))
            assert(
              Math.hypot(x + 0.5 - info.width / 2, y + 0.5 - info.height / 2) <=
                info.width * 0.4,
              `Critical maskable art outside safe circle: ${asset.path}`,
            );
        }
    }
  }
  if (asset.format === "svg") {
    const source = data.toString("utf8");
    assert(/viewBox="[^"]+"/.test(source), `No viewBox: ${asset.path}`);
    assert(
      !/<(?:script|image|foreignObject|text)\b/i.test(source),
      `SVG must be self-contained path artwork: ${asset.path}`,
    );
    assert(
      !/(?:href|url\()\s*[=:]?\s*["']?https?:/i.test(source),
      `Remote SVG dependency: ${asset.path}`,
    );
  }
  if (asset.format === "pdf")
    assert(
      data.subarray(0, 5).equals(Buffer.from("%PDF-")),
      `Invalid PDF signature: ${asset.path}`,
    );
}

async function files(path) {
  return (await readdir(join(root, path), { withFileTypes: true }))
    .flatMap((e) => (e.isDirectory() ? [] : [`${path}/${e.name}`]))
    .concat(
      ...(await Promise.all(
        (await readdir(join(root, path), { withFileTypes: true }))
          .filter((e) => e.isDirectory())
          .map((e) => files(`${path}/${e.name}`)),
      )),
    );
}
for (const folder of ["brand/exports", "brand/templates", "public/brand"])
  for (const path of await files(folder))
    assert(all.has(path), `Uninventoried export: ${path}`);
const svgs = [...all].filter((p) => p.endsWith(".svg"));
execFileSync("python3", [
  "-c",
  "import sys,xml.etree.ElementTree as E\nfor p in sys.argv[1:]: E.parse(p)",
  ...svgs.map((p) => join(root, p)),
]);

const ico = await readFile(join(root, "public/brand/icons/favicon.ico"));
assert.equal(ico.readUInt16LE(0), 0);
assert.equal(ico.readUInt16LE(2), 1);
assert.equal(ico.readUInt16LE(4), 3);
for (const [i, size] of [16, 32, 48].entries()) {
  const n = 6 + i * 16,
    bytes = ico.readUInt32LE(n + 8),
    offset = ico.readUInt32LE(n + 12);
  assert.equal(ico[n], size);
  const meta = await sharp(ico.subarray(offset, offset + bytes)).metadata();
  assert.equal(meta.width, size);
  assert.equal(meta.height, size);
}

const luminance = (hex) => {
  const v = hex
    .slice(1)
    .match(/../g)
    .map((s) => parseInt(s, 16) / 255)
    .map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return v[0] * 0.2126 + v[1] * 0.7152 + v[2] * 0.0722;
};
const contrast = (a, b) => {
  const [lo, hi] = [luminance(a), luminance(b)].sort((a, b) => a - b);
  return (hi + 0.05) / (lo + 0.05);
};
const ratios = [];
for (const [theme, v] of Object.entries(tokens.themes))
  for (const [fg, bg] of [
    ["text", "background"],
    ["muted", "surface"],
    ["subtle", "surface"],
    ["accentInk", "accent"],
    ["accentInk", "accentHover"],
  ]) {
    const ratio = contrast(v[fg], v[bg]);
    assert(
      ratio >= 4.5,
      `${theme} ${fg}/${bg}: ${ratio.toFixed(3)} is below 4.5`,
    );
    ratios.push(`${theme} ${fg}/${bg}: ${ratio.toFixed(3)}:1`);
  }
const companion = contrast(tokens.palette.companionTeal, tokens.palette.white);
assert(
  companion >= 3,
  "Companion logo shape should meet our voluntary 3:1 target on white",
);
for (const [font, family] of [
  ["Figtree-variable.ttf", "Figtree"],
  ["BigShoulders-variable.ttf", "Big Shoulders"],
]) {
  const glyphs = execFileSync(
    "hb-shape",
    [
      join(root, "brand/fonts", font),
      // Codepoints keep the check independent of the shell's locale charset.
      `--unicodes=${[..."FocusKept 0123456789 ÄÖÜß éèê ç ñ ¿¡"]
        .map((c) => c.codePointAt(0).toString(16))
        .join(",")}`,
    ],
    { encoding: "utf8" },
  );
  assert(
    !glyphs.includes(".notdef") && !/\bgid0\b/.test(glyphs),
    `Missing basic locale glyphs in ${family}`,
  );
}
const gh = manifest.exports.find(
  (e) => e.path === "brand/exports/social/github-preview-light.png",
);
const digits = JSON.parse(
  execFileSync(
    "hb-shape",
    [
      join(root, "brand/fonts/Figtree-variable.ttf"),
      "0123456789",
      "--features=tnum",
      "--output-format=json",
    ],
    { encoding: "utf8" },
  ),
);
assert.equal(
  tokens.type.timer.family,
  "Figtree",
  "Timer font must use the verified tabular family",
);
assert.equal(
  new Set(digits.map((glyph) => glyph.ax)).size,
  1,
  "Timer digits must have equal advance widths with tnum enabled",
);
assert(gh.bytes < 1_000_000, "GitHub social preview must stay below 1MB");
// Once integrated, the conventional root URLs must serve the kit files unchanged.
const targets = manifest.exports.filter((e) => e.targetPath);
if (manifest.integrationStatus === "integrated")
  for (const asset of targets)
    assert.equal(
      sha(await readFile(join(root, asset.targetPath))),
      asset.sha256,
      `Integrated copy differs from the kit: ${asset.targetPath}; run pnpm brand:generate`,
    );
console.log(
  `Verified ${manifest.exports.length} files: hashes, actual PNG sizes, SVG XML, ICO frames, PDF signatures, maskable safe zone, basic locale glyphs, and selected contrast pairs.`,
);
console.log(ratios.join("\n"));
console.log(`Companion mark / white: ${companion.toFixed(3)}:1`);
console.log(
  `Selection: ${manifest.selection.status}; final artwork status: ${manifest.status}; application: ${manifest.integrationStatus}${manifest.integrationStatus === "integrated" ? ` (${targets.length} root copies match)` : ""}.`,
);
