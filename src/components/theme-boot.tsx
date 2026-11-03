"use client";
import { useSyncExternalStore } from "react";
import { themeBootScript } from "@/src/lib/theme";

const subscribe = () => () => {};

/**
 * The theme boot script, rendered only in the server HTML (and adopted during
 * hydration). Client renders, such as the locale layout after a language
 * switch, render nothing, so React never creates a <script> element; ThemeSync
 * re-applies the theme there instead.
 */
export function ThemeBoot() {
  const serverRender = useSyncExternalStore(
    subscribe,
    () => false,
    () => true,
  );
  return serverRender ? (
    <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
  ) : null;
}
