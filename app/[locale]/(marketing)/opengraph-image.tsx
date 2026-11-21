// SPDX-License-Identifier: AGPL-3.0-only
import { ImageResponse } from "next/og";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getAppConfig } from "@/src/config/app";
import {
  requireMarketing,
  type LocaleProps,
} from "@/src/lib/content/marketing";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Quiet company for focused work";
export default async function Image({ params }: LocaleProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  requireMarketing();
  const t = await getTranslations("home");
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "#121614",
        color: "#ecefe9",
        display: "flex",
        flexDirection: "column",
        padding: 80,
        justifyContent: "space-between",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        <svg width="72" height="72" viewBox="0 0 32 32">
          <circle cx="12" cy="16" r="9" fill="#2F6F62" />
          <circle
            cx="20"
            cy="16"
            r="9"
            fill="none"
            stroke="#D9902F"
            strokeWidth="3"
          />
        </svg>
        <span style={{ fontSize: 42 }}>{getAppConfig().name}</span>
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 76,
          lineHeight: 1.08,
          maxWidth: 980,
        }}
      >
        {t("heading")}
      </div>
      <div style={{ display: "flex", fontSize: 28, color: "#d9bd91" }}>
        {t("note")}
      </div>
    </div>,
    size,
  );
}
