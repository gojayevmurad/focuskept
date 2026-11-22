// SPDX-License-Identifier: AGPL-3.0-only
import type { Metadata } from "next";
import { MailCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/src/i18n/navigation";
import styles from "../auth.module.css";

export const metadata: Metadata = {
  title: "Check your inbox",
  robots: { index: false },
};

export default async function Page() {
  const t = await getTranslations("auth");
  return (
    <>
      <div className={styles.iconBadge}>
        <MailCheck size={28} />
      </div>
      <div className={`stack-sm ${styles.header}`}>
        <h1>{t("verifyTitle")}</h1>
        <p className={`muted ${styles.lead}`}>{t("verifyLead")}</p>
      </div>
      <Link href="/sign-in" className="button full">
        {t("continueSignIn")}
      </Link>
    </>
  );
}
