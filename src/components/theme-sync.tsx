"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { applyTheme } from "@/src/lib/theme";

/**
 * Keeps the stored theme on <html> after client navigations. Switching the
 * language re-renders the locale layout, and the boot script only runs on a
 * full page load, so without this the theme fell back to the default.
 */
export function ThemeSync() {
  const pathname = usePathname();
  useEffect(() => {
    applyTheme();
  }, [pathname]);
  return null;
}
