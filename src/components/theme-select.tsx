"use client";
import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import {
  applyTheme,
  readTheme,
  THEME_KEY,
  type ThemeChoice,
} from "@/src/lib/theme";

type Theme = ThemeChoice;
const THEMES: Theme[] = ["dark", "light", "system"];

function subscribe(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme", "data-theme-choice"],
  });
  return () => observer.disconnect();
}

function apply(theme: Theme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {}
  applyTheme(theme);
  // The resolved theme may not change (e.g. dark → system on a dark device),
  // so poke subscribers through a separate attribute.
  document.documentElement.dataset.themeChoice = theme;
}

/** Dark (default) / Light / System, remembered on this device. */
export function ThemeSelect() {
  const t = useTranslations("common.theme");
  const theme = useSyncExternalStore(
    subscribe,
    readTheme,
    () => "dark" as Theme,
  );
  return (
    <div role="radiogroup" aria-label={t("label")} className="segmented">
      {THEMES.map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={theme === option}
          onClick={() => apply(option)}
        >
          {t(option)}
        </button>
      ))}
    </div>
  );
}
