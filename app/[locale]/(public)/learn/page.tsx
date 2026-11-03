import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ClientIntl } from "@/src/components/client-intl";
import { LearnEntry } from "@/src/features/cards/learn-entry";
import { Link } from "@/src/i18n/navigation";
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
    path: "/learn",
    title: t("learnTitle"),
    description: t("learnDescription"),
  });
}

export default async function Page({ params }: LocaleParams) {
  const locale = await resolveLocale(params);
  const t = await getTranslations("learn.public");
  const meta = await getTranslations("meta");
  return (
    <div className="container-narrow" style={{ paddingBlock: "56px 40px" }}>
      <JsonLd
        data={graph(
          webPage({
            locale,
            path: "/learn",
            name: meta("learnTitle"),
            description: meta("learnDescription"),
          }),
          breadcrumbs(locale, [[meta("learnTitle"), "/learn"]]),
        )}
      />
      <span className="eyebrow">{t("eyebrow")}</span>
      <h1 className="text-3xl sm:text-4xl">{t("title")}</h1>
      <p className="lead mt-3">{t("lead")}</p>
      <ol
        className="grid gap-3 sm:grid-cols-2 my-8"
        style={{ listStyle: "none", padding: 0 }}
      >
        {(["1", "2", "3", "4"] as const).map((n) => (
          <li key={n} className="card card-sm flex items-start gap-3">
            <span className="badge badge-accent tabular">{n}</span>
            <span className="small">{t(`steps.${n}`)}</span>
          </li>
        ))}
      </ol>
      <ClientIntl namespaces={["learn"]}>
        <LearnEntry />
      </ClientIntl>
      <p className="small mt-6">
        <Link href="/focus" className="link">
          {t("workInstead")}
        </Link>
      </p>
    </div>
  );
}
