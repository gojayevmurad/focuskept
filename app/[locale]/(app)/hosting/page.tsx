// SPDX-License-Identifier: AGPL-3.0-only
import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { AppShell } from "@/src/components/app-shell";
import { requireAppUser } from "@/src/lib/app-user";
import { completedCount, getHost, hostedSessions } from "@/src/lib/hosts";
import { getEnv } from "@/src/config/env";
import { getAppConfig } from "@/src/config/app";
import { Link } from "@/src/i18n/navigation";
import { CopyLink } from "@/src/components/copy-link";
import { ApplyForm, CancelHosted, ScheduleForm } from "./forms";

export const metadata: Metadata = { title: "Hosting" };

export default async function Page() {
  const { user, profile } = await requireAppUser();
  const t = await getTranslations("hosting");
  const format = await getFormatter();
  const env = getEnv();
  const app = getAppConfig();
  const [h, done] = await Promise.all([
    getHost(user.id),
    completedCount(user.id),
  ]);
  const sessions =
    h?.status === "approved" ? await hostedSessions(user.id) : [];
  return (
    <AppShell title={t("title")} narrow>
      <div className="page-title">
        <h1>{t("title")}</h1>
        <p className="muted">{t("lead", { n: env.HOST_PERK_SESSIONS })}</p>
      </div>
      {!h || h.status === "rejected" ? (
        <section className="card stack">
          <h2>{t("applyTitle")}</h2>
          {done >= env.HOST_MIN_SESSIONS ? (
            <ApplyForm />
          ) : (
            <p className="muted">
              {t("notYet", { needed: env.HOST_MIN_SESSIONS, done })}
            </p>
          )}
        </section>
      ) : h.status === "applied" ? (
        <section className="card stack-sm">
          <h2>{t("pendingTitle")}</h2>
          <p className="muted">{t("pendingLead")}</p>
        </section>
      ) : h.status === "suspended" ? (
        <p className="notice warn">{t("suspended")}</p>
      ) : (
        <>
          <div className="grid-3">
            <div className="card stat">
              <span className="small muted">{t("hosted")}</span>
              <strong>{h.sessionsHosted}</strong>
            </div>
            <div className="card stat">
              <span className="small muted">{t("rating")}</span>
              <strong>{h.rating ? h.rating.toFixed(1) : "–"}</strong>
              <span className="small faint">
                {t("ratings", { n: h.ratingsCount })}
              </span>
            </div>
            <div className="card stat">
              <span className="small muted">{t("perk")}</span>
              <strong>
                {h.perkUntil && h.perkUntil > new Date() ? "Plus" : "–"}
              </strong>
            </div>
          </div>
          <section className="card stack">
            <h2>{t("yourPage")}</h2>
            <CopyLink value={`${app.url}/host/${profile.username}`} />
          </section>
          <section className="card stack">
            <h2>{t("scheduleTitle")}</h2>
            <ScheduleForm timeZone={profile.timezone} />
          </section>
          <section className="card stack">
            <h2>{t("upcoming")}</h2>
            {sessions.length ? (
              <div className="list">
                {sessions.map((s) => (
                  <div key={s.id} className="list-item">
                    <div className="grow">
                      <strong>{s.title}</strong>
                      <div className="small muted">
                        {format.dateTime(s.startAt, {
                          timeZone: profile.timezone,
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}{" "}
                        · {s.durationMin} min ·{" "}
                        {t("seats", {
                          taken: s.taken,
                          capacity: s.capacity - 1,
                        })}
                      </div>
                    </div>
                    {s.status === "cancelled" ? (
                      <span className="badge">{t("cancelled")}</span>
                    ) : (
                      <>
                        <Link
                          href={`/session/${s.id}`}
                          className="button secondary small"
                        >
                          {t("open")}
                        </Link>
                        {s.status === "scheduled" && <CancelHosted id={s.id} />}
                      </>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted small">{t("noneScheduled")}</p>
            )}
          </section>
        </>
      )}
    </AppShell>
  );
}
