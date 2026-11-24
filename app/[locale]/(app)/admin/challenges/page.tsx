// SPDX-License-Identifier: AGPL-3.0-only
import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/src/lib/app-user";
import { listChallenges } from "@/src/lib/challenges";
import { ListFilter, listQuery } from "../list-filter";
import { AdminFrame } from "../frame";
import { ActionForm } from "../action-form";
import { ChallengeForm } from "./challenge-form";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const q = listQuery(await searchParams);
  await requireAdmin();
  const t = await getTranslations("admin");
  const rows = (await listChallenges()).filter((row) =>
    `${row.title} ${row.slug} ${row.description}`
      .toLocaleLowerCase()
      .includes(q.toLocaleLowerCase()),
  );
  return (
    <AdminFrame section="challenges">
      <ListFilter q={q} />
      <section className="card stack">
        <h2>{t("createChallenge")}</h2>
        <ChallengeForm />
      </section>
      <section className="stack">
        <h2>{t("existingChallenges")}</h2>
        {!rows.length && <p>{t("empty")}</p>}
        {rows.map((row) => (
          <article className="card stack" key={row.id}>
            <div className="row-between">
              <h3>{row.title}</h3>
              <span className="badge">
                {t("members", { count: row.members })}
              </span>
            </div>
            <details>
              <summary>{t("edit")}</summary>
              <ChallengeForm
                initial={{
                  id: row.id,
                  title: row.title,
                  slug: row.slug,
                  description: row.description,
                  startsAt: row.startsAt.toISOString().slice(0, 10),
                  endsAt: row.endsAt.toISOString().slice(0, 10),
                  goalType: row.goalType,
                  goalValue:
                    row.goalType === "minutes"
                      ? row.goalValue / 60
                      : row.goalValue,
                }}
              />
            </details>
            {row.startsAt > new Date() ? (
              <ActionForm
                fields={{ intent: "challengeDelete", id: row.id }}
                label={t("delete")}
                danger
              />
            ) : (
              <p className="small muted">{t("challengeStarted")}</p>
            )}
          </article>
        ))}
      </section>
    </AdminFrame>
  );
}
