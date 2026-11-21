// SPDX-License-Identifier: AGPL-3.0-only
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getAppConfig } from "@/src/config/app";
import { SeoIndex } from "@/src/components/marketing/seo-page";
import { localesFor } from "@/src/lib/content/seo";
import { notFound } from "next/navigation";
import {
  pageMetadata,
  requireMarketing,
  type LocaleProps,
} from "@/src/lib/content/marketing";
const template = "alternatives";
export async function generateMetadata({ params }: LocaleProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  requireMarketing();
  const t = await getTranslations("seo");
  return pageMetadata(
    `${t(`templates.${template}`)} | ${getAppConfig().name}`,
    t(`descriptions.${template}`),
    `/${template}`,
    locale,
    localesFor(template),
  );
}
export default async function Page({ params }: LocaleProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  requireMarketing();
  if (!(localesFor(template) as string[]).includes(locale)) notFound();
  await getTranslations("seo");
  return <SeoIndex template={template} locale={locale} />;
}
