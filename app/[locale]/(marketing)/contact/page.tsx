// SPDX-License-Identifier: AGPL-3.0-only
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getAppConfig } from "@/src/config/app";
import { getSession } from "@/src/lib/auth/session";
import {
  pageMetadata,
  requireMarketing,
  type LocaleProps,
} from "@/src/lib/content/marketing";
import { ContactForm } from "./contact-form";
import styles from "./contact.module.css";

export async function generateMetadata({ params }: LocaleProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "contact" });
  const app = getAppConfig();
  return pageMetadata(
    t("title", { app: app.name }),
    t("description"),
    "/contact",
    locale,
  );
}

export default async function ContactPage({ params }: LocaleProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  requireMarketing();
  const session = await getSession();

  const t = await getTranslations("contact");

  return (
    <div className={`container ${styles.page}`}>
      <header className={styles.hero}>
        <h1>{t("heading")}</h1>
        <p>{t("lead")}</p>
      </header>
      <ContactForm
        initialName={session?.user?.name || ""}
        initialEmail={session?.user?.email || ""}
        locale={locale}
      />
    </div>
  );
}
