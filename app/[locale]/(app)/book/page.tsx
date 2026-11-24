// SPDX-License-Identifier: AGPL-3.0-only
import type { Metadata } from "next";
import { and, eq, gte, inArray, lt } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/src/components/app-shell";
import { requireAppUser } from "@/src/lib/app-user";
import { db } from "@/src/lib/db";
import {
  booking,
  favorite,
  focusSession,
  profile,
  sessionParticipant,
} from "@/src/lib/db/schema";
import { getPlan, weeklyUsage } from "@/src/lib/billing/plan";
import {
  groupSessionsBetween,
  slotDemand,
} from "@/src/lib/bookings/availability";
import {
  addMinutes,
  isPopularSlot,
  localDayStart,
  popularZonesFor,
  weekGrid,
} from "@/src/lib/scheduling/slots";
import { sessionLabel } from "@/src/lib/sessions/label";
import { getAppConfig } from "@/src/config/app";
import { Calendar, type CalendarData } from "./calendar";

export const metadata: Metadata = { title: "Book" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ start?: string; with?: string; duration?: string }>;
}) {
  const { user, profile: me } = await requireAppUser();
  const t = await getTranslations("book");
  const labels = await getTranslations("sessionLabels");
  const params = await searchParams;
  const tz = me.timezone;
  const now = new Date();
  const requested = params.start ? new Date(params.start) : now;
  const anchor =
    Number.isNaN(requested.getTime()) || requested < now ? now : requested;
  const first = localDayStart(anchor, tz);
  const grid = weekGrid(first, tz, 7);
  const from = grid[0].start;
  const to = addMinutes(grid.at(-1)!.slots.at(-1)!, 30);

  const [demand, mine, groups, plan, favs] = await Promise.all([
    slotDemand(from, to, user.id),
    db()
      .select({
        id: booking.id,
        startAt: booking.startAt,
        durationMin: booking.durationMin,
        status: booking.status,
        kind: booking.kind,
        sessionId: booking.sessionId,
        preferredPartnerId: booking.preferredPartnerId,
        fallbackOfferedAt: booking.fallbackOfferedAt,
        isFallbackRoom: focusSession.isFallbackRoom,
        title: focusSession.title,
      })
      .from(booking)
      .leftJoin(focusSession, eq(focusSession.id, booking.sessionId))
      .where(
        and(
          eq(booking.userId, user.id),
          inArray(booking.status, ["booked", "matched"]),
          gte(booking.startAt, addMinutes(from, -75)),
          lt(booking.startAt, to),
        ),
      ),
    groupSessionsBetween(from, to),
    getPlan(user.id),
    db()
      .select({ username: profile.username, displayName: profile.displayName })
      .from(favorite)
      .innerJoin(profile, eq(profile.userId, favorite.partnerId))
      .where(eq(favorite.userId, user.id)),
  ]);
  // Partner names for matched pair sessions.
  const sessionIds = mine
    .map((b) => b.sessionId)
    .filter((x): x is string => Boolean(x));
  const partners = sessionIds.length
    ? await db()
        .select({
          sessionId: sessionParticipant.sessionId,
          userId: sessionParticipant.userId,
          name: profile.displayName,
          joinedAt: sessionParticipant.joinedAt,
        })
        .from(sessionParticipant)
        .innerJoin(profile, eq(profile.userId, sessionParticipant.userId))
        .where(inArray(sessionParticipant.sessionId, sessionIds))
    : [];
  const usage = plan.plan === "free" ? await weeklyUsage(user.id, tz) : null;
  // The shown days can span two weeks; the free limit applies per week.
  const usedByDay: Record<string, number> = {};
  if (usage) {
    for (const d of grid)
      usedByDay[d.key] = (await weeklyUsage(user.id, tz, d.start)).used;
  }
  const app = getAppConfig();

  const data: CalendarData = {
    timeZone: tz,
    now: now.toISOString(),
    days: grid.map((d) => ({
      key: d.key,
      start: d.start.toISOString(),
      slots: d.slots.map((s) => {
        const key = s.toISOString();
        return {
          at: key,
          demand: demand.get(key) ?? {},
          popular: isPopularSlot(s, popularZonesFor(tz)),
        };
      }),
    })),
    mine: mine.map((b) => ({
      id: b.id,
      startAt: b.startAt.toISOString(),
      durationMin: b.durationMin,
      status: b.status,
      kind: b.kind,
      sessionId: b.sessionId,
      fallbackOffered: Boolean(b.fallbackOfferedAt),
      label:
        b.status === "matched" && (b.kind === "group" || b.isFallbackRoom)
          ? sessionLabel(
              {
                isFallbackRoom: Boolean(b.isFallbackRoom),
                type: b.kind,
                title: b.title,
              },
              partners
                .filter(
                  (p) => p.sessionId === b.sessionId && p.userId !== user.id,
                )
                .map((p) => ({ name: p.name, joined: Boolean(p.joinedAt) })),
              labels,
            )
          : null,
      partner:
        partners.find(
          (p) => p.sessionId === b.sessionId && p.userId !== user.id,
        )?.name ?? null,
    })),
    groups: groups.map((g) => ({
      id: g.id,
      startAt: g.startAt.toISOString(),
      durationMin: g.durationMin,
      title: g.title,
      taken: g.taken,
      capacity: g.capacity,
      hostName: g.hostName,
      joined: mine.some((b) => b.sessionId === g.id),
    })),
    favorites: plan.plan === "plus" ? favs : [],
    plan: plan.plan,
    billingEnabled: app.billingEnabled,
    usage: usage ? { used: usage.used, limit: usage.limit } : null,
    usedByDay,
    prefill: {
      start: params.start ?? null,
      partner: params.with ?? null,
      duration: Number(params.duration) || null,
    },
    prevWeek:
      first > now ? addMinutes(first, -7 * 24 * 60).toISOString() : null,
    nextWeek: addMinutes(first, 7 * 24 * 60).toISOString(),
  };
  return (
    <AppShell title={t("title")}>
      <Calendar data={data} />
    </AppShell>
  );
}
