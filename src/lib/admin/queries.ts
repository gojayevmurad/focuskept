// SPDX-License-Identifier: AGPL-3.0-only
import "server-only";
import { and, desc, eq, gt, ilike, inArray, lt, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/src/lib/db";
import {
  booking,
  community,
  communityMember,
  host,
  profile,
  report,
  user,
} from "@/src/lib/db/schema";

const completed = (userId: typeof user.id | typeof host.userId) =>
  sql<number>`(select count(*)::int from booking b where b.user_id = ${userId} and b.status = 'completed')`;
export async function searchUsers(q: string) {
  return db()
    .select({ user, profile, completed: completed(user.id) })
    .from(user)
    .leftJoin(profile, eq(profile.userId, user.id))
    .where(
      q
        ? or(
            ilike(user.email, `%${q}%`),
            ilike(user.name, `%${q}%`),
            ilike(profile.displayName, `%${q}%`),
            ilike(profile.username, `%${q}%`),
          )
        : undefined,
    )
    .orderBy(desc(user.createdAt))
    .limit(50);
}
export async function reports(resolved: boolean, q = "") {
  const reporter = alias(user, "reporter");
  const target = alias(user, "target");
  const query = db()
    .select({
      report,
      reporter: reporter.name,
      target: target.name,
      username: profile.username,
      recent: sql<number>`(select count(*)::int from report r where r.target_id = ${report.targetId} and r.created_at >= now() - interval '30 days')`,
    })
    .from(report)
    .innerJoin(reporter, eq(reporter.id, report.reporterId))
    .innerJoin(target, eq(target.id, report.targetId))
    .leftJoin(profile, eq(profile.userId, report.targetId))
    .where(
      and(
        resolved
          ? inArray(report.status, ["actioned", "dismissed"])
          : eq(report.status, "open"),
        q
          ? or(
              ilike(reporter.name, `%${q}%`),
              ilike(target.name, `%${q}%`),
              ilike(report.details, `%${q}%`),
              ilike(report.reason, `%${q}%`),
            )
          : undefined,
      ),
    )
    .orderBy(resolved ? desc(report.resolvedAt) : desc(report.createdAt))
    .$dynamic();
  return resolved ? query.limit(50) : query;
}
export async function hosts(q = "") {
  return db()
    .select({
      host,
      name: user.name,
      username: profile.username,
      completed: completed(host.userId),
    })
    .from(host)
    .innerJoin(user, eq(user.id, host.userId))
    .leftJoin(profile, eq(profile.userId, host.userId))
    .where(
      and(
        inArray(host.status, ["applied", "approved", "suspended"]),
        q
          ? or(
              ilike(user.name, `%${q}%`),
              ilike(host.pitch, `%${q}%`),
              ilike(profile.username, `%${q}%`),
            )
          : undefined,
      ),
    )
    .orderBy(desc(host.appliedAt));
}
export async function groups(q = "") {
  return db()
    .select({
      community,
      owner: user.name,
      members: sql<number>`(select count(*)::int from ${communityMember} m where m.community_id = ${community.id})`,
    })
    .from(community)
    .leftJoin(user, eq(user.id, community.ownerId))
    .where(
      q
        ? or(ilike(community.name, `%${q}%`), ilike(user.name, `%${q}%`))
        : undefined,
    )
    .orderBy(desc(community.createdAt));
}
export async function houseSlots(now = new Date()) {
  return db()
    .select({
      startAt: booking.startAt,
      durationMin: booking.durationMin,
      name: sql<string>`max(${profile.displayName})`,
      userId: sql<string>`max(${booking.userId})`,
    })
    .from(booking)
    .leftJoin(profile, eq(profile.userId, booking.userId))
    .where(
      and(
        gt(booking.startAt, now),
        lt(booking.startAt, new Date(now.getTime() + 86400000)),
        eq(booking.status, "booked"),
        eq(booking.kind, "pair"),
      ),
    )
    .groupBy(booking.startAt, booking.durationMin)
    .having(sql`count(*) = 1`)
    .orderBy(booking.startAt);
}
export async function ownHouseBookings(userId: string) {
  return db()
    .select()
    .from(booking)
    .where(
      and(
        eq(booking.userId, userId),
        gt(booking.startAt, new Date()),
        inArray(booking.status, ["booked", "matched"]),
        eq(booking.kind, "pair"),
      ),
    )
    .orderBy(booking.startAt);
}
