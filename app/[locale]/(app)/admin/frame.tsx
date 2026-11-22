// SPDX-License-Identifier: AGPL-3.0-only
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import styles from "../lanes.module.css";
import { AppShell } from "@/src/components/app-shell";
import { Link } from "@/src/i18n/navigation";

const sections = [
  "overview",
  "users",
  "reports",
  "hosts",
  "challenges",
  "groups",
  "house",
] as const;
export async function AdminFrame({
  section,
  children,
}: {
  section: (typeof sections)[number];
  children: ReactNode;
}) {
  const t = await getTranslations("admin");
  return (
    <AppShell title={t(`nav.${section}`)}>
      <div className={`${styles.page} ${styles.admin}`}>
        <div className="page-title">
          <h1>{t(`nav.${section}`)}</h1>
        </div>
        <nav
          className="segmented"
          aria-label={t("navigation")}
          style={{ flexWrap: "wrap" }}
        >
          {sections.map((key) => (
            <Link
              key={key}
              href={key === "overview" ? "/admin" : `/admin/${key}`}
              aria-current={key === section ? "page" : undefined}
            >
              {t(`nav.${key}`)}
            </Link>
          ))}
        </nav>
        {children}
      </div>
    </AppShell>
  );
}
