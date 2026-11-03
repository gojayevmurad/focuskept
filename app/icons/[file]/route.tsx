import { ImageResponse } from "next/og";
import { AMBER, MARK_DOT, MARK_RING } from "@/src/components/logo";

// PNG app icons rendered at build time (no binary assets in the repo).
const icons = {
  "icon-192.png": { size: 192, padding: 0, radius: 0.22 },
  "icon-512.png": { size: 512, padding: 0, radius: 0.22 },
  "maskable-512.png": { size: 512, padding: 0.18, radius: 0 },
  "apple-touch-icon.png": { size: 180, padding: 0.1, radius: 0 },
  "badge-72.png": { size: 72, padding: 0, radius: -1 },
  "favicon-32.png": { size: 32, padding: 0, radius: 0.22 },
  "favicon-48.png": { size: 48, padding: 0, radius: 0.22 },
} as const;

export const dynamic = "force-static";

export function generateStaticParams() {
  return Object.keys(icons).map((file) => ({ file }));
}

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ file: string }> },
) {
  const { file } = await ctx.params;
  const icon = icons[file as keyof typeof icons];
  if (!icon) return new Response(null, { status: 404 });
  const { size, padding, radius } = icon;
  const badge = radius < 0;
  const inner = size * (1 - padding * 2);
  const mark = badge ? size : inner * 0.78;
  return new ImageResponse(
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: badge ? "transparent" : "#0E1110",
        borderRadius: badge ? 0 : size * Math.max(0, radius),
      }}
    >
      <svg width={mark} height={mark} viewBox="0 0 48 48" fill="none">
        <path
          d={MARK_RING}
          stroke={badge ? "#ffffff" : "#E9ECEA"}
          strokeWidth="5"
          strokeLinecap="round"
        />
        <circle {...MARK_DOT} fill={badge ? "#ffffff" : AMBER} />
      </svg>
    </div>,
    { width: size, height: size },
  );
}
