// SPDX-License-Identifier: AGPL-3.0-only
"use client";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";
import { currentTheme, cycleTheme, setTheme } from "@/src/lib/theme";

function subscribe(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, {
    attributeFilter: ["data-theme"],
  });
  return () => observer.disconnect();
}

export function ThemeToggle() {
  const t = useTranslations("common");
  const theme = useSyncExternalStore(
    subscribe,
    currentTheme,
    () => "system" as const,
  );
  return (
    <button
      className="button ghost small icon"
      aria-label={t("themeState", { state: t(`themeOptions.${theme}`) })}
      onClick={() => setTheme(cycleTheme(theme))}
    >
      {theme === "system" ? (
        <Monitor size={17} />
      ) : theme === "light" ? (
        <Sun size={17} />
      ) : (
        <Moon size={17} />
      )}
    </button>
  );
}
