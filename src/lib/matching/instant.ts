// SPDX-License-Identifier: AGPL-3.0-only
import "server-only";
import { and, asc, desc, eq, gt, inArray, lte, ne, or, sql } from "drizzle-orm";
import { db } from "@/src/lib/db";
import {
  block,
  booking,
  focusSession,
  matchRequest,
  profile,
  sessionParticipant,
} from "@/src/lib/db/schema";
import { canBookAnother } from "@/src/lib/billing/plan";
import { sendAdminAlert } from "@/src/lib/admin/alerts";
import { publish } from "@/src/lib/realtime/publish";
import { logger } from "@/src/lib/logger";

type Tx = Parameters<Parameters<ReturnType<typeof db>["transaction"]>[0]>[0];
type RequestRow = typeof matchRequest.$inferSelect;
export const MATCH_WAIT_MS = 10 * 60_000;
export type InstantMatchError =
  "duration" | "suspended" | "limit" | "overlap" | "unavailable" | "self";
export class InstantMatchFailure extends Error {
  constructor(public code: InstantMatchError) {
    super(code);
  }
}
const lock = (tx: Tx) =>
  tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended('match-now', 0))`,
  );
const cutoff = (now: Date) => new Date(now.getTime() - MATCH_WAIT_MS);

async function expire(tx: Tx, now: Date) {
  return tx
    .update(matchRequest)
    .set({ status: "expired" })
    .where(
      and(
        eq(matchRequest.status, "waiting"),
        lte(matchRequest.createdAt, cutoff(now)),
      ),
    )
    .returning({ id: matchRequest.id });
}
export async function expireMatchRequests(now = new Date()) {
  return db().transaction(async (tx) => {
    await lock(tx);
    return (await expire(tx, now)).length;
  });
}

async function active(tx: Tx, userId: string, now: Date) {
  const [waiting] = await tx
    .select()
    .from(matchRequest)
    .where(
      and(eq(matchRequest.userId, userId), eq(matchRequest.status, "waiting")),
    )
    .limit(1);
  if (waiting) return waiting;
  const [matched] = await tx
    .select({ request: matchRequest })
    .from(matchRequest)
    .innerJoin(focusSession, eq(focusSession.id, matchRequest.sessionId))
    .where(
      and(
        eq(matchRequest.userId, userId),
        eq(matchRequest.status, "matched"),
        inArray(focusSession.status, ["scheduled", "live"]),
        gt(
          sql`${focusSession.startAt} + make_interval(mins => ${focusSession.durationMin})`,
          now,
        ),
      ),
    )
    .orderBy(desc(matchRequest.createdAt))
    .limit(1);
  return matched?.request;
}

async function eligible(
  tx: Tx,
  userId: string,
  durationMin: number,
  now: Date,
) {
  // Shares the ordinary booking lock: concurrent calendar bookings cannot overlap a match.
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`book:${userId}`}, 0))`,
  );
  const [person] = await tx
    .select()
    .from(profile)
    .where(eq(profile.userId, userId));
  if (!person?.onboardedAt || person.suspendedAt)
    throw new InstantMatchFailure("suspended");
  if (!(await canBookAnother(userId, person.timezone, now)).ok)
    throw new InstantMatchFailure("limit");
  const [overlap] = await tx
    .select({ id: booking.id })
    .from(booking)
    .where(
      and(
        eq(booking.userId, userId),
        inArray(booking.status, ["booked", "matched"]),
        sql`${booking.startAt} < ${new Date(now.getTime() + durationMin * 60_000)}`,
        gt(
          sql`${booking.startAt} + make_interval(mins => ${booking.durationMin})`,
          new Date(Math.floor(now.getTime() / 60_000) * 60_000),
        ),
      ),
    )
    .limit(1);
  if (overlap) throw new InstantMatchFailure("overlap");
  return person;
}

/** Serializes create/cancel/expiry/admin joins, including requests with different durations. */
async function start(
  userId: string,
  durationMin: number | null,
  targetId?: string,
  now = new Date(),
) {
  if (!targetId && durationMin !== 25 && durationMin !== 50)
    throw new InstantMatchFailure("duration");
  const result = await db().transaction(async (tx) => {
    await lock(tx);
    await expire(tx, now);
    let target: RequestRow | undefined;
    if (targetId) {
      [target] = await tx
        .select()
        .from(matchRequest)
        .where(eq(matchRequest.id, targetId))
        .for("update");
      if (!target || target.status !== "waiting") {
        // Repeated admin link opens can return their existing match, without creating another.
        const own = await active(tx, userId, now);
        if (target?.status === "matched" && own?.sessionId === target.sessionId)
          return { request: own, waiting: false, users: [] };
        throw new InstantMatchFailure("unavailable");
      }
      if (target.userId === userId) throw new InstantMatchFailure("self");
      durationMin = target.durationMin;
    }
    const existing = await active(tx, userId, now);
    if (existing) {
      const [person] = await tx
        .select()
        .from(profile)
        .where(eq(profile.userId, userId));
      if (!person?.onboardedAt || person.suspendedAt)
        throw new InstantMatchFailure("suspended");
      if (
        target &&
        (existing.status !== "waiting" || existing.durationMin !== durationMin)
      )
        throw new InstantMatchFailure("overlap");
      if (!target) return { request: existing, waiting: false, users: [] };
    }
    const person = await eligible(tx, userId, durationMin!, now);
    const own: RequestRow = existing ?? {
      id: crypto.randomUUID(),
      userId,
      durationMin: durationMin!,
      status: "waiting",
      sessionId: null,
      createdAt: now,
      matchedAt: null,
    };
    const blocked = await tx
      .select()
      .from(block)
      .where(or(eq(block.blockerId, userId), eq(block.blockedId, userId)));
    const blockedIds = new Set(
      blocked.map((b) => (b.blockerId === userId ? b.blockedId : b.blockerId)),
    );
    const candidates = target
      ? [target]
      : await tx
          .select()
          .from(matchRequest)
          .where(
            and(
              eq(matchRequest.status, "waiting"),
              eq(matchRequest.durationMin, durationMin!),
              ne(matchRequest.userId, userId),
              gt(matchRequest.createdAt, cutoff(now)),
            ),
          )
          .orderBy(asc(matchRequest.createdAt))
          .for("update");
    let partner: RequestRow | undefined;
    for (const candidate of candidates) {
      if (candidate.userId === userId || blockedIds.has(candidate.userId))
        continue;
      try {
        await eligible(tx, candidate.userId, durationMin!, now);
        partner = candidate;
        break;
      } catch (error) {
        if (!(error instanceof InstantMatchFailure)) throw error;
        await tx
          .update(matchRequest)
          .set({ status: "cancelled" })
          .where(eq(matchRequest.id, candidate.id));
      }
    }
    if (target && !partner) throw new InstantMatchFailure("unavailable");
    if (!existing) await tx.insert(matchRequest).values(own);
    if (!partner)
      return {
        request: own,
        waiting: !existing,
        users: [],
        name: person.displayName,
      };
    const sessionId = crypto.randomUUID();
    const startAt = new Date(Math.floor(now.getTime() / 60_000) * 60_000);
    await tx
      .insert(focusSession)
      .values({
        id: sessionId,
        startAt,
        durationMin: durationMin!,
        type: "pair",
        capacity: 2,
      });
    // Bookings keep weekly usage, attendance, referrals and progress on the same path.
    const bookings = [own, partner].map((r) => ({
      id: crypto.randomUUID(),
      userId: r.userId,
      startAt,
      durationMin: durationMin!,
      status: "matched",
      kind: "pair",
      sessionId,
    }));
    await tx.insert(booking).values(bookings);
    await tx
      .insert(sessionParticipant)
      .values(
        bookings.map((b) => ({ sessionId, userId: b.userId, bookingId: b.id })),
      );
    await tx
      .update(matchRequest)
      .set({ status: "matched", sessionId, matchedAt: now })
      .where(inArray(matchRequest.id, [own.id, partner.id]));
    return {
      request: {
        ...own,
        status: "matched" as const,
        sessionId,
        matchedAt: now,
      },
      waiting: false,
      users: [userId, partner.userId],
    };
  });
  // All external effects happen after commit and cannot turn a successful match into an error.
  for (const id of result.users)
    await publish(`user:${id}`, "match.found", {
      sessionId: result.request.sessionId,
    }).catch((error) =>
      logger.warn({ err: error, userId: id }, "Instant match publish failed"),
    );
  if (result.waiting)
    await sendAdminAlert("match_now_waiting", result.request.id, {
      name: result.name,
      durationMin: result.request.durationMin,
      path: `/match-now/join/${result.request.id}`,
    });
  return result.request;
}
export function startInstantMatch(
  userId: string,
  durationMin: number,
  now = new Date(),
) {
  return start(userId, durationMin, undefined, now);
}
/** Caller must require an admin before invoking this operation. */
export function joinInstantMatch(
  userId: string,
  requestId: string,
  now = new Date(),
) {
  return start(userId, null, requestId, now);
}

export async function getInstantMatch(userId: string, now = new Date()) {
  return db().transaction(async (tx) => {
    await lock(tx);
    await expire(tx, now);
    const current = await active(tx, userId, now);
    if (current) return current;
    const [latest] = await tx
      .select()
      .from(matchRequest)
      .where(eq(matchRequest.userId, userId))
      .orderBy(desc(matchRequest.createdAt))
      .limit(1);
    return latest?.status === "matched" ? null : (latest ?? null);
  });
}
export async function cancelInstantMatch(userId: string, now = new Date()) {
  return db().transaction(async (tx) => {
    await lock(tx);
    await expire(tx, now);
    await tx
      .update(matchRequest)
      .set({ status: "cancelled" })
      .where(
        and(
          eq(matchRequest.userId, userId),
          eq(matchRequest.status, "waiting"),
        ),
      );
    // If matching won the race, return that session so the client can still join it.
    return (await active(tx, userId, now)) ?? null;
  });
}
export async function waitingInstantMatches(now = new Date()) {
  return db()
    .select({
      id: matchRequest.id,
      name: profile.displayName,
      avatarUrl: profile.avatarUrl,
      durationMin: matchRequest.durationMin,
      createdAt: matchRequest.createdAt,
    })
    .from(matchRequest)
    .innerJoin(profile, eq(profile.userId, matchRequest.userId))
    .where(
      and(
        eq(matchRequest.status, "waiting"),
        gt(matchRequest.createdAt, cutoff(now)),
      ),
    )
    .orderBy(asc(matchRequest.createdAt))
    .limit(50);
}
