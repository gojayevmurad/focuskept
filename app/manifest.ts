// SPDX-License-Identifier: AGPL-3.0-only
import type { MetadataRoute } from "next";
import { getAppConfig } from "@/src/config/app";
export default function manifest(): MetadataRoute.Manifest {
  const { name } = getAppConfig();
  return {
    name,
    short_name: name,
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#121614",
    theme_color: "#2F6F62",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
