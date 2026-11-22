// SPDX-License-Identifier: AGPL-3.0-only
import "server-only";
import { and, eq, gte, inArray, isNotNull, isNull, lt, lte, notExists, sql } from "drizzle-orm";
import { db } from "@/src/lib/db";
import { booking, notificationLog, profile, user } from "@/src/lib/db/schema";
import { getAppConfig } from "@/src/config/app";
import { once, formatWhen } from "@/src/lib/notifications";
import { suggestedSlots } from "@/src/lib/bookings/availability";
import { logger } from "@/src/lib/logger";
import {
  shouldSendAfterFirstSession,
  shouldSendFirstSessionTips,
  shouldSendNudgeFirstBooking,
  shouldSendWeeklySummary,
  shouldSendWelcome,
  shouldSendWinBack,
} from "./decisions";
import { renderLifecycleEmail } from "./templates";
import { sendLifecycleEmail } from "./send";

async function getUserRecipient(userId: string) {
  const [row] = await db()
    .select({
      userId: profile.userId,
      email: user.email,
      name: profile.displayName,
      locale: profile.locale,
      timezone: profile.timezone,
      emailTips: profile.emailTips,
      suspendedAt: profile.suspendedAt,
      onboardedAt: profile.onboardedAt,
      createdAt: user.createdAt,
    })
    .from(profile)
    .innerJoin(user, eq(user.id, profile.userId))
    .where(eq(profile.userId, userId));
  return row ?? null;
}

export async function sendWelcomeEmail(userId: string) {
  const r = await getUserRecipient(userId);
  if (!r || !shouldSendWelcome(r)) return false;

  return once(r.userId, "welcome", r.userId, "email", async () => {
    const email = await renderLifecycleEmail("welcome", r);
    await sendLifecycleEmail(email);
  });
}

export async function sendNudgeFirstBooking(userId: string, now = new Date()) {
  const r = await getUserRecipient(userId);
  if (!r) return false;

  const [{ count }] = await db()
    .select({ count: sql<number>`count(*)::int` })
    .from(booking)
    .where(eq(booking.userId, userId));

  if (!shouldSendNudgeFirstBooking(r, count, now)) return false;

  return once(r.userId, "nudge_first_booking", r.userId, "email", async () => {
    const email = await renderLifecycleEmail("nudge_first_booking", r);
    await sendLifecycleEmail(email);
  });
}

export async function sendFirstSessionTips(bookingId: string, now = new Date()) {
  const [b] = await db()
    .select({
      id: booking.id,
      userId: booking.userId,
      startAt: booking.startAt,
      status: booking.status,
      sessionId: booking.sessionId,
    })
    .from(booking)
    .where(eq(booking.id, bookingId));
  if (!b) return false;

  const r = await getUserRecipient(b.userId);
  if (!r) return false;

  const [{ priorCount }] = await db()
    .select({ priorCount: sql<number>`count(*)::int` })
    .from(booking)
    .where(
      and(
        eq(booking.userId, b.userId),
        eq(booking.status, "completed"),
      ),
    );

  if (!shouldSendFirstSessionTips(r, b, priorCount, now)) return false;

  const app = getAppConfig();
  const bookingUrl = b.sessionId
    ? `${app.url}/session/${b.sessionId}`
    : `${app.url}/dashboard`;

  return once(r.userId, "first_session_tips", b.id, "email", async () => {
    const email = await renderLifecycleEmail("first_session_tips", r, {
      bookingUrl,
    });
    await sendLifecycleEmail(email);
  });
}

export async function sendAfterFirstSession(userId: string, now = new Date()) {
  const r = await getUserRecipient(userId);
  if (!r) return false;

  const [firstCompleted] = await db()
    .select({ startAt: booking.startAt })
    .from(booking)
    .where(
      and(
        eq(booking.userId, userId),
        eq(booking.status, "completed"),
      ),
    )
    .orderBy(booking.startAt)
    .limit(1);

  if (!firstCompleted || !shouldSendAfterFirstSession(r, firstCompleted.startAt, now)) {
    return false;
  }

  return once(r.userId, "after_first_session", r.userId, "email", async () => {
    const email = await renderLifecycleEmail("after_first_session", r);
    await sendLifecycleEmail(email);
  });
}

export async function sendWinBack(userId: string, now = new Date()) {
  const r = await getUserRecipient(userId);
  if (!r) return false;

  const [latestCompleted] = await db()
    .select({ startAt: booking.startAt })
    .from(booking)
    .where(
      and(
        eq(booking.userId, userId),
        eq(booking.status, "completed"),
      ),
    )
    .orderBy(sql`${booking.startAt} desc`)
    .limit(1);

  if (!latestCompleted) return false;

  const [upcoming] = await db()
    .select({ id: booking.id })
    .from(booking)
    .where(
      and(
        eq(booking.userId, userId),
        inArray(booking.status, ["booked", "matched"]),
        gte(booking.startAt, now),
      ),
    )
    .limit(1);

  const [lastWinBack] = await db()
    .select({ createdAt: notificationLog.createdAt })
    .from(notificationLog)
    .where(
      and(
        eq(notificationLog.userId, userId),
        eq(notificationLog.kind, "win_back"),
      ),
    )
    .orderBy(sql`${notificationLog.createdAt} desc`)
    .limit(1);

  if (
    !shouldSendWinBack(
      r,
      latestCompleted.startAt,
      Boolean(upcoming),
      lastWinBack?.createdAt ?? null,
      now,
    )
  ) {
    return false;
  }

  const cycleKey = `${r.userId}:${now.getUTCFullYear()}-${Math.floor(now.getUTCMonth() / 2)}`;
  return once(r.userId, "win_back", cycleKey, "email", async () => {
    const email = await renderLifecycleEmail("win_back", r);
    await sendLifecycleEmail(email);
  });
}

export async function sendWeeklySummary(userId: string, now = new Date()) {
  const r = await getUserRecipient(userId);
  if (!r) return false;

  const { due, weekKey } = shouldSendWeeklySummary(r, now);
  if (!due) return false;

  const refId = `${r.userId}:${weekKey}`;

  return once(r.userId, "weekly_summary", refId, "email", async () => {
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 3600_000);
    const [stats] = await db()
      .select({
        sessions: sql<number>`count(*)::int`,
        durationMinutes: sql<number>`coalesce(sum(${booking.durationMin}), 0)::int`,
      })
      .from(booking)
      .where(
        and(
          eq(booking.userId, r.userId),
          eq(booking.status, "completed"),
          gte(booking.startAt, sevenDaysAgo),
          lt(booking.startAt, now),
        ),
      );

    const hours = Math.round((stats?.durationMinutes ?? 0) / 60);

    const [nextBooking] = await db()
      .select({ startAt: booking.startAt })
      .from(booking)
      .where(
        and(
          eq(booking.userId, r.userId),
          inArray(booking.status, ["booked", "matched"]),
          gte(booking.startAt, now),
        ),
      )
      .orderBy(booking.startAt)
      .limit(1);

    const nextBookingFormatted = nextBooking
      ? formatWhen(nextBooking.startAt, r.timezone, r.locale)
      : null;

    let suggestedSlotFormatted: string | null = null;
    try {
      const slots = await suggestedSlots(r.userId, 50, now, 1, r.timezone);
      if (slots.length > 0) {
        suggestedSlotFormatted = formatWhen(slots[0].startAt, r.timezone, r.locale);
      }
    } catch {}

    const email = await renderLifecycleEmail("weekly_summary", r, {
      sessionStats: { sessions: stats?.sessions ?? 0, hours },
      nextBookingFormatted,
      suggestedSlotFormatted,
    });
    await sendLifecycleEmail(email);
  });
}

/**
 * Worker tick processor: checks and sends pending lifecycle emails.
 * Idempotent via notification_log.
 */
export async function processLifecycleEmails(now = new Date()): Promise<number> {
  let sent = 0;

  // 1. Welcome emails
  try {
    const welcomeCandidates = await db()
      .select({ userId: profile.userId })
      .from(profile)
      .where(
        and(
          isNotNull(profile.onboardedAt),
          isNull(profile.suspendedAt),
          eq(profile.emailTips, true),
          notExists(
            db()
              .select()
              .from(notificationLog)
              .where(
                and(
                  eq(notificationLog.userId, profile.userId),
                  eq(notificationLog.kind, "welcome"),
                  eq(notificationLog.refId, profile.userId),
                ),
              ),
          ),
        ),
      )
      .limit(10);

    for (const c of welcomeCandidates) {
      if (await sendWelcomeEmail(c.userId)) sent++;
    }
  } catch (err) {
    logger.warn({ err }, "Failed checking welcome emails");
  }

  // 2. Nudge first booking (24h after signup, no bookings yet)
  try {
    const cutoff24h = new Date(now.getTime() - 24 * 3600_000);
    const nudgeCandidates = await db()
      .select({ userId: profile.userId })
      .from(profile)
      .innerJoin(user, eq(user.id, profile.userId))
      .where(
        and(
          lte(user.createdAt, cutoff24h),
          isNull(profile.suspendedAt),
          eq(profile.emailTips, true),
          notExists(
            db()
              .select()
              .from(booking)
              .where(eq(booking.userId, profile.userId)),
          ),
          notExists(
            db()
              .select()
              .from(notificationLog)
              .where(
                and(
                  eq(notificationLog.userId, profile.userId),
                  eq(notificationLog.kind, "nudge_first_booking"),
                  eq(notificationLog.refId, profile.userId),
                ),
              ),
          ),
        ),
      )
      .limit(10);

    for (const c of nudgeCandidates) {
      if (await sendNudgeFirstBooking(c.userId, now)) sent++;
    }
  } catch (err) {
    logger.warn({ err }, "Failed checking first booking nudges");
  }

  // 3. First session tips (~1h before first session)
  try {
    const windowStart = new Date(now.getTime() + 15 * 60_000);
    const windowEnd = new Date(now.getTime() + 65 * 60_000);
    const tipsCandidates = await db()
      .select({ bookingId: booking.id, userId: booking.userId })
      .from(booking)
      .innerJoin(profile, eq(profile.userId, booking.userId))
      .where(
        and(
          gte(booking.startAt, windowStart),
          lte(booking.startAt, windowEnd),
          inArray(booking.status, ["booked", "matched"]),
          isNull(profile.suspendedAt),
          eq(profile.emailTips, true),
          notExists(
            db()
              .select()
              .from(notificationLog)
              .where(
                and(
                  eq(notificationLog.userId, booking.userId),
                  eq(notificationLog.kind, "first_session_tips"),
                ),
              ),
          ),
        ),
      )
      .limit(10);

    for (const c of tipsCandidates) {
      if (await sendFirstSessionTips(c.bookingId, now)) sent++;
    }
  } catch (err) {
    logger.warn({ err }, "Failed checking first session tips");
  }

  // 4. After first session (next morning after first completed session)
  try {
    const afterCandidates = await db()
      .select({ userId: profile.userId })
      .from(profile)
      .where(
        and(
          isNull(profile.suspendedAt),
          eq(profile.emailTips, true),
          notExists(
            db()
              .select()
              .from(notificationLog)
              .where(
                and(
                  eq(notificationLog.userId, profile.userId),
                  eq(notificationLog.kind, "after_first_session"),
                ),
              ),
          ),
        ),
      )
      .limit(10);

    for (const c of afterCandidates) {
      if (await sendAfterFirstSession(c.userId, now)) sent++;
    }
  } catch (err) {
    logger.warn({ err }, "Failed checking after first session emails");
  }

  // 5. Win back (14 days without session, once per 60 days)
  try {
    const winBackCandidates = await db()
      .select({ userId: profile.userId })
      .from(profile)
      .where(
        and(
          isNull(profile.suspendedAt),
          eq(profile.emailTips, true),
        ),
      )
      .limit(10);

    for (const c of winBackCandidates) {
      if (await sendWinBack(c.userId, now)) sent++;
    }
  } catch (err) {
    logger.warn({ err }, "Failed checking win-back emails");
  }

  // 6. Weekly summary (Monday 08:00 in user's timezone)
  try {
    const weeklyCandidates = await db()
      .select({ userId: profile.userId })
      .from(profile)
      .where(
        and(
          isNull(profile.suspendedAt),
          eq(profile.emailTips, true),
        ),
      )
      .limit(20);

    for (const c of weeklyCandidates) {
      if (await sendWeeklySummary(c.userId, now)) sent++;
    }
  } catch (err) {
    logger.warn({ err }, "Failed checking weekly summaries");
  }

  return sent;
}
