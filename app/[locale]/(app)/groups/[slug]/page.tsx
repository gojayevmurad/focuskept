// SPDX-License-Identifier: AGPL-3.0-only
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, gt, inArray } from "drizzle-orm";
import { getFormatter, getTranslations } from "next-intl/server";
import { AppShell } from "@/src/components/app-shell";
import { Avatar } from "@/src/components/avatar";
import { CopyLink } from "@/src/components/copy-link";
import { requireAppUser } from "@/src/lib/app-user";
import { getCommunity, members, membership } from "@/src/lib/community";
import { db } from "@/src/lib/db";
import { booking } from "@/src/lib/db/schema";
import { getAppConfig } from "@/src/config/app";
import { Link } from "@/src/i18n/navigation";
import { MemberActions } from "../forms";

export const metadata: Metadata = { title: "Group" };

/** Bookings closer than this can't be joined anymore. */
function soon() {
  return new Date(Date.now() + 3 * 60_000);
}

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { user, profile } = await requireAppUser();
  const group = await getCommunity(slug);
  if (!group) notFound();
  const me = await membership(group.id, user.id);
  if (!me) notFound();
  const t = await getTranslations("groups");
  const format = await getFormatter();
  const app = getAppConfig();
  const list = await members(group.id);
  const upcoming = await db()
    .select({
      userId: booking.userId,
      startAt: booking.startAt,
      durationMin: booking.durationMin,
    })
    .from(booking)
    .where(
      and(
        inArray(
          booking.userId,
          list.map((m) => m.userId),
        ),
        inArray(booking.status, ["booked"]),
        gt(booking.startAt, soon()),
      ),
    )
    .orderBy(booking.startAt)
    .limit(12);
  const nameOf = new Map(list.map((m) => [m.userId, m]));
  const manager = me.role !== "member";
  const licensed =
    group.licenseUntil &&
    group.licenseUntil > new Date() &&
    group.plusSeats > 0;
  return (
    <AppShell title={group.name}>
      <div className="row-between">
        <div className="page-title">
          <h1>{group.name}</h1>
          <p className="muted">
            {t(`kinds.${group.kind}`)} ·{" "}
            {t("memberCount", { count: list.length })}
          </p>
        </div>
        {me.role !== "owner" && (
          <MemberActions communityId={group.id} kind="leave" />
        )}
      </div>
      {group.description && <p className="lead">{group.description}</p>}
      {licensed && (
        <p className="notice ok">
          {t("licensed", {
            seats: group.plusSeats,
            date: format.dateTime(group.licenseUntil!, { dateStyle: "medium" }),
          })}
        </p>
      )}
      <section className="card stack">
        <h2>{t("invite")}</h2>
        <p className="muted small">{t("inviteLead")}</p>
        <CopyLink value={`${app.url}/groups/join/${group.joinCode}`} />
        {manager && (
          <div>
            <MemberActions communityId={group.id} kind="rotate" />
          </div>
        )}
      </section>
      <section className="card stack">
        <h2>{t("upcoming")}</h2>
        <p className="muted small">{t("upcomingLead")}</p>
        {upcoming.filter((u) => u.userId !== user.id).length ? (
          <div className="list">
            {upcoming
              .filter((u) => u.userId !== user.id)
              .map((u) => {
                const m = nameOf.get(u.userId)!;
                return (
                  <div
                    key={`${u.userId}-${u.startAt.toISOString()}`}
                    className="list-item"
                  >
                    <Avatar name={m.name} src={m.avatarUrl} size="sm" />
                    <span className="grow">
                      <strong>{m.name}</strong>
                      <span className="small muted">
                        {" "}
                        ·{" "}
                        {format.dateTime(u.startAt, {
                          timeZone: profile.timezone,
                          weekday: "short",
                          hour: "numeric",
                          minute: "2-digit",
                        })}{" "}
                        · {u.durationMin} min
                      </span>
                    </span>
                    <Link
                      className="button small"
                      href={`/book?start=${encodeURIComponent(u.startAt.toISOString())}&duration=${u.durationMin}&with=${m.username}`}
                    >
                      {t("joinThem")}
                    </Link>
                  </div>
                );
              })}
          </div>
        ) : (
          <p className="small faint">{t("noUpcoming")}</p>
        )}
      </section>
      <section className="card stack">
        <h2>{t("members")}</h2>
        <div className="list">
          {list.map((m) => (
            <div key={m.userId} className="list-item">
              <Avatar name={m.name} src={m.avatarUrl} size="sm" />
              <span className="grow">{m.name}</span>
              {m.role !== "member" && (
                <span className="badge">{t(`roles.${m.role}`)}</span>
              )}
              {manager && m.role === "member" && (
                <MemberActions
                  communityId={group.id}
                  userId={m.userId}
                  kind="remove"
                />
              )}
            </div>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
