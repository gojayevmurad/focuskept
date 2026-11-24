// SPDX-License-Identifier: AGPL-3.0-only
import { getFormatter, getTranslations } from "next-intl/server";
import { CircleCheck, HeartHandshake } from "lucide-react";
import { AppShell } from "@/src/components/app-shell";
import { Avatar } from "@/src/components/avatar";
import { requireAppUser } from "@/src/lib/app-user";
import {
  completedCount,
  getHost,
  hostedSessions,
  peopleHelped,
} from "@/src/lib/hosts";
import { getEnv } from "@/src/config/env";
import { getAppConfig } from "@/src/config/app";
import { Link } from "@/src/i18n/navigation";
import { CopyLink } from "@/src/components/copy-link";
import { ApplyForm, CancelHosted, ScheduleForm } from "./forms";
import styles from "./hosting.module.css";

export async function generateMetadata() {
  return { title: (await getTranslations("hosting"))("title") };
}
export default async function Page() {
  const { user, profile } = await requireAppUser();
  const [t, format, h, done, helped] = await Promise.all([
    getTranslations("hosting"),
    getFormatter(),
    getHost(user.id),
    completedCount(user.id),
    peopleHelped(user.id),
  ]);
  const env = getEnv();
  const app = getAppConfig();
  const approved = h?.status === "approved";
  const sessions = approved ? await hostedSessions(user.id) : [];
  return (
    <AppShell title={t("title")}>
      <div className={styles.page}>
        <header className={styles.hero}>
          <div>
            <HeartHandshake size={32} aria-hidden="true" />
            <h1>{t("hubTitle")}</h1>
            <p className="lead">{t("hubLead")}</p>
            <a
              className="button"
              href={approved ? "#schedule" : "#application"}
            >
              {t(approved ? "schedule" : "applyTitle")}
            </a>
          </div>
          <div className={styles.hostIdentity}>
            <Avatar
              name={profile.displayName}
              src={profile.avatarUrl}
              size="lg"
            />
            <strong>{profile.displayName}</strong>
            <span className="badge">
              <CircleCheck size={14} aria-hidden="true" />
              {t(approved ? "readyToHost" : "futureHost")}
            </span>
            <p className="small muted">{t("hostRole")}</p>
          </div>
        </header>
        <div className={styles.layout}>
          <div className="stack">
            {approved ? (
              <>
                <section className={styles.stats} aria-label={t("yourImpact")}>
                  <div>
                    <strong>{format.number(h.sessionsHosted)}</strong>
                    <span>{t("hosted")}</span>
                  </div>
                  <div>
                    <strong>{format.number(helped)}</strong>
                    <span>{t("peopleHelped")}</span>
                  </div>
                  {h.rating !== null && (
                    <div>
                      <strong>
                        {format.number(h.rating, { maximumFractionDigits: 1 })}
                        /5
                      </strong>
                      <span>{t("ratings", { n: h.ratingsCount })}</span>
                    </div>
                  )}
                </section>
                <section className="card stack">
                  <h2>{t("upcoming")}</h2>
                  {sessions.length ? (
                    sessions.map((s) => (
                      <article className={styles.session} key={s.id}>
                        <h3>{s.title}</h3>
                        <p className="small muted">
                          {format.dateTime(s.startAt, {
                            timeZone: profile.timezone,
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}{" "}
                          · {t("minutes", { count: s.durationMin })}
                        </p>
                        <div className={styles.attendees}>
                          {s.attendees.slice(0, 8).map((p, index) => (
                            <span key={index} title={p.name}>
                              <Avatar
                                name={p.name}
                                src={p.avatarUrl}
                                size="sm"
                              />
                            </span>
                          ))}
                          <span className="small muted">
                            {t("seats", {
                              taken: s.attendees.length,
                              capacity: s.capacity - 1,
                            })}
                          </span>
                        </div>
                        <div className="row">
                          <Link
                            className="button secondary"
                            href={`/session/${s.id}`}
                          >
                            {t("open")}
                          </Link>
                          {s.status === "scheduled" && (
                            <CancelHosted id={s.id} />
                          )}
                        </div>
                      </article>
                    ))
                  ) : (
                    <div>
                      <p className="muted">{t("noneScheduled")}</p>
                      <a className="button secondary" href="#schedule">
                        {t("schedule")}
                      </a>
                    </div>
                  )}
                </section>
                <section className="card stack" id="schedule">
                  <h2>{t("scheduleTitle")}</h2>
                  <p className="muted small">{t("scheduleHelp")}</p>
                  <ScheduleForm timeZone={profile.timezone} />
                </section>
              </>
            ) : (
              <section className="card stack" id="application">
                <h2>{t("applyTitle")}</h2>
                {h?.status === "applied" ? (
                  <>
                    <span className="badge">{t("pendingTitle")}</span>
                    <p className="muted">{t("pendingLead")}</p>
                  </>
                ) : h?.status === "suspended" ? (
                  <p className="notice warn">{t("suspended")}</p>
                ) : done >= env.HOST_MIN_SESSIONS ? (
                  <ApplyForm />
                ) : (
                  <>
                    <p className="muted">
                      {t("notYet", { needed: env.HOST_MIN_SESSIONS, done })}
                    </p>
                    <progress
                      className={styles.progress}
                      value={Math.min(done, env.HOST_MIN_SESSIONS)}
                      max={Math.max(1, env.HOST_MIN_SESSIONS)}
                      aria-label={t("eligibility")}
                    />
                    <Link href="/book" className="button secondary">
                      {t("bookNext")}
                    </Link>
                  </>
                )}
              </section>
            )}
          </div>
          <aside className="stack">
            {approved ? (
              <section className="card stack">
                <h2>{t("yourPage")}</h2>
                <p className="small muted">{t("sharePageHelp")}</p>
                <CopyLink
                  value={`${app.url.replace(/\/$/, "")}/host/${profile.username}`}
                />
                <Link href={`/host/${profile.username}`}>
                  {t("previewPage")}
                </Link>
                {app.billingEnabled && (
                  <p className="small muted">
                    {t("lead", { n: env.HOST_PERK_SESSIONS })}
                  </p>
                )}
              </section>
            ) : (
              <section className="card stack">
                <h2>{t("stepsTitle")}</h2>
                <ol className={styles.steps}>
                  {["experience", "apply", "welcome"].map((step) => (
                    <li key={step}>
                      <strong>{t(`steps.${step}.title`)}</strong>
                      <p className="small muted">
                        {t(`steps.${step}.body`, {
                          needed: env.HOST_MIN_SESSIONS,
                        })}
                      </p>
                    </li>
                  ))}
                </ol>
              </section>
            )}
            <section className={`card stack ${styles.tips}`}>
              <h2>{t("tipsTitle")}</h2>
              {["welcome", "quiet", "wrap"].map((tip) => (
                <div key={tip}>
                  <h3>{t(`tips.${tip}.title`)}</h3>
                  <p className="small muted">{t(`tips.${tip}.body`)}</p>
                </div>
              ))}
            </section>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
