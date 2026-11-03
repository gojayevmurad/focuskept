import type { Metadata } from "next";
import { getLegalContent } from "@/src/features/legal/content";
import { LegalPage } from "@/src/features/legal/legal-page";
import { publicMetadata } from "@/src/lib/seo";
import {
  metadataLocale,
  resolveLocale,
  type LocaleParams,
} from "@/src/i18n/server";

export async function generateMetadata({
  params,
}: LocaleParams): Promise<Metadata> {
  const locale = await metadataLocale(params);
  const doc = (await getLegalContent(locale)).privacy;
  return publicMetadata({
    locale,
    path: "/privacy",
    title: doc.title,
    description: doc.intro.slice(0, 155),
  });
}

export default async function Page({ params }: LocaleParams) {
  const locale = await resolveLocale(params);
  return <LegalPage doc={(await getLegalContent(locale)).privacy} />;
}
