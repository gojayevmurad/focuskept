import { ImageResponse } from "next/og";
import { brand } from "@/src/config/brand";
import { AMBER, MARK_DOT, MARK_RING } from "@/src/components/logo";
import type { Locale } from "@/src/i18n/config";

export const OG_SIZE = { width: 1200, height: 630 };

// Satori cannot shape Arabic-script or Devanagari text, so those locales get a
// language-neutral card (logo + brand). Others load a Noto font from Google
// Fonts, subset to the exact text, at build time.
const SHAPING: readonly string[] = ["ar", "fa", "ur", "hi"];
const FAMILY: Partial<Record<Locale, string>> = {
  ja: "Noto Sans JP",
  ko: "Noto Sans KR",
  "zh-CN": "Noto Sans SC",
};

const cache = new Map<string, Promise<ArrayBuffer | null>>();
function loadFont(family: string, weight: number, text: string) {
  const key = `${family}:${weight}:${text}`;
  if (!cache.has(key))
    cache.set(
      key,
      (async () => {
        try {
          const css = await (
            await fetch(
              `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&text=${encodeURIComponent(text)}`,
              { signal: AbortSignal.timeout(8000) },
            )
          ).text();
          const url = css.match(
            /src: url\((.+?)\) format\('(opentype|truetype|woff)'\)/,
          )?.[1];
          if (!url) return null;
          return await (
            await fetch(url, { signal: AbortSignal.timeout(8000) })
          ).arrayBuffer();
        } catch {
          return null;
        }
      })(),
    );
  return cache.get(key)!;
}

function Mark() {
  return (
    <svg width={72} height={72} viewBox="0 0 48 48" fill="none">
      <path
        d={MARK_RING}
        stroke="#E9ECEA"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <circle {...MARK_DOT} fill={AMBER} />
    </svg>
  );
}

export async function ogImage({
  locale,
  title,
  subtitle,
}: {
  locale: Locale;
  title: string;
  subtitle: string;
}) {
  const family = FAMILY[locale] ?? "Noto Sans";
  const text = `${brand.name}${title}${subtitle}`;
  const [bold, regular] = SHAPING.includes(locale)
    ? [null, null]
    : await Promise.all([
        loadFont(family, 700, text),
        loadFont(family, 400, text),
      ]);
  const localized = Boolean(bold && regular);
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "#0E1110",
        padding: 72,
        fontFamily: localized ? "Brand" : undefined,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <Mark />
        <span style={{ fontSize: 40, fontWeight: 700, color: "#E9ECEA" }}>
          {brand.name}
        </span>
      </div>
      {localized ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <span
            style={{
              fontSize: 68,
              fontWeight: 700,
              color: "#E9ECEA",
              lineHeight: 1.1,
            }}
          >
            {title}
          </span>
          <span style={{ fontSize: 32, color: "#9AA39E", lineHeight: 1.35 }}>
            {subtitle}
          </span>
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            height: 12,
            width: 240,
            borderRadius: 6,
            background: "#5FC3A8",
          }}
        />
      )}
      <span style={{ fontSize: 26, color: "#F2B33D" }}>focuskept.com</span>
    </div>,
    {
      ...OG_SIZE,
      fonts: localized
        ? [
            { name: "Brand", data: bold!, weight: 700, style: "normal" },
            { name: "Brand", data: regular!, weight: 400, style: "normal" },
          ]
        : undefined,
    },
  );
}
