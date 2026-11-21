// SPDX-License-Identifier: AGPL-3.0-only
import type { MetadataRoute } from "next";
import { getAppConfig } from "@/src/config/app";
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/dashboard",
        "/book",
        "/session",
        "/settings",
        "/admin",
        "/onboarding",
      ],
    },
    sitemap: new URL("/sitemap.xml", getAppConfig().url).toString(),
  };
}
