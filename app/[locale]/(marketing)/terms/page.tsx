// SPDX-License-Identifier: AGPL-3.0-only
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getAppConfig } from "@/src/config/app";
import { Link } from "@/src/i18n/navigation";
import { pageMetadata, type LocaleProps } from "@/src/lib/content/marketing";
import { sections } from "@/src/components/marketing/terms-content";
export async function generateMetadata({ params }: LocaleProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("legal");
  return pageMetadata(
    `${t("terms")} | ${getAppConfig().name}`,
    t("terms"),
    "/terms",
  );
}
export default async function Legal({ params }: LocaleProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("legal");
  const app = getAppConfig();
  const replace = (text: string) =>
    text.replaceAll("{app}", app.name).replaceAll("{email}", app.supportEmail);
  return (
    <div className="container">
      <header className="page-head">
        <h1>{t("terms")}</h1>
        <p className="muted">{t("updated")}</p>
      </header>
      <article className="prose">
        {sections.map((section) => (
          <section key={section.heading}>
            <h2>{section.heading}</h2>
            {section.body.split("\n\n").map((paragraph, i) => (
              <p key={i}>{replace(paragraph)}</p>
            ))}
          </section>
        ))}
        <p>
          <a href={`mailto:${app.supportEmail}`}>
            {t("contact")}: {app.supportEmail}
          </a>
        </p>
        <p>
          <Link href="/privacy">{t("privacy")}</Link>
        </p>
      </article>
    </div>
  );
}
