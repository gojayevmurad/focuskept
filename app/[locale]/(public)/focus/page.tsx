import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { ClientIntl } from "@/src/components/client-intl";
import { AnonymousFocus } from "@/src/features/focus/anonymous-focus";
import { techniqueLabels } from "@/src/features/techniques/content";
import { PLANNING_TECHNIQUES } from "@/src/features/techniques/slugs";
import {
  metadataLocale,
  resolveLocale,
  type LocaleParams,
} from "@/src/i18n/server";
import { publicMetadata } from "@/src/lib/seo";
import { JsonLd } from "@/src/components/json-ld";
import { breadcrumbs, graph, webPage } from "@/src/lib/structured-data";

export async function generateMetadata({
  params,
}: LocaleParams): Promise<Metadata> {
  const locale = await metadataLocale(params);
  const t = await getTranslations({ locale, namespace: "meta" });
  return publicMetadata({
    locale,
    path: "/focus",
    title: t("focusTitle"),
    description: t("focusDescription"),
  });
}

export default async function Page({ params }: LocaleParams) {
  const locale = await resolveLocale(params);
  const labels = await techniqueLabels(locale);
  const planningLabels = Object.fromEntries(
    PLANNING_TECHNIQUES.map((p) => [p, labels[p].name]),
  );
  const t = await getTranslations("focus.setup");
  const meta = await getTranslations("meta");
  return (
    <div className="container" style={{ paddingBlock: "32px 48px" }}>
      <JsonLd
        data={graph(
          webPage({
            locale,
            path: "/focus",
            name: meta("focusTitle"),
            description: meta("focusDescription"),
          }),
          breadcrumbs(locale, [[meta("focusTitle"), "/focus"]]),
        )}
      />
      <h1 className="sr-only">{meta("focusTitle")}</h1>
      <p className="hint mb-4 text-center">{t("anonymousNote")}</p>
      <ClientIntl namespaces={["timer", "focus", "home"]}>
        <Suspense
          fallback={
            <div
              className="skeleton mx-auto"
              style={{ height: 420, maxWidth: 760 }}
            />
          }
        >
          <AnonymousFocus labels={labels} planningLabels={planningLabels} />
        </Suspense>
      </ClientIntl>
    </div>
  );
}
