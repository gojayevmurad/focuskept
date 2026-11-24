// SPDX-License-Identifier: AGPL-3.0-only
import "server-only";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "@/src/lib/db";
import { booking, profile } from "@/src/lib/db/schema";
import { weekBounds } from "@/src/lib/scheduling/slots";
import { FOCUS_AREAS, BLOCKERS, PREFERRED_TIMES } from "./onboarding";

/** Shared by the dashboard and booking's later preference integration. */
export async function getFocusPreferences(userId: string, now = new Date()) {
  const [row] = await db().select({ focusAreas: profile.focusAreas, blockers: profile.blockers,
    preferredTimes: profile.preferredTimes, defaultDuration: profile.defaultDuration,
    weeklyGoal: profile.weeklyGoal, sessionStyle: profile.sessionStyle,
    microphoneDefault: profile.microphoneDefault, timezone: profile.timezone,
  }).from(profile).where(eq(profile.userId, userId));
  if (!row) return null;
  const { start, end } = weekBounds(now, row.timezone);
  const [progress] = await db().select({ count: sql<number>`count(*)::int` }).from(booking).where(and(
    eq(booking.userId, userId), eq(booking.status, "completed"), gte(booking.startAt, start), lt(booking.startAt, end),
  ));
  return { ...row,
    focusAreas: FOCUS_AREAS.filter((area) => row.focusAreas.includes(area)),
    blockers: BLOCKERS.filter((blocker) => row.blockers.includes(blocker)),
    preferredTimes: PREFERRED_TIMES.filter((time) => row.preferredTimes.includes(time)),
    defaultDuration: ([25, 50, 75].includes(row.defaultDuration) ? row.defaultDuration : 50) as 25 | 50 | 75,
    completedThisWeek: progress?.count ?? 0,
  };
}
