// SPDX-License-Identifier: AGPL-3.0-only
import { copyFile, readFile, writeFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve, dirname, relative, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(import.meta.url);
const nextRequire = createRequire(require.resolve("next/package.json"));
const sharp = nextRequire("sharp");
const tokens = JSON.parse(
  await readFile(join(root, "brand/tokens.json"), "utf8"),
);
const geometry = JSON.parse(
  await readFile(join(root, "brand/source/geometry.json"), "utf8"),
);
const p = tokens.palette;
const inventory = [];
const hash = (data) => createHash("sha256").update(data).digest("hex");
const esc = (s) =>
  String(s)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;");
const svg = (w, h, content, title = "FocusKept") =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><title>${esc(title)}</title>${content}</svg>\n`;
const rect = (x, y, w, h, fill, r = 0) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}"/>`;
const line = (x1, y1, x2, y2, stroke, width = 1) =>
  `<path d="M${x1} ${y1}L${x2} ${y2}" fill="none" stroke="${stroke}" stroke-width="${width}"/>`;

async function save(path, data, role, variant = "default", extra = {}) {
  const absolute = join(root, path);
  await mkdir(dirname(absolute), { recursive: true });
  await writeFile(absolute, data);
  const bytes = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const entry = {
    path,
    role,
    variant,
    bytes: bytes.length,
    sha256: hash(bytes),
    ...extra,
  };
  if (path.endsWith(".png")) {
    const meta = await sharp(bytes).metadata();
    Object.assign(entry, {
      format: "png",
      width: meta.width,
      height: meta.height,
    });
  } else entry.format = path.split(".").at(-1);
  inventory.push(entry);
}

function mark(x = 0, y = 0, size = 108, variant = "primary", micro = false) {
  const colors = {
    primary: [p.poolTeal, p.companionTeal],
    dark: [p.paleTeal, p.lightTeal],
    ink: [p.deepInk, p.deepInk],
    white: [p.white, p.white],
    teal: [p.poolTeal, p.poolTeal],
  }[variant];
  if (!colors) throw new Error(`Unknown mark variant: ${variant}`);
  const d = micro ? geometry.microLeft : geometry.left;
  return `<g transform="translate(${x} ${y}) scale(${size / 108})"><path d="${d}" fill="${colors[0]}"/><path d="${d}" transform="${geometry.rightTransform}" fill="${colors[1]}"/></g>`;
}

// HarfBuzz shapes the original licensed fonts; all artwork text is exported as paths.
// Font caches and external URLs are never consulted during generation.
const textCache = new Map();
function outlines(
  text,
  family = "Figtree",
  weight = 500,
  customWordmark = false,
) {
  const key = `${text}|${family}|${weight}|${customWordmark}`;
  if (textCache.has(key)) return textCache.get(key);
  const font = join(
    root,
    "brand/fonts",
    family === "Figtree" ? "Figtree-variable.ttf" : "BigShoulders-variable.ttf",
  );
  const variations =
    family === "Figtree" ? `wght=${weight}` : `wght=${weight},opsz=28`;
  const raw = execFileSync(
    "hb-vector",
    [
      font,
      text,
      `--variations=${variations}`,
      "--features=tnum",
      "--margin=0",
      "--ink",
      "--flat",
      "--precision=3",
      "--background=ffffff00",
    ],
    { encoding: "utf8", maxBuffer: 5_000_000 },
  );
  const bounds = raw
    .match(/viewBox="([^"]+)"/)[1]
    .split(/\s+/)
    .map(Number);
  let paths = [...raw.matchAll(/<path\b[^>]*\/>/g)].map((m) => m[0]);
  if (customWordmark)
    paths = paths.map(
      (path, i) =>
        `<g transform="translate(${geometry.wordmark.glyphOffsets[i] || 0} 0)">${path}</g>`,
    );
  const result = {
    bounds: [
      bounds[0],
      bounds[1],
      bounds[2] + (customWordmark ? -68 : 0),
      bounds[3],
    ],
    body: paths.join(""),
  };
  textCache.set(key, result);
  return result;
}

function text(
  label,
  x,
  y,
  size,
  fill = p.deepInk,
  family = "Figtree",
  weight = 500,
  maxWidth = Infinity,
) {
  const o = outlines(label, family, weight);
  // Baseline position: shaping uses Y-up glyph space and SVG handles it internally.
  const scale = Math.min(
    size / (family === "Figtree" ? 1000 : 2000),
    maxWidth / o.bounds[2],
  );
  return `<g fill="${fill}" transform="translate(${x - o.bounds[0] * scale} ${y}) scale(${scale})">${o.body}</g>`;
}

function wordmark(x, y, width, color) {
  const o = outlines("FocusKept", "Figtree", 750, true);
  const scale = width / o.bounds[2];
  return `<g fill="${color}" transform="translate(${x - o.bounds[0] * scale} ${y - o.bounds[1] * scale}) scale(${scale})">${o.body}</g>`;
}

function lockup(x, y, width, variant = "primary") {
  const color =
    variant === "white"
      ? p.white
      : variant === "dark"
        ? p.lightTeal
        : variant === "teal"
          ? p.poolTeal
          : p.deepInk;
  return `<g transform="translate(${x} ${y}) scale(${width / 500})">${mark(0, 0, 108, variant)}${wordmark(128, 28, 366, color)}</g>`;
}

function rope(x, y, width, dark = false) {
  return Array.from({ length: Math.ceil(width / 34) }, (_, i) =>
    rect(
      x + i * 34,
      y,
      Math.min(26, width - i * 34),
      6,
      dark
        ? i % 2
          ? p.paleTeal
          : p.companionTeal
        : i % 2
          ? p.companionTeal
          : p.poolTeal,
      2,
    ),
  ).join("");
}

function card(width, height, theme = "light", kind = "social") {
  const dark = theme === "dark";
  const bg = dark ? p.nightWater : p.mist;
  const ink = dark ? "#edf6fa" : p.deepInk;
  const muted = dark ? "#c0d2dc" : "#465e6b";
  const accent = dark ? p.paleTeal : p.poolTeal;
  const margin = Math.round(Math.min(width, height) * 0.09);
  const narrow = height > width * 1.25;
  const compact = height / width < 0.4;
  let b = rect(0, 0, width, height, bg);
  if (!compact)
    for (let x = 0; x < width; x += 120)
      b += line(x, 0, x, height, dark ? "#163443" : "#dce8ed");
  b += lockup(
    margin,
    margin,
    Math.min(width * 0.38, 440),
    dark ? "dark" : "primary",
  );
  if (compact) {
    b += text(
      "Quiet company. Focus kept.",
      margin,
      height * 0.7,
      height * 0.23,
      ink,
      "Big Shoulders",
      700,
      width - margin * 2,
    );
  } else {
    const start = height * (narrow ? 0.4 : 0.45);
    const fs = Math.min(width * 0.1, height * 0.18);
    b += text(
      "Quiet company.",
      margin,
      start,
      fs,
      ink,
      "Big Shoulders",
      700,
      width - margin * 2,
    );
    b += text(
      "Focus kept.",
      margin,
      start + fs * 1.12,
      fs,
      ink,
      "Big Shoulders",
      700,
      width - margin * 2,
    );
    const desc =
      kind === "github"
        ? "Open-source virtual coworking."
        : "Work beside someone.";
    b += text(
      desc,
      margin,
      start + fs * 1.12 + Math.min(70, height * 0.09),
      Math.min(34, width * 0.035),
      muted,
      "Figtree",
      500,
      width - margin * 2,
    );
    if (narrow) {
      b += rect(
        margin,
        height * 0.69,
        width - margin * 2,
        height * 0.15,
        dark ? "#123543" : "#e9f4f6",
        22,
      );
      b += text(
        "25 / 50 / 75",
        margin + 36,
        height * 0.78,
        width * 0.1,
        accent,
        "Big Shoulders",
        700,
      );
      b += text(
        "minutes, together",
        margin + 36,
        height * 0.82,
        width * 0.028,
        muted,
      );
    }
    b += text(
      "focuskept.com",
      margin,
      height - margin * 0.8,
      Math.min(28, width * 0.03),
      muted,
    );
  }
  b += rope(margin, height - 20, width - margin * 2, dark);
  return svg(width, height, b, `FocusKept ${kind} ${theme}`);
}

async function png(path, artwork, width, role, variant, extra = {}) {
  const data = await sharp(Buffer.from(artwork), { density: 144 })
    .resize({ width })
    .png({ compressionLevel: 9, palette: false })
    .toBuffer();
  await save(path, data, role, variant, extra);
}

// Allow an arbitrary clean raster export without rewriting the kit.
if (process.argv.includes("--export")) {
  const arg = (name) => process.argv[process.argv.indexOf(name) + 1];
  const size = Number(arg("--size"));
  const variant = process.argv.includes("--variant")
    ? arg("--variant")
    : "primary";
  const output = arg("--output");
  if (
    !Number.isInteger(size) ||
    size < 16 ||
    size > 8192 ||
    !output ||
    !["primary", "dark", "ink", "white", "teal"].includes(variant)
  )
    throw new Error(
      "Use --export --size 16..8192 --variant primary|dark|ink|white|teal --output relative/path.png",
    );
  const absolute = resolve(root, output);
  if (!absolute.startsWith(root + "/"))
    throw new Error("Export output must stay in this repository.");
  await mkdir(dirname(absolute), { recursive: true });
  await sharp(Buffer.from(svg(108, 108, mark(4, 0, 108, variant, size < 32))))
    .resize(size, size)
    .png()
    .toFile(absolute);
  console.log(
    `Exported ${size}px ${variant} symbol to ${relative(root, absolute)}`,
  );
  process.exit(0);
}

const variants = ["primary", "dark", "ink", "white", "teal"];
for (const variant of variants) {
  const wordColor =
    variant === "white"
      ? p.white
      : variant === "dark"
        ? p.lightTeal
        : variant === "teal"
          ? p.poolTeal
          : p.deepInk;
  const masterSymbol = svg(108, 108, mark(4, 0, 108, variant));
  const micro = svg(108, 108, mark(4, 0, 108, variant, true));
  const horizontal = svg(500, 112, lockup(0, 0, 500, variant));
  const word = svg(500, 100, wordmark(0, 0, 500, wordColor));
  const stacked = svg(
    500,
    300,
    mark(164, 5, 180, variant) + wordmark(0, 196, 500, wordColor),
  );
  for (const [name, art] of [
    ["symbol", masterSymbol],
    ["symbol-micro", micro],
    ["wordmark", word],
    ["horizontal", horizontal],
    ["stacked", stacked],
  ]) {
    await save(`brand/source/${name}-${variant}.svg`, art, name, variant);
    if (["symbol", "symbol-micro", "horizontal"].includes(name))
      await save(
        `public/brand/logo/${name}-${variant}.svg`,
        art,
        name,
        variant,
      );
    const sizes = name.startsWith("symbol")
      ? [64, 128, 256, 512, 1024]
      : [320, 640, 1280];
    for (const size of sizes)
      await png(
        `brand/exports/logo/${name}-${variant}-${size}.png`,
        art,
        size,
        name,
        variant,
      );
  }
}

// Small runtime email selection, served from the deployment's own origin.
for (const variant of ["primary", "white", "ink"]) {
  const art = await readFile(
    join(root, `brand/source/horizontal-${variant}.svg`),
    "utf8",
  );
  for (const size of [320, 480])
    await png(
      `public/brand/email/logo-${variant}-${size}.png`,
      art,
      size,
      "email-logo",
      variant,
    );
}
// Opaque email badge: the white lockup on deep ink. Images are not recolored by
// dark-mode mail clients, so this stays legible when a client inverts the
// header band around it. Shown at 160×48 CSS px.
await png(
  "public/brand/email/logo-badge-480.png",
  svg(480, 144, rect(0, 0, 480, 144, p.deepInk) + lockup(40, 27, 400, "white")),
  480,
  "email-logo",
  "badge",
);
for (const theme of ["light", "dark"]) {
  const art = card(1200, 320, theme, "email-header");
  await save(
    `brand/templates/email-header-${theme}.svg`,
    art,
    "email-header-template",
    theme,
  );
  await png(
    `public/brand/email/header-${theme}.png`,
    art,
    1200,
    "email-header",
    theme,
  );
}

const iconArt = (maskable = false) =>
  svg(
    512,
    512,
    rect(0, 0, 512, 512, p.deepInk) +
      mark(
        maskable ? 112 : 88,
        maskable ? 102 : 76,
        maskable ? 300 : 352,
        "white",
        true,
      ),
  );
for (const kind of ["any", "maskable"]) {
  const art = iconArt(kind === "maskable");
  await save(`brand/source/app-icon-${kind}.svg`, art, "app-icon-master", kind);
  for (const size of [192, 512])
    await png(
      `public/brand/icons/icon-${kind}-${size}.png`,
      art,
      size,
      "pwa-icon",
      kind,
      { purpose: kind },
    );
}
await png(
  "brand/exports/icons/avatar-1024.png",
  iconArt(),
  1024,
  "avatar",
  "dark",
);
await png(
  "public/brand/icons/apple-touch-icon.png",
  iconArt(),
  180,
  "apple-icon",
  "dark",
  { targetPath: "public/apple-touch-icon.png" },
);
await png(
  "public/brand/icons/notification-192.png",
  iconArt(),
  192,
  "notification-icon",
  "dark",
);
const favicon = svg(
  108,
  108,
  `<style>@media(prefers-color-scheme:dark){.mark{fill:${p.paleTeal}}}</style><g class="mark" fill="${p.poolTeal}" transform="translate(4 0)"><path d="${geometry.microLeft}"/><path d="${geometry.microLeft}" transform="${geometry.rightTransform}"/></g>`,
);
await save("public/brand/icons/favicon.svg", favicon, "favicon", "adaptive", {
  targetPath: "public/icon.svg",
});
const icoParts = [];
for (const size of [16, 32, 48])
  icoParts.push(
    await sharp(Buffer.from(svg(108, 108, mark(4, 0, 108, "teal", true))))
      .resize(size, size)
      .png()
      .toBuffer(),
  );
const icoHeader = Buffer.alloc(6 + icoParts.length * 16);
icoHeader.writeUInt16LE(1, 2);
icoHeader.writeUInt16LE(icoParts.length, 4);
let offset = icoHeader.length;
for (let i = 0; i < icoParts.length; i++) {
  const n = 6 + i * 16;
  icoHeader[n] = [16, 32, 48][i];
  icoHeader[n + 1] = icoHeader[n];
  icoHeader.writeUInt16LE(1, n + 4);
  icoHeader.writeUInt16LE(32, n + 6);
  icoHeader.writeUInt32LE(icoParts[i].length, n + 8);
  icoHeader.writeUInt32LE(offset, n + 12);
  offset += icoParts[i].length;
}
await save(
  "public/brand/icons/favicon.ico",
  Buffer.concat([icoHeader, ...icoParts]),
  "favicon",
  "ico",
  { sizes: [16, 32, 48], targetPath: "public/favicon.ico" },
);

const patterns = svg(340, 108, rope(0, 46, 340));
await save("brand/source/lane-pattern.svg", patterns, "pattern");
const socialSpecs = [
  ["og", 1200, 630],
  ["github-preview", 1280, 640],
  ["square", 1080, 1080],
  ["portrait", 1080, 1350],
  ["story", 1080, 1920],
  ["landscape", 1200, 675],
  ["cover-linkedin", 1584, 396],
  ["cover-x", 1500, 500],
  ["readme-banner", 1600, 480],
];
for (const [name, w, h] of socialSpecs)
  for (const theme of ["light", "dark"]) {
    const art = card(w, h, theme, name.startsWith("github") ? "github" : name);
    await save(
      `brand/templates/${name}-${theme}.svg`,
      art,
      "social-template",
      `${name}-${theme}`,
    );
    const dir = name === "readme-banner" ? "repository" : "social";
    await png(`brand/exports/${dir}/${name}-${theme}.png`, art, w, name, theme);
  }

// Browser-safe outputs for the later agent; no live source configuration is overwritten.
let css =
  "/* SPDX-License-Identifier: AGPL-3.0-only */\n/* Generated from brand/tokens.json. Review integration mapping before use. */\n";
for (const [theme, values] of Object.entries(tokens.themes))
  css += `${theme === "light" ? ":root" : '[data-theme="dark"]'} {\n${Object.entries(
    values,
  )
    .map(
      ([k, v]) =>
        `  --brand-${k.replace(/[A-Z]/g, (s) => "-" + s.toLowerCase())}: ${v};`,
    )
    .join("\n")}\n}\n`;
await save("brand/exports/code/tokens.css", css, "tokens", "css");
await save(
  "brand/exports/code/tokens.json",
  JSON.stringify(tokens, null, 2) + "\n",
  "tokens",
  "json",
);
await save(
  "brand/exports/code/logo-geometry.json",
  JSON.stringify(geometry, null, 2) + "\n",
  "geometry",
  "json",
);
for (const [name, source, axes] of [
  ["Figtree-Regular.ttf", "Figtree-variable.ttf", "wght=400"],
  ["Figtree-Medium.ttf", "Figtree-variable.ttf", "wght=500"],
  ["Figtree-Semibold.ttf", "Figtree-variable.ttf", "wght=600"],
  ["BigShoulders-Bold.ttf", "BigShoulders-variable.ttf", "wght=700,opsz=28"],
]) {
  const out = join(root, "brand/exports/fonts", name);
  await mkdir(dirname(out), { recursive: true });
  execFileSync("hb-subset", [
    join(root, "brand/fonts", source),
    "--unicodes=*",
    `--variations=${axes}`,
    `--output-file=${out}`,
  ]);
  await save(relative(root, out), await readFile(out), "static-font", axes);
}
for (const name of ["Figtree-OFL.txt", "BigShoulders-OFL.txt"])
  await save(
    `brand/exports/fonts/${name}`,
    await readFile(join(root, "brand/fonts", name)),
    "font-license",
  );

// Production contact sheet. Everything below uses the same exported geometry.
function preview() {
  const W = 1800,
    H = 1380;
  let b = rect(0, 0, W, H, p.mist);
  b += text("FocusKept", 64, 82, 46, p.deepInk, "Figtree", 750);
  b += text("Side by Side / Identity v1.0", 1100, 78, 24, "#465e6b");
  b += line(64, 112, 1736, 112, "#d3e0e6");
  b += lockup(90, 166, 840);
  b += text(
    "Quiet company. Focus kept.",
    90,
    426,
    57,
    p.deepInk,
    "Big Shoulders",
    700,
  );
  b += text(
    "Two independent paths. One shared rhythm.",
    90,
    479,
    24,
    "#465e6b",
  );
  b += rect(1080, 152, 656, 360, p.deepInk, 24);
  b += lockup(1130, 218, 545, "white");
  b += text("One color. Every background.", 1130, 443, 26, "#c0d2dc");
  b += line(64, 558, 1736, 558, "#d3e0e6");
  b += text("Logo system", 64, 610, 24, p.deepInk, "Figtree", 650);
  for (const [i, variant] of ["primary", "ink", "white"].entries()) {
    const x = 64 + i * 220;
    b += rect(x, 644, 196, 160, variant === "white" ? p.deepInk : p.white, 16);
    b += mark(x + 48, 668, 112, variant);
  }
  b +=
    rect(758, 644, 160, 160, p.deepInk, 30) +
    mark(790, 670, 108, "white", true);
  b += text("App icon", 760, 841, 20, "#465e6b");
  b += text("Small sizes", 1028, 610, 24, p.deepInk, "Figtree", 650);
  for (const [i, size] of [16, 20, 24, 32, 48, 64].entries()) {
    const x = 1030 + i * 110;
    b += mark(x, 676, size, "teal", size < 32);
    b += text(String(size), x, 778, 18, "#465e6b");
  }
  b += line(64, 886, 1736, 886, "#d3e0e6");
  const colors = [
    ["Pool teal", p.poolTeal],
    ["Companion", p.companionTeal],
    ["Deep ink", p.deepInk],
    ["Pale teal", p.paleTeal],
    ["Mist", p.mist],
  ];
  for (const [i, [name, color]] of colors.entries()) {
    const x = 64 + i * 132;
    b +=
      rect(x, 936, 112, 84, color, 12) +
      text(name, x, 1050, 17, p.deepInk) +
      text(color.toUpperCase(), x, 1080, 16, "#465e6b");
  }
  b += text("Figtree", 64, 1180, 42, p.deepInk, "Figtree", 700);
  b += text("Big Shoulders", 330, 1180, 48, p.deepInk, "Big Shoulders", 700);
  b += text("25 / 50 / 75     09:58", 64, 1252, 48, p.poolTeal, "Figtree", 600);
  b += `<svg x="810" y="936" width="444" height="234" viewBox="0 0 1200 630">${card(
    1200,
    630,
    "light",
  )
    .replace(/^<svg[^>]*>/, "")
    .replace(/<\/svg>\s*$/, "")}</svg>`;
  b += `<svg x="1290" y="936" width="444" height="234" viewBox="0 0 1200 630">${card(
    1200,
    630,
    "dark",
  )
    .replace(/^<svg[^>]*>/, "")
    .replace(/<\/svg>\s*$/, "")}</svg>`;
  b += text("Light / dark social assets", 810, 1238, 22, "#465e6b");
  b += text(
    "Scalable SVG masters / Transparent PNG / App and email assets",
    64,
    1340,
    20,
    "#465e6b",
  );
  return svg(W, H, b, "FocusKept Side by Side production identity preview");
}
const sheet = preview();
await save("brand/exports/preview.svg", sheet, "preview");
await png("brand/exports/preview.png", sheet, 1800, "preview");

// Multi-page guideline source: A4 composition, all lettering outlined for portability.
function page(n, heading, intro) {
  let b = rect(0, 0, 840, 1188, p.mist) + lockup(56, 42, 260);
  b += text(String(n).padStart(2, "0"), 736, 88, 20, "#465e6b");
  b += line(56, 132, 784, 132, "#d3e0e6");
  b += text(heading, 56, 228, 60, p.deepInk, "Big Shoulders", 700, 728);
  b += text(intro, 56, 280, 20, "#465e6b", "Figtree", 500, 728);
  b += text("FocusKept / Side by Side / 1.0.0", 56, 1144, 16, "#465e6b");
  return b;
}
const pages = [];
let b = page(
  1,
  "Quiet company. Focus kept.",
  "Virtual coworking / Body doubling / Open source",
);
b +=
  lockup(70, 400, 700) +
  rect(56, 646, 728, 310, p.deepInk, 20) +
  lockup(90, 730, 650, "white");
b += text("Two independent paths. One shared rhythm.", 56, 1050, 24, p.deepInk);
pages.push(b);
b = page(
  2,
  "A logo that travels.",
  "Use the master artwork. Keep its shapes and proportions intact.",
);
b +=
  mark(84, 360, 260) +
  rect(460, 350, 300, 300, p.deepInk, 20) +
  mark(478, 370, 270, "white");
b += text("Clearspace: one fifth of symbol height.", 56, 730, 24, p.deepInk);
b += text(
  "Symbol: 16px minimum. Micro cut below 32px.",
  56,
  782,
  24,
  p.deepInk,
);
b += text("Horizontal logo: 144px minimum width.", 56, 834, 24, p.deepInk);
b += text(
  "Do not stretch, rotate, add effects, or close the central gap.",
  56,
  924,
  22,
  "#465e6b",
  "Figtree",
  500,
  728,
);
b += text(
  "Use a white or dark one-color mark on complex backgrounds.",
  56,
  970,
  22,
  "#465e6b",
  "Figtree",
  500,
  728,
);
pages.push(b);
b = page(
  3,
  "Color with a purpose.",
  "Teal identifies. Deep water grounds. Timing accents stay small.",
);
for (const [i, [name, color]] of [
  ["Pool teal", p.poolTeal],
  ["Companion teal", p.companionTeal],
  ["Deep ink", p.deepInk],
  ["Pale teal", p.paleTeal],
  ["Mist", p.mist],
].entries()) {
  const y = 350 + i * 122;
  b +=
    rect(56, y, 130, 86, color, 12) +
    text(name, 218, y + 32, 24, p.deepInk, "Figtree", 650) +
    text(color.toUpperCase(), 218, y + 66, 22, "#465e6b");
}
b += text(
  "Text contrast: 4.5:1 normal / 3:1 qualifying large text.",
  56,
  1035,
  21,
  p.deepInk,
);
pages.push(b);
b = page(
  4,
  "Type sets the pace.",
  "Figtree for reading and timers. Big Shoulders for display.",
);
b += text("Quiet company.", 56, 440, 90, p.deepInk, "Big Shoulders", 700);
b += text("Focus kept.", 56, 544, 90, p.deepInk, "Big Shoulders", 700);
b += text("25 / 50 / 75", 56, 700, 86, p.poolTeal, "Big Shoulders", 700);
b += text("09:58   11:11   50:00", 56, 800, 64, p.deepInk, "Figtree", 600);
b += text(
  "Book a session. Share a goal. Work beside someone.",
  56,
  926,
  26,
  p.deepInk,
  "Figtree",
  500,
  728,
);
b += text(
  "Use tabular numerals for timers. Keep UI language plain.",
  56,
  990,
  22,
  "#465e6b",
  "Figtree",
  500,
  728,
);
pages.push(b);
b = page(
  5,
  "One identity, many places.",
  "Recompose each crop. Never stretch one design into a new ratio.",
);
for (const [i, theme] of ["light", "dark"].entries())
  b += `<svg x="56" y="${340 + i * 330}" width="728" height="300" viewBox="0 0 1200 630">${card(
    1200,
    630,
    theme,
  )
    .replace(/^<svg[^>]*>/, "")
    .replace(/<\/svg>\s*$/, "")}</svg>`;
b += text(
  "No fake testimonials, user counts, or guarantees in launch assets.",
  56,
  1050,
  21,
  "#465e6b",
  "Figtree",
  500,
  728,
);
pages.push(b);
b = page(
  6,
  "An open foundation.",
  "Source masters, reproducible exports, and a clear agent handoff.",
);
for (const [i, label] of [
  "brand/source/ - editable vector geometry",
  "brand/tokens.json - semantic design values",
  "brand/templates/ - outlined editable compositions",
  "brand/exports/ - social, logo, font, and PDF files",
  "public/brand/ - staged runtime assets",
  "docs/brand/ - rules, evidence, and integration prompt",
].entries())
  b += text(label, 56, 388 + i * 66, 24, p.deepInk, "Figtree", 500, 728);
b += text(
  "Original artwork follows the repository license.",
  56,
  884,
  23,
  p.deepInk,
);
b += text(
  "Font files retain their SIL Open Font License notices.",
  56,
  932,
  23,
  p.deepInk,
);
b += text(
  "Direction A selected by the owner; production artwork prepared for review.",
  56,
  1010,
  21,
  "#465e6b",
  "Figtree",
  500,
  728,
);
pages.push(b);
for (const [i, body] of pages.entries())
  await save(
    `brand/templates/guidelines-${i + 1}.svg`,
    svg(840, 1188, body, `FocusKept guidelines page ${i + 1}`),
    "guideline-page",
  );

// PDF conversion consumes only our restricted path-based SVG vocabulary.
execFileSync("python3", [
  join(root, "scripts/brand/svg-to-pdf.py"),
  "--output",
  join(root, "brand/exports/FocusKept-guidelines.pdf"),
  ...pages.map((_, i) => join(root, `brand/templates/guidelines-${i + 1}.svg`)),
]);
await save(
  "brand/exports/FocusKept-guidelines.pdf",
  await readFile(join(root, "brand/exports/FocusKept-guidelines.pdf")),
  "guidelines",
  "pdf",
);
for (const name of ["symbol", "horizontal", "stacked", "wordmark"])
  for (const variant of ["primary", "ink", "white"]) {
    const out = join(root, `brand/exports/logo/${name}-${variant}.pdf`);
    execFileSync("python3", [
      join(root, "scripts/brand/svg-to-pdf.py"),
      "--output",
      out,
      join(root, `brand/source/${name}-${variant}.svg`),
    ]);
    await save(relative(root, out), await readFile(out), name, variant);
  }

const sourcePaths = [
  "brand/source/geometry.json",
  "brand/tokens.json",
  "brand/fonts/Figtree-variable.ttf",
  "brand/fonts/BigShoulders-variable.ttf",
  "brand/fonts/Figtree-OFL.txt",
  "brand/fonts/BigShoulders-OFL.txt",
  "scripts/brand/generate.mjs",
  "scripts/brand/check.mjs",
  "scripts/brand/svg-to-pdf.py",
];
const sources = [];
for (const path of sourcePaths)
  sources.push({ path, sha256: hash(await readFile(join(root, path))) });
let previous;
try {
  previous = JSON.parse(
    await readFile(join(root, "brand/manifest.json"), "utf8"),
  );
} catch {
  // First generation has no approval record to preserve.
}
const preserveApproval =
  previous?.status === "approved" &&
  previous.selection?.finalArtworkApproval &&
  sources.every((source) =>
    previous.sources?.some(
      (old) => old.path === source.path && old.sha256 === source.sha256,
    ),
  );
const manifest = {
  schemaVersion: 1,
  version: tokens.version,
  status: preserveApproval ? "approved" : "draft",
  direction: "A / Side by Side",
  selection: {
    status: "selected",
    ownerMessage: "a",
    context: "Owner selected A from the three identity exploration board.",
    date: "2026-11-23",
    scope: "direction",
    finalArtworkApproval: preserveApproval
      ? previous.selection.finalArtworkApproval
      : null,
  },
  // Integration describes the app wiring, not the artwork, so it survives regeneration.
  integrationStatus: previous?.integrationStatus ?? "not-integrated",
  sources,
  license: {
    originalArtwork: "AGPL-3.0-only",
    fonts: "OFL-1.1",
    trademarkPolicy: "No additional policy imposed; no clearance claim.",
  },
  tooling: {
    node: process.versions.node,
    sharp: sharp.versions.sharp,
    libvips: sharp.versions.vips,
    harfbuzz: execFileSync("hb-vector", ["--version"], { encoding: "utf8" })
      .trim()
      .split("\n")[0],
    generator: "pnpm brand:generate",
    networkRequired: false,
  },
  fonts: [
    {
      family: "Figtree",
      upstreamBlob: "579e2ab5f30beb21cd0b618dd0796b0fce0eff8e",
      source:
        "https://github.com/google/fonts/blob/main/ofl/figtree/Figtree%5Bwght%5D.ttf",
      notice: "brand/fonts/Figtree-OFL.txt",
    },
    {
      family: "Big Shoulders",
      upstreamBlob: "e26f6dd3335e84ed94227519d08256d526c01124",
      source:
        "https://github.com/google/fonts/blob/main/ofl/bigshoulders/BigShoulders%5Bopsz%2Cwght%5D.ttf",
      notice: "brand/fonts/BigShoulders-OFL.txt",
    },
  ],
  exports: inventory.sort((a, b) => a.path.localeCompare(b.path)),
};
await mkdir(join(root, "brand"), { recursive: true });
await writeFile(
  join(root, "brand/manifest.json"),
  JSON.stringify(manifest, null, 2) + "\n",
);
// After integration the app serves a few kit files from conventional root URLs.
if (manifest.integrationStatus === "integrated")
  for (const asset of inventory.filter((e) => e.targetPath))
    await copyFile(join(root, asset.path), join(root, asset.targetPath));
console.log(
  `Generated ${inventory.length} inventoried files. Artwork: ${manifest.status}; application: ${manifest.integrationStatus}.`,
);
