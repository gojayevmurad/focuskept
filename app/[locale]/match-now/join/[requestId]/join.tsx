// SPDX-License-Identifier: AGPL-3.0-only
"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/src/i18n/navigation";
import styles from "@/src/components/match-now.module.css";

export function JoinMatch({ requestId }: { requestId: string }) {
  const t = useTranslations("matchNow");
  const router = useRouter();
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    fetch(`/api/match-now/join/${encodeURIComponent(requestId)}`, {
      method: "POST",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("unavailable");
        const data = await response.json();
        if (active && data.request?.sessionId)
          router.replace(`/session/${data.request.sessionId}`);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [requestId, router]);
  return (
    <main className={styles.joinPage}>
      <div className={styles.body}>
        <h1>{t(error ? "unavailableTitle" : "joining")}</h1>
        <p role="status">{t(error ? "unavailableBody" : "joiningBody")}</p>
        {error && (
          <Link className="button" href="/admin/notifications">
            {t("backNotifications")}
          </Link>
        )}
      </div>
    </main>
  );
}
