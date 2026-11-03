// Copies the self-hosted Noto CJK fonts (Fontsource, OFL-1.1) into
// public/fonts so ja/ko/zh-CN pages can link their @font-face CSS on their
// own. next/font cannot scope CSS to a dynamic [locale] segment, so these
// three large fonts live outside it. Runs before build/dev.
import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const fonts = ["noto-sans-jp", "noto-sans-kr", "noto-sans-sc"];
const out = join(
  dirname(new URL(import.meta.url).pathname),
  "..",
  "public",
  "fonts",
);

for (const name of fonts) {
  const pkg = dirname(
    require.resolve(`@fontsource-variable/${name}/package.json`),
  );
  const target = join(out, name);
  mkdirSync(join(target, "files"), { recursive: true });
  copyFileSync(join(pkg, "index.css"), join(target, "index.css"));
  copyFileSync(join(pkg, "LICENSE"), join(target, "LICENSE"));
  for (const file of readdirSync(join(pkg, "files"))) {
    if (!file.endsWith(".woff2")) continue;
    const to = join(target, "files", file);
    if (!existsSync(to)) copyFileSync(join(pkg, "files", file), to);
  }
}
console.log(`fonts: ${fonts.join(", ")} → public/fonts`);
