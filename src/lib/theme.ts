/** Theme preference shared by the boot script, the theme picker and ThemeSync. */
export type ThemeChoice = "dark" | "light" | "system";

export const THEME_KEY = "theme";

// Applied before paint to avoid a theme flash. Static code, no user input.
// Dark is the default; "light" and "system" are opt-in.
export const themeBootScript = `try{var t=localStorage.getItem('${THEME_KEY}');if(t==='system')t=matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';document.documentElement.dataset.theme=t==='light'?'light':'dark'}catch(e){}`;

export function readTheme(): ThemeChoice {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    return stored === "light" || stored === "system" ? stored : "dark";
  } catch {
    return "dark";
  }
}

export function resolveTheme(choice: ThemeChoice): "dark" | "light" {
  if (choice !== "system") return choice;
  return matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

/** Writes the resolved theme onto <html>, unless it is already there. */
export function applyTheme(choice: ThemeChoice = readTheme()) {
  const resolved = resolveTheme(choice);
  const root = document.documentElement;
  if (root.dataset.theme !== resolved) root.dataset.theme = resolved;
}
