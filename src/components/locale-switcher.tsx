// SPDX-License-Identifier: AGPL-3.0-only
"use client";
import { useLocale } from "next-intl";
import { useParams } from "next/navigation";
import { usePathname, useRouter } from "@/src/i18n/navigation";
import { locales, type Locale } from "@/src/i18n/routing";

const NAMES: Record<Locale, string> = {
  en: "English",
  de: "Deutsch",
  fr: "Français",
  nl: "Nederlands",
  es: "Español",
};

export function LocaleSwitcher({ label }: { label: string }) {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  return (
    <select
      className="input"
      style={{ width: "auto", minHeight: 34, padding: "4px 10px" }}
      aria-label={label}
      value={locale}
      onChange={(e) =>
        // Keep dynamic segments ([slug], [id]) when switching.
        router.replace(
          // @ts-expect-error -- pathname and params come from the current route.
          { pathname, params },
          { locale: e.target.value as Locale },
        )
      }
    >
      {locales.map((l) => (
        <option key={l} value={l}>
          {NAMES[l]}
        </option>
      ))}
    </select>
  );
}
