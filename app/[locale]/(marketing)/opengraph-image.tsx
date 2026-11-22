// SPDX-License-Identifier: AGPL-3.0-only
import { ImageResponse } from "next/og";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getAppConfig } from "@/src/config/app";
import { getLanesTranslations } from "@/src/components/marketing/cta";
import {
  requireMarketing,
  type LocaleProps,
} from "@/src/lib/content/marketing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Quiet company for focused work";

async function loadFont(family: string, weight: number, text: string) {
  const query = new URLSearchParams({
    family: `${family}:wght@${weight}`,
    text,
  });
  const response = await fetch(`https://fonts.googleapis.com/css2?${query}`, {
    next: { revalidate: 86400 },
  });
  if (!response.ok) throw new Error(`Font stylesheet: ${response.status}`);
  const css = await response.text();
  const url = css.match(/src:\s*url\(([^)]+)\)/)?.[1];
  if (!url) throw new Error(`Missing font source: ${family}`);
  const font = await fetch(url, { next: { revalidate: 86400 } });
  if (!font.ok) throw new Error(`Font file: ${font.status}`);
  return font.arrayBuffer();
}

export default async function Image({ params }: LocaleProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  requireMarketing();
  const [t, lanes] = await Promise.all([
    getTranslations("home"),
    getLanesTranslations(),
  ]);
  const name = getAppConfig().name;
  const heading = lanes("lanes.heading").toLocaleUpperCase(locale);
  const note = t("note");
  const [display, sans] = await Promise.all([
    loadFont("Big Shoulders", 700, heading),
    loadFont("Figtree", 500, `${name}${note}`),
  ]);

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: "#f4f9fa",
        backgroundImage:
          "linear-gradient(to right, #dfeaec 1px, transparent 1px), linear-gradient(to bottom, #dfeaec 1px, transparent 1px)",
        backgroundSize: "120px 120px",
        color: "#102e3b",
        display: "flex",
        flexDirection: "column",
        padding: "48px 64px",
        justifyContent: "space-between",
        fontFamily: "Figtree",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <span style={{ fontSize: 32, fontWeight: 500 }}>{name}</span>
      </div>
      <div
        style={{
          display: "flex",
          fontFamily: "Big Shoulders",
          fontWeight: 700,
          fontSize: 104,
          lineHeight: 0.98,
          letterSpacing: "-1px",
          maxWidth: 850,
          marginTop: 16,
          marginBottom: 16,
        }}
      >
        {heading}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        <div
          style={{
            display: "flex",
            width: "100%",
            height: 10,
            borderRadius: 5,
            overflow: "hidden",
          }}
        >
          {Array.from({ length: 40 }, (_, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                flex: 1,
                height: "100%",
                marginRight: 4,
                borderRadius: 3,
                backgroundColor: i % 2 === 0 ? "#c53e3e" : "#e5c54a",
              }}
            />
          ))}
        </div>
        <div style={{ display: "flex", fontSize: 24, color: "#425e69" }}>
          {note}
        </div>
      </div>
    </div>,
    {
      ...size,
      fonts: [
        { name: "Big Shoulders", data: display, weight: 700, style: "normal" },
        { name: "Figtree", data: sans, weight: 500, style: "normal" },
      ],
    },
  );
}
