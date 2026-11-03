import type { Locale } from "./config";
import type en from "@/messages/en.json";

export type Messages = typeof en;
type Tree = { [key: string]: string | Tree };

function merge(base: Tree, override: Tree): Tree {
  const result: Tree = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const current = result[key];
    result[key] =
      typeof value === "object" && typeof current === "object"
        ? merge(current, value)
        : value;
  }
  return result;
}

/**
 * Loads a locale's messages. English is the source of truth; `pnpm i18n:check`
 * fails CI when any locale is missing a key, so the merge below is only a
 * safety net against a runtime crash, never a substitute for a translation.
 */
export async function loadMessages(locale: Locale): Promise<Messages> {
  const english = (await import("@/messages/en.json")).default as Tree;
  if (locale === "en") return english as Messages;
  try {
    const localized = (await import(`@/messages/${locale}.json`))
      .default as Tree;
    return merge(english, localized) as Messages;
  } catch {
    return english as Messages;
  }
}

export function pick<T extends Record<string, unknown>, K extends keyof T>(
  messages: T,
  keys: readonly K[],
): Pick<T, K> {
  return Object.fromEntries(keys.map((k) => [k, messages[k]])) as Pick<T, K>;
}
