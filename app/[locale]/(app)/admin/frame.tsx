// SPDX-License-Identifier: AGPL-3.0-only
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { AppShell } from "@/src/components/app-shell";
import { Link } from "@/src/i18n/navigation";
import styles from "./admin.module.css";

export const sections = [
  "overview",
  "users",
  "reports",
  "support",
  "hosts",
  "house",
  "groups",
  "challenges",
  "notifications",
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
      <div className={styles.frame}>
        <header className={styles.header}>
          <div>
            <p className="small muted">{t("operations")}</p>
            <h1>{t(`nav.${section}`)}</h1>
            <p className="muted">{t(`descriptions.${section}`)}</p>
          </div>
        </header>
        <nav className={styles.nav} aria-label={t("navigation")}>
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
        <div className={styles.content}>{children}</div>
      </div>
    </AppShell>
  );
}
