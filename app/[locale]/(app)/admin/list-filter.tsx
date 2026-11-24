// SPDX-License-Identifier: AGPL-3.0-only
import { getTranslations } from "next-intl/server";
import styles from "./admin.module.css";
export function listQuery(params: { q?: string | string[] }) {
  return (typeof params.q === "string" ? params.q : "").trim().slice(0, 200);
}
export async function ListFilter({ q }: { q: string }) {
  const t = await getTranslations("admin");
  return (
    <form method="get" className={styles.filters}>
      <label className="field">
        <span>{t("filterSearch")}</span>
        <input
          name="q"
          defaultValue={q}
          maxLength={200}
          placeholder={t("filterPlaceholder")}
        />
      </label>
      <button className="button secondary">{t("searchButton")}</button>
    </form>
  );
}
