import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { isLocale, type Locale } from "./config";

export type LocaleParams = { params: Promise<{ locale: string }> };

/** Validates the [locale] segment and enables static rendering for it. */
export async function resolveLocale(
  params: Promise<{ locale: string }>,
): Promise<Locale> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  return locale;
}

/** For generateMetadata: the locale, or the default for an invalid segment. */
export async function metadataLocale(
  params: Promise<{ locale: string }>,
): Promise<Locale> {
  const { locale } = await params;
  return isLocale(locale) ? locale : "en";
}
