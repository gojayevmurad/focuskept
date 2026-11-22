// SPDX-License-Identifier: AGPL-3.0-only
import { getTranslations } from "next-intl/server";
import { Link } from "@/src/i18n/navigation";
import { LaneRope } from "@/src/components/lanes";
import styles from "./not-found.module.css";

export default async function NotFound() {
  const t = await getTranslations("errors");
  return (
    <main className={`empty-state ${styles.emptyState}`}>
      <div className={styles.laneCard}>
        <div className={styles.digit}>404</div>
        <LaneRope className={styles.rope} />
        <h1>{t("notFound")}</h1>
        <Link href="/" className="button">
          {t("home")}
        </Link>
      </div>
    </main>
  );
}
