// SPDX-License-Identifier: AGPL-3.0-only
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { Link } from "@/src/i18n/navigation";
import styles from "./unsubscribe.module.css";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "unsubscribe" });
  return { title: t("title") };
}

export default async function UnsubscribePage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { status } = await searchParams;
  const t = await getTranslations({ locale, namespace: "unsubscribe" });

  const isInvalid = status === "invalid";

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        {isInvalid ? (
          <>
            <div className={styles.iconWrapperError}>
              <AlertCircle size={32} />
            </div>
            <h1>{t("invalidHeading")}</h1>
            <p className={styles.description}>{t("invalidMessage")}</p>
            <div className={styles.actions}>
              <Link href="/settings" className="button">
                {t("goToSettings")}
              </Link>
              <Link href="/" className="button secondary">
                {t("goHome")}
              </Link>
            </div>
          </>
        ) : (
          <>
            <div className={styles.iconWrapperSuccess}>
              <CheckCircle2 size={32} />
            </div>
            <h1>{t("successHeading")}</h1>
            <p className={styles.description}>{t("successMessage")}</p>
            <div className={styles.noticeBox}>
              <p className={styles.noticeText}>{t("reminderNotice")}</p>
              <p className={styles.noticeTextSecondary}>{t("settingsNotice")}</p>
            </div>
            <div className={styles.actions}>
              <Link href="/settings" className="button">
                {t("goToSettings")}
              </Link>
              <Link href="/dashboard" className="button secondary">
                {t("goHome")}
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
