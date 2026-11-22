// SPDX-License-Identifier: AGPL-3.0-only
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getAppConfig } from "@/src/config/app";
import { Link } from "@/src/i18n/navigation";
import { pageMetadata, type LocaleProps } from "@/src/lib/content/marketing";
import { sections } from "@/src/components/marketing/terms-content";
import styles from "./terms.module.css";

export async function generateMetadata({ params }: LocaleProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("legal");
  return pageMetadata(
    `${t("terms")} | ${getAppConfig().name}`,
    t("terms"),
    "/terms",
    "en",
    ["en"],
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
    <div className={`container ${styles.page}`}>
      <article className={styles.article}>
        <header className={styles.pageHead}>
          <h1>{t("terms")}</h1>
          <p className={styles.updated}>{t("updated")}</p>
        </header>
        <div className={styles.reading}>
          {sections.map((section) => (
            <section key={section.heading} className={styles.section}>
              <h2>{section.heading}</h2>
              {section.body.split("\n\n").map((paragraph, i) => (
                <p key={i}>{replace(paragraph)}</p>
              ))}
            </section>
          ))}
        </div>
        <div className={styles.legalLinks}>
          <a href={`mailto:${app.supportEmail}`}>
            {t("contact")}: {app.supportEmail}
          </a>
          <Link href="/privacy">{t("privacy")}</Link>
        </div>
      </article>
    </div>
  );
}
