"use client";
import { useEffect } from "react";
import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/src/i18n/navigation";
import type { Locale } from "@/src/i18n/config";

/**
 * First visit: stores the browser timezone + UI locale. Afterwards: the saved
 * locale wins over the URL/cookie, so the app follows the user's choice.
 */
export function PreferencesSync({
  initialized,
  savedLocale,
}: {
  initialized: boolean;
  savedLocale: Locale;
}) {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (!initialized) {
      const timezone =
        Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      void fetch("/api/preferences/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timezone, locale }),
      })
        .then((r) => (r.ok ? router.refresh() : undefined))
        .catch(() => {});
    } else if (savedLocale !== locale) {
      router.replace(pathname + window.location.search, {
        locale: savedLocale,
      });
    }
  }, [initialized, savedLocale, locale, pathname, router]);
  return null;
}
