// SPDX-License-Identifier: AGPL-3.0-only
import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  brandGeometry,
  brandPalette,
  markColors,
} from "@/src/config/brand-assets";

// next/og renders with Satori: literal colors, flexbox and TTF/OTF/WOFF only.
// The static instances come from the kit (OFL-1.1, notices beside them) and
// are traced into the standalone build by next.config.ts.
const fontDir = join(process.cwd(), "brand/exports/fonts");
const fontFiles = [
  ["Figtree", 400, "Figtree-Regular.ttf"],
  ["Figtree", 600, "Figtree-Semibold.ttf"],
  ["Big Shoulders", 700, "BigShoulders-Bold.ttf"],
] as const;

type OgFont = {
  name: string;
  data: Buffer;
  weight: 400 | 600 | 700;
  style: "normal";
};
let fonts: Promise<OgFont[]> | undefined;

/** Fonts for ImageResponse, read once per process from the repository. */
export function ogFonts() {
  fonts ??= Promise.all(
    fontFiles.map(async ([name, weight, file]) => ({
      name,
      weight,
      style: "normal" as const,
      data: await readFile(join(fontDir, file)),
    })),
  ).catch((error) => {
    fonts = undefined;
    throw error;
  });
  return fonts;
}

export const ogThemes = {
  light: {
    ground: brandPalette.mist,
    text: brandPalette.deepInk,
    muted: "#465e6b",
    accent: brandPalette.poolTeal,
    lane: "#dce8ed",
    panel: "#e9f4f6",
    rope: [brandPalette.poolTeal, brandPalette.companionTeal],
    mark: markColors.primary,
  },
  dark: {
    ground: brandPalette.nightWater,
    text: "#edf6fa",
    muted: "#c0d2dc",
    accent: brandPalette.paleTeal,
    lane: "#163443",
    panel: "#123543",
    rope: [brandPalette.paleTeal, brandPalette.companionTeal],
    mark: markColors.dark,
  },
} as const;
export type OgTheme = (typeof ogThemes)[keyof typeof ogThemes];

/** Kit symbol as inline SVG paths (no network, no data URL). */
export function OgMark({
  size,
  colors,
}: {
  size: number;
  colors: readonly [string, string];
}) {
  return (
    <svg width={size} height={size} viewBox={brandGeometry.viewBox}>
      <g transform={brandGeometry.offset}>
        <path d={brandGeometry.left} fill={colors[0]} />
        <path
          d={brandGeometry.left}
          transform={brandGeometry.rightTransform}
          fill={colors[1]}
        />
      </g>
    </svg>
  );
}

/** Mark + deployment name. LOGO_URL is not fetched; custom logos fall back to the name. */
export function OgIdentity({
  name,
  showMark,
  theme,
  size,
}: {
  name: string;
  showMark: boolean;
  theme: OgTheme;
  size: number;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: size * 0.3 }}>
      {showMark && <OgMark size={size} colors={theme.mark} />}
      <div
        style={{
          display: "flex",
          fontFamily: "Figtree",
          fontWeight: 600,
          fontSize: size * 0.62,
          letterSpacing: "-0.02em",
          color: theme.text,
          maxWidth: 900,
          overflow: "hidden",
          whiteSpace: "nowrap",
          textOverflow: "ellipsis",
        }}
      >
        {name}
      </div>
    </div>
  );
}

/** The kit's dashed lane line along the bottom edge. */
export function OgRope({ width, theme }: { width: number; theme: OgTheme }) {
  const count = Math.floor(width / 34);
  return (
    <div style={{ display: "flex", width, height: 6, gap: 10 }}>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            flex: 1,
            height: 6,
            borderRadius: 3,
            backgroundColor: theme.rope[i % 2],
          }}
        />
      ))}
    </div>
  );
}

/** Faint vertical lane lines, as in the kit's social templates. */
export function ogLaneGround(theme: OgTheme, spacing = 120) {
  return {
    backgroundColor: theme.ground,
    backgroundImage: `linear-gradient(to right, ${theme.lane} 1px, transparent 1px)`,
    backgroundSize: `${spacing}px 100%`,
  } as const;
}
