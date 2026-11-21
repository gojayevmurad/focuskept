// SPDX-License-Identifier: AGPL-3.0-only
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/src/components/app-shell";
import { requireAppUser } from "@/src/lib/app-user";
import { myCommunities } from "@/src/lib/community";
import { Link } from "@/src/i18n/navigation";
import { CreateGroupForm, JoinByCodeForm } from "./forms";

export const metadata: Metadata = { title: "Groups" };

export default async function Page() {
  const { user } = await requireAppUser();
  const t = await getTranslations("groups");
  const groups = await myCommunities(user.id);
  return (
    <AppShell title={t("title")}>
      <div className="page-title">
        <h1>{t("title")}</h1>
        <p className="muted">{t("lead")}</p>
      </div>
      <section className="card stack">
        <h2>{t("yours")}</h2>
        {groups.length ? (
          <div className="list">
            {groups.map((g) => (
              <Link key={g.id} href={`/groups/${g.slug}`} className="list-item">
                <span className="grow">
                  <strong>{g.name}</strong>
                  <span className="small muted"> · {t(`kinds.${g.kind}`)}</span>
                </span>
                <span className="small faint">
                  {t("memberCount", { count: g.members })}
                </span>
                {g.role !== "member" && (
                  <span className="badge">{t(`roles.${g.role}`)}</span>
                )}
              </Link>
            ))}
          </div>
        ) : (
          <p className="muted small">{t("none")}</p>
        )}
      </section>
      <div className="grid-2">
        <section className="card stack">
          <h2>{t("joinTitle")}</h2>
          <JoinByCodeForm />
        </section>
        <section className="card stack">
          <h2>{t("createTitle")}</h2>
          <CreateGroupForm />
        </section>
      </div>
    </AppShell>
  );
}
