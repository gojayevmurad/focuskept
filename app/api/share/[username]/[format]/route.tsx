// SPDX-License-Identifier: AGPL-3.0-only
import { ImageResponse } from "next/og";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { getProfileByUsername } from "@/src/lib/profiles";
import { userStats } from "@/src/lib/growth/stats";
import { getAppConfig } from "@/src/config/app";
import { routing } from "@/src/i18n/routing";
import {
  OgIdentity,
  OgRope,
  ogFonts,
  ogLaneGround,
  ogThemes,
} from "@/src/lib/brand/og";

export const runtime = "nodejs";

const SIZES = { story: [1080, 1920], square: [1080, 1080] } as const;

/** Shareable stats card. Only for people who made their stats public. */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ username: string; format: string }> },
) {
  const { username, format } = await ctx.params;
  if (!(format in SIZES)) return new Response(null, { status: 404 });
  const person = await getProfileByUsername(username);
  if (!person || !person.statsPublic || person.suspendedAt)
    return new Response(null, { status: 404 });
  const stats = await userStats(person.userId, person.timezone);
  const app = getAppConfig();
  const [width, height] = SIZES[format as keyof typeof SIZES];
  const story = format === "story";
  // The card speaks the owner's language, not the viewer's, so one cached
  // image is right for everyone who opens the link.
  const locale = hasLocale(routing.locales, person.locale)
    ? person.locale
    : routing.defaultLocale;
  const [t, fonts] = await Promise.all([
    getTranslations({ locale, namespace: "progress.card" }),
    ogFonts(),
  ]);
  const month = new Intl.DateTimeFormat(locale, {
    month: "long",
    timeZone: person.timezone,
  }).format(new Date());
  const hours =
    stats.monthHours >= 10 ? Math.round(stats.monthHours) : stats.monthHours;
  const theme = ogThemes.dark;
  const pad = story ? 100 : 84;
  const site = app.url.replace(/^https?:\/\//, "").replace(/\/$/, "");

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: `${pad}px ${pad}px ${story ? 72 : 60}px`,
        ...ogLaneGround(theme),
        color: theme.text,
        fontFamily: "Figtree",
      }}
    >
      <OgIdentity
        name={app.name}
        showMark={!app.logoUrl}
        theme={theme}
        size={story ? 80 : 68}
      />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: story ? 36 : 20,
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: story ? 52 : 44,
            color: theme.muted,
            maxWidth: width - pad * 2,
          }}
        >
          {t("month", { name: person.displayName, month })}
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 24 }}>
          <div
            style={{
              display: "flex",
              fontFamily: "Big Shoulders",
              fontWeight: 700,
              fontSize: story ? 300 : 230,
              lineHeight: 0.9,
            }}
          >
            {new Intl.NumberFormat(locale).format(hours)}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: story ? 72 : 60,
              fontWeight: 600,
            }}
          >
            {t("hours", { count: hours })}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            fontSize: story ? 56 : 46,
            lineHeight: 1.2,
            maxWidth: width - pad * 2,
          }}
        >
          {t("line")}
        </div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: story ? 20 : 16,
            marginTop: story ? 24 : 8,
          }}
        >
          {[
            t("sessions", { count: stats.monthSessions }),
            t("streak", { count: stats.dailyStreak }),
          ].map((label) => (
            <div
              key={label}
              style={{
                display: "flex",
                padding: story ? "18px 30px" : "14px 26px",
                borderRadius: 999,
                backgroundColor: theme.panel,
                color: theme.accent,
                fontSize: story ? 44 : 36,
                fontWeight: 600,
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: story ? 28 : 22,
        }}
      >
        <div style={{ display: "flex", fontSize: 36, color: theme.muted }}>
          {`${site}/u/${person.username}`}
        </div>
        <OgRope width={width - pad * 2} theme={theme} />
      </div>
    </div>,
    {
      width,
      height,
      fonts,
      headers: { "Cache-Control": "public, max-age=600" },
    },
  );
}
