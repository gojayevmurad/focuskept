// SPDX-License-Identifier: AGPL-3.0-only
import type { Metadata } from "next";
import styles from "@/app/[locale]/(app)/lanes.module.css";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { AppShell } from "@/src/components/app-shell";
import { Avatar } from "@/src/components/avatar";
import { requireAppUser } from "@/src/lib/app-user";
import {
  getChallengeBySlug,
  isMember,
  leaderboard,
} from "@/src/lib/challenges";
import { JoinChallenge } from "../join-button";

export const metadata: Metadata = { title: "Challenge" };

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { user, profile } = await requireAppUser();
  const c = await getChallengeBySlug(slug);
  if (!c) notFound();
  const t = await getTranslations("challenges");
  const format = await getFormatter();
  const [board, joined] = await Promise.all([
    leaderboard(c),
    isMember(c.id, user.id),
  ]);
  const target = c.goalType === "minutes" ? c.goalValue : c.goalValue;
  const unit = (v: number) =>
    c.goalType === "minutes"
      ? t("hoursValue", { value: Math.round((v / 60) * 10) / 10 })
      : t("sessionsValue", { value: v });
  return (
    <AppShell title={c.title}>
      <div className={styles.page}>
        <div className="row-between">
          <div className="page-title">
            <h1>{c.title}</h1>
            <p className="muted">
              {format.dateTimeRange(c.startsAt, c.endsAt, {
                timeZone: profile.timezone,
                month: "long",
                day: "numeric",
              })}{" "}
              ·{" "}
              {t(`goal.${c.goalType}`, {
                value:
                  c.goalType === "minutes"
                    ? Math.round(c.goalValue / 60)
                    : c.goalValue,
              })}
            </p>
          </div>
          <JoinChallenge
            id={c.id}
            joined={joined}
            ended={c.endsAt <= new Date()}
          />
        </div>
        {c.description && <p className="lead">{c.description}</p>}
        <section className="card stack">
          <h2>{t("leaderboard")}</h2>
          {board.length ? (
            <div className="list">
              {board.map((row, i) => (
                <div
                  key={row.userId}
                  className="list-item"
                  style={
                    row.userId === user.id
                      ? {
                          background: "var(--accent-soft)",
                          borderRadius: 10,
                          padding: "12px 10px",
                        }
                      : undefined
                  }
                >
                  <span className="mono tabular" style={{ width: 28 }}>
                    {i + 1}
                  </span>
                  <Avatar name={row.name} src={row.avatarUrl} size="sm" />
                  <span className="grow">{row.name}</span>
                  <span className="small muted">{unit(row.score)}</span>
                  {row.score >= target && (
                    <span className="badge ok">{t("reached")}</span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="muted small">{t("empty")}</p>
          )}
        </section>
      </div>
    </AppShell>
  );
}
