import { ImageResponse } from "next/og";
import { getProfileByUsername } from "@/src/lib/profiles";
import { userStats } from "@/src/lib/growth/stats";
import { getAppConfig } from "@/src/config/app";

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
  const month = new Intl.DateTimeFormat("en-US", {
    month: "long",
    timeZone: person.timezone,
  }).format(new Date());
  const hours =
    stats.monthHours >= 10 ? Math.round(stats.monthHours) : stats.monthHours;
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: story ? 110 : 90,
        background:
          "linear-gradient(160deg, #173a33 0%, #121614 60%, #3a2e1c 100%)",
        color: "#ecefe9",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 24,
          fontSize: 44,
          fontWeight: 700,
        }}
      >
        <div
          style={{
            display: "flex",
            position: "relative",
            width: 72,
            height: 56,
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: 56,
              height: 56,
              borderRadius: 999,
              background: "#2F6F62",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 22,
              top: 0,
              width: 56,
              height: 56,
              borderRadius: 999,
              border: "8px solid #D9902F",
            }}
          />
        </div>
        {app.name}
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: story ? 40 : 24,
        }}
      >
        <div
          style={{ fontSize: story ? 64 : 52, color: "#a9b1ab" }}
        >{`${person.displayName} in ${month}`}</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 24 }}>
          <div
            style={{
              fontSize: story ? 260 : 210,
              fontWeight: 800,
              lineHeight: 1,
            }}
          >
            {String(hours)}
          </div>
          <div style={{ fontSize: story ? 72 : 60, fontWeight: 600 }}>
            {hours === 1 ? "hour" : "hours"}
          </div>
        </div>
        <div style={{ fontSize: story ? 64 : 52 }}>
          of focused work, with a partner beside me.
        </div>
        <div
          style={{
            display: "flex",
            gap: 48,
            fontSize: story ? 48 : 40,
            color: "#e6a74f",
          }}
        >
          <div>{`${stats.monthSessions} sessions`}</div>
          <div>{`${stats.dailyStreak}-day streak`}</div>
        </div>
      </div>
      <div
        style={{ fontSize: 40, color: "#a9b1ab" }}
      >{`${app.url.replace(/^https?:\/\//, "")}/u/${person.username}`}</div>
    </div>,
    { width, height, headers: { "Cache-Control": "public, max-age=600" } },
  );
}
