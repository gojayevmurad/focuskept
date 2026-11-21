// SPDX-License-Identifier: AGPL-3.0-only
import "server-only";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getAppConfig } from "@/src/config/app";
export type LocaleProps = { params: Promise<{ locale: string }> };
export type SlugProps = { params: Promise<{ locale: string; slug: string }> };
export function requireMarketing() {
  if (!getAppConfig().marketingEnabled) notFound();
}
export function absoluteUrl(path: string) {
  return new URL(path, getAppConfig().url).toString();
}
export function pageMetadata(
  title: string,
  description: string,
  path: string,
): Metadata {
  const url = absoluteUrl(path);
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: getAppConfig().name,
      type: "website",
    },
  };
}
export async function translatedMetadata(
  params: LocaleProps["params"],
  namespace: string,
  path: string,
) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace });
  return pageMetadata(
    t("title", { app: getAppConfig().name }),
    t("description"),
    path,
  );
}
