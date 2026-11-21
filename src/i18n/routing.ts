// SPDX-License-Identifier: AGPL-3.0-only
import { defineRouting } from "next-intl/routing";

// Add a locale here and in messages/ to ship it. English stays unprefixed.
export const locales = ["en"] as const;
export type Locale = (typeof locales)[number];

export const routing = defineRouting({
  locales,
  defaultLocale: "en",
  localePrefix: "as-needed",
  localeCookie: { name: "locale", maxAge: 60 * 60 * 24 * 365 },
});
