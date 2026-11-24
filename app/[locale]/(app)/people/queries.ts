// SPDX-License-Identifier: AGPL-3.0-only
import "server-only";
import { and, desc, eq, ilike, ne, sql, isNotNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/src/lib/db";
import {
  block,
  favorite,
  focusSession,
  profile,
  sessionParticipant,
} from "@/src/lib/db/schema";
export function peopleParameters(input: {
  tab?: string;
  page?: string;
  q?: string;
}) {
  return {
    tab:
      input.tab === "favorites" || input.tab === "blocked"
        ? input.tab
        : "recent",
    page: Math.min(100000, Math.max(1, Math.floor(Number(input.page) || 1))),
    q: (input.q ?? "").trim().slice(0, 60),
  };
}
export function literalSearch(value: string) {
  return `%${value.replace(/[\\%_]/g, "\\$&")}%`;
}
export async function peoplePage(
  userId: string,
  options: ReturnType<typeof peopleParameters>,
  size = 24,
) {
  const mine = alias(sessionParticipant, "mine");
  const history = db()
    .select({
      id: sessionParticipant.userId,
      count: sql<number>`count(*)::int`.as("together_count"),
      at: sql<Date | null>`max(${focusSession.startAt})`
        .mapWith(focusSession.startAt)
        .as("last_session"),
    })
    .from(mine)
    .innerJoin(focusSession, eq(focusSession.id, mine.sessionId))
    .innerJoin(
      sessionParticipant,
      and(
        eq(sessionParticipant.sessionId, mine.sessionId),
        ne(sessionParticipant.userId, userId),
      ),
    )
    .where(
      and(
        eq(mine.userId, userId),
        eq(focusSession.status, "ended"),
        isNotNull(mine.joinedAt),
        isNotNull(sessionParticipant.joinedAt),
      ),
    )
    .groupBy(sessionParticipant.userId)
    .as("history");
  const rows = await db()
    .select({
      id: profile.userId,
      name: profile.displayName,
      username: profile.username,
      avatar: profile.avatarUrl,
      bio: profile.bio,
      count: sql<number>`coalesce(${history.count},0)::int`,
      at: history.at,
      favorite: sql<boolean>`${favorite.partnerId} is not null`,
    })
    .from(profile)
    .leftJoin(history, eq(history.id, profile.userId))
    .leftJoin(
      favorite,
      and(eq(favorite.partnerId, profile.userId), eq(favorite.userId, userId)),
    )
    .leftJoin(
      block,
      and(eq(block.blockedId, profile.userId), eq(block.blockerId, userId)),
    )
    .where(
      and(
        ne(profile.userId, userId),
        options.tab === "blocked"
          ? isNotNull(block.blockedId)
          : sql`${block.blockedId} is null`,
        options.tab === "recent"
          ? isNotNull(history.id)
          : options.tab === "favorites"
            ? isNotNull(favorite.partnerId)
            : undefined,
        options.q
          ? ilike(profile.displayName, literalSearch(options.q))
          : undefined,
      ),
    )
    .orderBy(sql`${history.at} desc nulls last`, desc(profile.userId))
    .limit(size + 1)
    .offset((options.page - 1) * size);
  return { rows: rows.slice(0, size), more: rows.length > size };
}
