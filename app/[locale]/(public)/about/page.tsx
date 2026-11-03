import type { Metadata } from "next";
import { getLegalContent } from "@/src/features/legal/content";
import { LegalPage } from "@/src/features/legal/legal-page";
import { publicMetadata } from "@/src/lib/seo";
import { JsonLd } from "@/src/components/json-ld";
import {
  breadcrumbs,
  graph,
  organization,
  webPage,
} from "@/src/lib/structured-data";
import {
  metadataLocale,
  resolveLocale,
  type LocaleParams,
} from "@/src/i18n/server";

export async function generateMetadata({
  params,
}: LocaleParams): Promise<Metadata> {
  const locale = await metadataLocale(params);
  const doc = (await getLegalContent(locale)).about;
  return publicMetadata({
    locale,
    path: "/about",
    title: doc.title,
    description: doc.intro.slice(0, 155),
  });
}

export default async function Page({ params }: LocaleParams) {
  const locale = await resolveLocale(params);
  const doc = (await getLegalContent(locale)).about;
  return (
    <>
      <JsonLd
        data={graph(
          {
            ...webPage({
              locale,
              path: "/about",
              name: doc.title,
              description: doc.intro,
              type: "AboutPage",
            }),
            about: { "@id": organization()["@id"] },
          },
          organization(),
          breadcrumbs(locale, [[doc.title, "/about"]]),
        )}
      />
      <LegalPage doc={doc} />
    </>
  );
}
