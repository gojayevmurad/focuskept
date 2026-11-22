// SPDX-License-Identifier: AGPL-3.0-only
import type { Redirect } from "next/dist/lib/load-custom-routes";

export type { Redirect };

export const ACTIVE_LOCALES = ["de", "fr", "nl", "es"] as const;
export type ActiveLocale = (typeof ACTIVE_LOCALES)[number];

export const OTHER_LOCALES = [
  "ar",
  "az",
  "cs",
  "el",
  "fa",
  "hi",
  "hu",
  "id",
  "it",
  "ja",
  "ko",
  "pl",
  "pt-BR",
  "ru",
  "tr",
  "uk",
  "ur",
  "vi",
  "zh-CN",
] as const;
export type OtherLocale = (typeof OTHER_LOCALES)[number];

export const ALL_LEGACY_LOCALES = [
  "en",
  ...ACTIVE_LOCALES,
  ...OTHER_LOCALES,
] as const;
export type LegacyLocale = (typeof ALL_LEGACY_LOCALES)[number];

interface LegacyPathRule {
  readonly source: string;
  readonly destination: string;
}

const COMMON_PAGE_RULES: readonly LegacyPathRule[] = [
  { source: "techniques/:slug", destination: "blog" },
  { source: "techniques", destination: "blog" },
  { source: "app/:path*", destination: "dashboard" },
  { source: "app", destination: "dashboard" },
  { source: "about", destination: "how-it-works" },
  { source: "focus", destination: "how-it-works" },
  { source: "learn", destination: "how-it-works" },
];

const OTHER_LOCALE_STATIC_RULES: readonly LegacyPathRule[] = [
  { source: "privacy", destination: "privacy" },
  { source: "terms", destination: "terms" },
  { source: "pricing", destination: "pricing" },
  { source: "sign-in", destination: "sign-in" },
  { source: "sign-up", destination: "sign-up" },
  { source: "forgot-password", destination: "forgot-password" },
  { source: "reset-password", destination: "reset-password" },
  { source: "verify-email", destination: "verify-email" },
  { source: "unsubscribe", destination: "unsubscribe" },
];

export function getLegacyRedirects(): Redirect[] {
  const redirects: Redirect[] = [];

  for (const rule of COMMON_PAGE_RULES) {
    redirects.push({
      source: `/en/${rule.source}`,
      destination: `/${rule.destination}`,
      permanent: true,
    });
  }

  // English moved from /en/... to unprefixed URLs; make that move permanent too.
  redirects.push(
    { source: "/en", destination: "/", permanent: true },
    { source: "/en/:path*", destination: "/:path*", permanent: true },
  );

  for (const locale of ACTIVE_LOCALES) {
    for (const rule of COMMON_PAGE_RULES) {
      redirects.push({
        source: `/${locale}/${rule.source}`,
        destination: `/${locale}/${rule.destination}`,
        permanent: true,
      });
    }
  }

  const otherLangsPattern = OTHER_LOCALES.join("|");
  const langPrefix = `/:lang(${otherLangsPattern})`;

  for (const rule of COMMON_PAGE_RULES) {
    redirects.push({
      source: `${langPrefix}/${rule.source}`,
      destination: `/${rule.destination}`,
      permanent: true,
    });
  }

  for (const rule of OTHER_LOCALE_STATIC_RULES) {
    redirects.push({
      source: `${langPrefix}/${rule.source}`,
      destination: `/${rule.destination}`,
      permanent: true,
    });
  }

  redirects.push({
    source: `${langPrefix}/:path*`,
    destination: "/",
    permanent: true,
  });

  redirects.push({
    source: langPrefix,
    destination: "/",
    permanent: true,
  });

  return redirects;
}
