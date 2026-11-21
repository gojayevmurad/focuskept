// SPDX-License-Identifier: AGPL-3.0-only
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getSeoPage, listSeoPages } from "@/src/lib/content/seo";
import {
  pageMetadata,
  requireMarketing,
  type SlugProps,
} from "@/src/lib/content/marketing";
import { SeoPage } from "@/src/components/marketing/seo-page";
const template = "virtual-coworking-for";
export const dynamicParams = false;
export function generateStaticParams() {
  return listSeoPages(template).map((page) => ({ slug: page.slug }));
}
export async function generateMetadata({ params }: SlugProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  requireMarketing();
  const page = getSeoPage(template, slug);
  if (!page) notFound();
  return pageMetadata(page.title, page.description, `/${template}/${slug}`);
}
export default async function Page({ params }: SlugProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  requireMarketing();
  await getTranslations("seo");
  const page = getSeoPage(template, slug);
  if (!page) notFound();
  return <SeoPage page={page} template={template} />;
}
