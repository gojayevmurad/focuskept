// SPDX-License-Identifier: AGPL-3.0-only
// Email identity. Pure so the Next server and the bundled worker share it.
import { brandFiles, brandPalette, kitName } from "@/src/config/brand-assets";

export type EmailBrand = {
  name: string;
  homeUrl: string;
  /** Kit lockup PNG; null means the header shows the name as text. */
  logo: { src: string; width: number; height: number } | null;
};

/** Literal colors: email clients ignore CSS variables and modern color functions. */
export const emailColors = {
  ground: brandPalette.mist,
  surface: brandPalette.white,
  header: brandPalette.deepInk,
  headerText: brandPalette.white,
  text: brandPalette.deepInk,
  muted: "#4e6572",
  border: "#d3e0e6",
  button: brandPalette.poolTeal,
  buttonText: brandPalette.white,
} as const;

/**
 * The FocusKept lockup only belongs to the FocusKept identity. A deployment
 * with its own APP_NAME or LOGO_URL gets its name as text: LOGO_URL may be SVG
 * or any host, so it is never fetched, converted or embedded in mail.
 */
export function emailBrand(app: {
  name: string;
  url: string;
  logoUrl?: string;
}): EmailBrand {
  const kitIdentity = app.name === kitName && !app.logoUrl;
  return {
    name: app.name,
    homeUrl: new URL("/", app.url).toString(),
    logo: kitIdentity
      ? {
          src: new URL(brandFiles.emailLogo, app.url).toString(),
          width: 160,
          height: 48,
        }
      : null,
  };
}
