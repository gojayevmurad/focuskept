// SPDX-License-Identifier: AGPL-3.0-only

export type UserLifecycleState = {
  emailTips: boolean;
  suspendedAt: Date | null;
  onboardedAt: Date | null;
  createdAt: Date;
  timezone: string;
};

export function getLocalTimeParts(date: Date, timeZone: string) {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "numeric",
      hour12: false,
    });
    const parts = formatter.formatToParts(date);
    const getPart = (type: string) =>
      parts.find((p) => p.type === type)?.value ?? "";
    const weekday = getPart("weekday"); // "Mon", "Tue", etc.
    const rawHour = parseInt(getPart("hour"), 10);
    const hour = Number.isNaN(rawHour) ? 0 : rawHour % 24;
    const year = getPart("year");
    const month = getPart("month");
    const day = getPart("day");
    return {
      weekday,
      hour,
      year,
      month,
      day,
      dateKey: `${year}-${month}-${day}`,
    };
  } catch {
    // Fallback to UTC if timezone is invalid
    const weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return {
      weekday: weekdayNames[date.getUTCDay()],
      hour: date.getUTCHours(),
      year: String(date.getUTCFullYear()),
      month: String(date.getUTCMonth() + 1).padStart(2, "0"),
      day: String(date.getUTCDate()).padStart(2, "0"),
      dateKey: date.toISOString().slice(0, 10),
    };
  }
}

/**
 * Welcome email: sent right after onboarding completion.
 */
export function shouldSendWelcome(user: {
  emailTips: boolean;
  suspendedAt: Date | null;
  onboardedAt: Date | null;
}): boolean {
  if (!user.emailTips || user.suspendedAt) return false;
  return Boolean(user.onboardedAt);
}

/**
 * Nudge first booking: sent 24h after signup if no booking made yet.
 */
export function shouldSendNudgeFirstBooking(
  user: {
    emailTips: boolean;
    suspendedAt: Date | null;
    createdAt: Date;
  },
  totalBookings: number,
  now: Date,
): boolean {
  if (!user.emailTips || user.suspendedAt) return false;
  if (totalBookings > 0) return false;
  const elapsedMs = now.getTime() - user.createdAt.getTime();
  return elapsedMs >= 24 * 3600_000;
}

/**
 * First session tips: sent ~1 hour before the user's very first session.
 * Does not conflict with the 10-minute session reminder.
 */
export function shouldSendFirstSessionTips(
  user: {
    emailTips: boolean;
    suspendedAt: Date | null;
  },
  booking: {
    startAt: Date;
    status: string;
  },
  priorCompletedCount: number,
  now: Date,
): boolean {
  if (!user.emailTips || user.suspendedAt) return false;
  if (priorCompletedCount > 0) return false;
  if (!["booked", "matched"].includes(booking.status)) return false;

  const msUntilStart = booking.startAt.getTime() - now.getTime();
  // Within 65 minutes of start, and at least 15 minutes before start (avoiding 10m reminder window)
  return msUntilStart > 15 * 60_000 && msUntilStart <= 65 * 60_000;
}

/**
 * After first session: sent the next morning (08:00+ local time) after first session.
 */
export function shouldSendAfterFirstSession(
  user: {
    emailTips: boolean;
    suspendedAt: Date | null;
    timezone: string;
  },
  firstCompletedAt: Date,
  now: Date,
): boolean {
  if (!user.emailTips || user.suspendedAt) return false;

  const completedLocal = getLocalTimeParts(firstCompletedAt, user.timezone);
  const nowLocal = getLocalTimeParts(now, user.timezone);

  // Must be at least the next day, and in the morning (hour >= 8)
  const isPastDay = nowLocal.dateKey > completedLocal.dateKey;
  const isMorning = nowLocal.hour >= 8;

  return isPastDay && isMorning;
}

/**
 * Win-back: sent after 14 days without a session for users who completed at least one.
 * Limited to once every 60 days.
 */
export function shouldSendWinBack(
  user: {
    emailTips: boolean;
    suspendedAt: Date | null;
  },
  lastCompletedAt: Date | null,
  hasActiveUpcomingBooking: boolean,
  lastWinBackSentAt: Date | null,
  now: Date,
): boolean {
  if (!user.emailTips || user.suspendedAt) return false;
  if (!lastCompletedAt) return false;
  if (hasActiveUpcomingBooking) return false;

  const daysSinceSession =
    (now.getTime() - lastCompletedAt.getTime()) / (24 * 3600_000);
  if (daysSinceSession < 14) return false;

  if (lastWinBackSentAt) {
    const daysSinceLastWinBack =
      (now.getTime() - lastWinBackSentAt.getTime()) / (24 * 3600_000);
    if (daysSinceLastWinBack < 60) return false;
  }

  return true;
}

/**
 * Weekly summary: sent on Mondays at 08:00 in the user's timezone.
 */
export function shouldSendWeeklySummary(
  user: {
    emailTips: boolean;
    suspendedAt: Date | null;
    timezone: string;
  },
  now: Date,
): { due: boolean; weekKey: string } {
  const local = getLocalTimeParts(now, user.timezone);
  const weekKey = local.dateKey; // YYYY-MM-DD of Monday

  if (!user.emailTips || user.suspendedAt) {
    return { due: false, weekKey };
  }

  // Check if it's Monday between 08:00 and 08:59 in user's timezone
  const isMondayMorning = local.weekday === "Mon" && local.hour === 8;
  return { due: isMondayMorning, weekKey };
}
