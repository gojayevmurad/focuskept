// SPDX-License-Identifier: AGPL-3.0-only
import { ImageResponse } from "next/og";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getAppConfig } from "@/src/config/app";
import { getLanesTranslations } from "@/src/components/marketing/cta";
import {
  requireMarketing,
  type LocaleProps,
} from "@/src/lib/content/marketing";
import {
  OgIdentity,
  OgRope,
  ogFonts,
  ogLaneGround,
  ogThemes,
} from "@/src/lib/brand/og";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Quiet company for focused work";

const PAD = 64;

export default async function Image({ params }: LocaleProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  requireMarketing();
  const [t, lanes, fonts] = await Promise.all([
    getTranslations("home"),
    getLanesTranslations(),
    ogFonts(),
  ]);
  const app = getAppConfig();
  const theme = ogThemes.light;
  const heading = lanes("lanes.heading");
  const host = new URL(app.url).host;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        ...ogLaneGround(theme),
        color: theme.text,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: `52px ${PAD}px 40px`,
        fontFamily: "Figtree",
      }}
    >
      <OgIdentity
        name={app.name}
        showMark={!app.logoUrl}
        theme={theme}
        size={72}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div
          style={{
            display: "flex",
            fontFamily: "Big Shoulders",
            fontWeight: 700,
            fontSize: 96,
            lineHeight: 1,
            letterSpacing: "-0.01em",
            maxWidth: 1000,
          }}
        >
          {heading}
        </div>
        <div style={{ display: "flex", fontSize: 30, color: theme.muted }}>
          {t("note")}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        <div style={{ display: "flex", fontSize: 26, color: theme.muted }}>
          {host}
        </div>
        <OgRope width={1200 - PAD * 2} theme={theme} />
      </div>
    </div>,
    { ...size, fonts },
  );
}
