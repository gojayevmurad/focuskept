"use client";
import { Languages } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { usePathname, useRouter } from "@/src/i18n/navigation";
import { localeInfo, locales, type Locale } from "@/src/i18n/config";
import { track } from "@/src/lib/analytics/client";

export function LanguageSelect({ showLabel = false }: { showLabel?: boolean }) {
  const t = useTranslations("common.language");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  return (
    <label className={showLabel ? "field" : "inline-flex items-center gap-1"}>
      {showLabel ? (
        <span className="label">{t("label")}</span>
      ) : (
        <Languages size={17} aria-hidden="true" className="text-muted" />
      )}
      <select
        className={showLabel ? "select" : "select select-sm"}
        aria-label={showLabel ? undefined : t("label")}
        value={locale}
        disabled={pending}
        onChange={async (e) => {
          const next = e.target.value as Locale;
          track("locale_switched", { locale: next });
          // Signed-in users keep their choice across devices; for visitors this
          // answers 401 and the locale cookie alone remembers it.
          await fetch("/api/preferences", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ locale: next }),
          }).catch(() => {});
          startTransition(() => {
            // Without localized pathnames, `pathname` is the concrete path.
            router.replace(pathname + window.location.search, {
              locale: next,
            });
          });
        }}
      >
        {locales.map((l) => (
          <option key={l} value={l} lang={l}>
            {localeInfo[l].nativeName}
          </option>
        ))}
      </select>
    </label>
  );
}
