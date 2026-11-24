// SPDX-License-Identifier: AGPL-3.0-only
export type Theme = "system" | "light" | "dark";

export function currentTheme(): Theme {
  const theme = document.documentElement.dataset.theme;
  return theme === "light" || theme === "dark" ? theme : "system";
}

export function cycleTheme(theme: Theme): Theme {
  return theme === "system" ? "light" : theme === "light" ? "dark" : "system";
}

export function setTheme(theme: Theme) {
  if (theme === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem("theme", theme);
  } catch {}
}

// With no explicit theme, CSS follows prefers-color-scheme, including live changes.
export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t;else delete document.documentElement.dataset.theme}catch(e){delete document.documentElement.dataset.theme}`;
