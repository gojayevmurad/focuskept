// SPDX-License-Identifier: AGPL-3.0-only
import type { MetadataRoute } from "next";
import { getAppConfig } from "@/src/config/app";
import { brandFiles, brandThemes } from "@/src/config/brand-assets";

export const dynamic = "force-dynamic";
export default function manifest(): MetadataRoute.Manifest {
  const { name, description } = getAppConfig();
  const { pwa } = brandFiles;
  return {
    name,
    short_name: name,
    description,
    start_url: "/dashboard",
    display: "standalone",
    background_color: brandThemes.light.background,
    theme_color: brandThemes.light.background,
    icons: [
      { src: pwa.any192, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: pwa.any512, sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: pwa.maskable192,
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: pwa.maskable512,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: brandFiles.iconSvg,
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
