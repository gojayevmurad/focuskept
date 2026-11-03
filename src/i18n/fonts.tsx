import {
  Geist_Mono,
  Onest,
  Noto_Sans,
  Noto_Sans_Arabic,
  Noto_Sans_Devanagari,
} from "next/font/google";
import Script from "next/script";
import { localeInfo, type Locale, type ScriptFont } from "./config";

// next/font loaders must be module-scope const assignments.
// `subsets` only selects what is preloaded; the stylesheet still covers
// Latin Extended and Cyrillic through unicode-range.
const onest = Onest({
  subsets: ["latin"],
  variable: "--font-ui",
  display: "swap",
});
const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
  preload: false,
});

// Script fonts are never preloaded and only the active locale's class is
// applied, so a font file is only downloaded by locales that render it.
const greek = Noto_Sans({
  subsets: ["greek", "greek-ext"],
  variable: "--font-script",
  display: "swap",
  preload: false,
});
const arabic = Noto_Sans_Arabic({
  subsets: ["arabic"],
  variable: "--font-script",
  display: "swap",
  preload: false,
});
// Onest has no Vietnamese glyphs; vi renders entirely in Noto Sans so
// diacritics never fall back mid-word (see globals.css html:lang(vi)).
const vietnamese = Noto_Sans({
  subsets: ["vietnamese"],
  variable: "--font-script",
  display: "swap",
  preload: false,
});
const devanagari = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  variable: "--font-script",
  display: "swap",
  preload: false,
});

type CjkFont = "jp" | "kr" | "sc";
const script: Record<Exclude<ScriptFont, CjkFont>, { variable: string }> = {
  greek,
  arabic,
  devanagari,
  vietnamese,
};

// Noto Sans JP/KR/SC are self-hosted from public/fonts (scripts/fonts.mjs):
// their @font-face CSS is ~30 KB gzipped each, and next/font would ship it
// render-blocking to every locale. Only the matching locale links it.
const cjk: Record<CjkFont, { href: string; family: string }> = {
  jp: {
    href: "/fonts/noto-sans-jp/index.css",
    family: "Noto Sans JP Variable",
  },
  kr: {
    href: "/fonts/noto-sans-kr/index.css",
    family: "Noto Sans KR Variable",
  },
  sc: {
    href: "/fonts/noto-sans-sc/index.css",
    family: "Noto Sans SC Variable",
  },
};
const isCjk = (font?: ScriptFont): font is CjkFont =>
  font === "jp" || font === "kr" || font === "sc";

export function fontClassName(locale: Locale) {
  const scriptFont = localeInfo[locale].script;
  return [
    onest.variable,
    geistMono.variable,
    scriptFont && !isCjk(scriptFont) ? script[scriptFont].variable : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * CJK pages need dozens of font slices (hundreds of KB), so the Noto
 * stylesheet is attached after the page has loaded: text paints at once in
 * the system CJK font and Noto swaps in afterwards (Latin stays on Onest, so
 * only full-width glyphs change). Without JavaScript the noscript link applies.
 */
export function CjkFont({ locale }: { locale: Locale }) {
  const scriptFont = localeInfo[locale].script;
  if (!isCjk(scriptFont)) return null;
  const { href, family } = cjk[scriptFont];
  const load = `(function(){function a(){var l=document.createElement("link");l.rel="stylesheet";l.href=${JSON.stringify(href)};document.head.appendChild(l)}document.readyState==="complete"?a():addEventListener("load",a)})()`;
  return (
    <>
      <style>{`:root{--font-script:"${family}"}`}</style>
      <Script id="cjk-font" strategy="afterInteractive">
        {load}
      </Script>
      <noscript>
        <link rel="stylesheet" href={href} />
      </noscript>
    </>
  );
}
