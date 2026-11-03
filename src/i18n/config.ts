// Shared by server, client and proxy code: keep this file free of Node or React imports.
export const locales = [
  "en",
  "el",
  "nl",
  "hu",
  "cs",
  "es",
  "fr",
  "de",
  "it",
  "pl",
  "pt-BR",
  "tr",
  "ru",
  "uk",
  "ar",
  "fa",
  "ur",
  "ja",
  "ko",
  "zh-CN",
  "hi",
  "id",
  "vi",
  "az",
] as const;

export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";
export const rtlLocales: readonly Locale[] = ["ar", "fa", "ur"];

export type ScriptFont =
  "arabic" | "jp" | "kr" | "sc" | "devanagari" | "greek" | "vietnamese";

// Native names are shown in the language switcher; they are never translated.
export const localeInfo: Record<
  Locale,
  { nativeName: string; script?: ScriptFont }
> = {
  en: { nativeName: "English" },
  el: { nativeName: "Ελληνικά", script: "greek" },
  nl: { nativeName: "Nederlands" },
  hu: { nativeName: "Magyar" },
  cs: { nativeName: "Čeština" },
  es: { nativeName: "Español" },
  fr: { nativeName: "Français" },
  de: { nativeName: "Deutsch" },
  it: { nativeName: "Italiano" },
  pl: { nativeName: "Polski" },
  "pt-BR": { nativeName: "Português (Brasil)" },
  tr: { nativeName: "Türkçe" },
  ru: { nativeName: "Русский" },
  uk: { nativeName: "Українська" },
  ar: { nativeName: "العربية", script: "arabic" },
  fa: { nativeName: "فارسی", script: "arabic" },
  ur: { nativeName: "اردو", script: "arabic" },
  ja: { nativeName: "日本語", script: "jp" },
  ko: { nativeName: "한국어", script: "kr" },
  "zh-CN": { nativeName: "简体中文", script: "sc" },
  hi: { nativeName: "हिन्दी", script: "devanagari" },
  id: { nativeName: "Bahasa Indonesia" },
  vi: { nativeName: "Tiếng Việt", script: "vietnamese" },
  az: { nativeName: "Azərbaycanca" },
};

export function isLocale(value: unknown): value is Locale {
  return (
    typeof value === "string" && (locales as readonly string[]).includes(value)
  );
}

export function isRtl(locale: string) {
  return (rtlLocales as readonly string[]).includes(locale);
}

export function direction(locale: string): "rtl" | "ltr" {
  return isRtl(locale) ? "rtl" : "ltr";
}

/** First path segment if it is a supported locale, e.g. "/de/app" → "de". */
export function localeFromPath(path: string): Locale | undefined {
  const segment = path.split(/[/?#]/)[1];
  return isLocale(segment) ? segment : undefined;
}

export const LOCALE_COOKIE = "NEXT_LOCALE";
