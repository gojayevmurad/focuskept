// SPDX-License-Identifier: AGPL-3.0-only
import "server-only";
import { and, eq, gt, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "@/src/lib/db";
import {
  block,
  booking,
  communityMember,
  favorite,
  focusSession,
  matchFailure,
  profile,
  sessionParticipant,
} from "@/src/lib/db/schema";
import { getPlan } from "@/src/lib/billing/plan";
import { publish } from "@/src/lib/realtime/publish";
import { logger } from "@/src/lib/logger";
import {
  addMinutes,
  FALLBACK_LEAD_MIN,
  MATCH_LEAD_MIN,
} from "@/src/lib/scheduling/slots";
import * as notify from "@/src/lib/notifications";
import { matchSlot, pairKey, type Candidate } from "./algorithm";

type Tx = Parameters<Parameters<ReturnType<typeof db>["transaction"]>[0]>[0];

async function loadCandidates(tx: Tx, rows: (typeof booking.$inferSelect)[]) {
  const userIds = rows.map((r) => r.userId);
  if (!userIds.length)
    return {
      candidates: [],
      blocked: new Set<string>(),
      houseUsers: new Set<string>(),
    };
  // One transaction means one connection, so these run one after another.
  const profiles = await tx
    .select()
    .from(profile)
    .where(inArray(profile.userId, userIds));
  const favorites = await tx
    .select()
    .from(favorite)
    .where(
      and(
        inArray(favorite.userId, userIds),
        inArray(favorite.partnerId, userIds),
      ),
    );
  const blocks = await tx
    .select()
    .from(block)
    .where(
      or(inArray(block.blockerId, userIds), inArray(block.blockedId, userIds)),
    );
  const memberships = await tx
    .select()
    .from(communityMember)
    .where(inArray(communityMember.userId, userIds));
  const plans = new Map(
    await Promise.all(
      userIds.map(async (id) => [id, (await getPlan(id)).plan] as const),
    ),
  );
  const byUser = new Map(profiles.map((p) => [p.userId, p]));
  const candidates: Candidate[] = rows
    .filter((r) => !byUser.get(r.userId)?.suspendedAt)
    .map((r) => {
      const p = byUser.get(r.userId);
      const plus = plans.get(r.userId) === "plus";
      return {
        bookingId: r.id,
        userId: r.userId,
        createdAt: r.createdAt,
        preferredPartnerId: r.preferredPartnerId,
        segments: p?.segments ?? [],
        // Favorites and filters are Plus features.
        favorites: plus
          ? favorites
              .filter((f) => f.userId === r.userId)
              .map((f) => f.partnerId)
          : [],
        requireSharedSegment: plus && Boolean(p?.matchSameSegment),
        communities: memberships
          .filter((m) => m.userId === r.userId)
          .map((m) => m.communityId),
      };
    });
  const blocked = new Set(blocks.map((b) => pairKey(b.blockerId, b.blockedId)));
  const houseUsers = new Set(
    profiles.filter((p) => p.isHouse).map((p) => p.userId),
  );
  return { candidates, blocked, houseUsers };
}

/**
 * Pairs every unmatched booking for one slot. Safe to call repeatedly and
 * concurrently: a transaction-scoped advisory lock serializes runs per slot.
 */
export async function runSlotMatching(startAt: Date, durationMin: number) {
  const { created, houseBookingIds, partnerBookingIds } =
    await db().transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`match:${startAt.toISOString()}:${durationMin}`}, 0))`,
      );
      const rows = await tx
        .select()
        .from(booking)
        .where(
          and(
            eq(booking.startAt, startAt),
            eq(booking.durationMin, durationMin),
            eq(booking.status, "booked"),
            eq(booking.kind, "pair"),
          ),
        )
        .for("update");
      if (rows.length < 2)
        return { created: [], houseBookingIds: [], partnerBookingIds: [] };
      const { candidates, blocked, houseUsers } = await loadCandidates(
        tx,
        rows,
      );
      const { pairs } = matchSlot(candidates, blocked);
      const made: { sessionId: string; users: [string, string] }[] = [];
      const houseBookingIds: string[] = [];
      const partnerBookingIds: string[] = [];
      for (const pair of pairs) {
        const sessionId = crypto.randomUUID();
        await tx.insert(focusSession).values({
          id: sessionId,
          startAt,
          durationMin,
          type: "pair",
          capacity: 2,
        });
        await tx.insert(sessionParticipant).values([
          { sessionId, userId: pair.a.userId, bookingId: pair.a.bookingId },
          { sessionId, userId: pair.b.userId, bookingId: pair.b.bookingId },
        ]);
        await tx
          .update(booking)
          .set({ status: "matched", sessionId })
          .where(inArray(booking.id, [pair.a.bookingId, pair.b.bookingId]));
        // A person who got a fallback offer and was matched after all.
        await tx
          .update(matchFailure)
          .set({ resolution: "matched_late" })
          .where(
            and(
              inArray(matchFailure.bookingId, [
                pair.a.bookingId,
                pair.b.bookingId,
              ]),
              isNull(matchFailure.resolution),
            ),
          );
        made.push({ sessionId, users: [pair.a.userId, pair.b.userId] });
        for (const participant of [pair.a, pair.b])
          if (!houseUsers.has(participant.userId))
            partnerBookingIds.push(participant.bookingId);
        if (houseUsers.has(pair.a.userId) && !houseUsers.has(pair.b.userId))
          houseBookingIds.push(pair.a.bookingId);
        if (houseUsers.has(pair.b.userId) && !houseUsers.has(pair.a.userId))
          houseBookingIds.push(pair.b.bookingId);
      }
      return { created: made, houseBookingIds, partnerBookingIds };
    });
  for (const bookingId of houseBookingIds)
    await notify.houseMatched(bookingId).catch((error) => {
      logger.warn({ err: error, bookingId }, "House match notification failed");
    });
  for (const bookingId of partnerBookingIds)
    await notify.partnerMatched(bookingId).catch((error) => {
      logger.warn(
        { err: error, bookingId },
        "Partner match notification failed",
      );
    });
  for (const m of created)
    for (const userId of m.users)
      await publish(`user:${userId}`, "booking.matched", {
        sessionId: m.sessionId,
      }).catch(() => {});
  return created;
}

/** Slots that start within the matching lead time and still have someone waiting. */
export async function slotsDueForMatching(now = new Date()) {
  return db()
    .selectDistinct({
      startAt: booking.startAt,
      durationMin: booking.durationMin,
    })
    .from(booking)
    .where(
      and(
        eq(booking.status, "booked"),
        eq(booking.kind, "pair"),
        gt(booking.startAt, addMinutes(now, -1)),
        lte(booking.startAt, addMinutes(now, MATCH_LEAD_MIN)),
      ),
    );
}

export async function matchDueSlots(now = new Date()) {
  let sessions = 0;
  for (const slot of await slotsDueForMatching(now)) {
    try {
      sessions += (await runSlotMatching(slot.startAt, slot.durationMin))
        .length;
    } catch (error) {
      logger.error({ err: error, slot: slot.startAt }, "Slot matching failed");
    }
  }
  return sessions;
}

/** People still alone two minutes before the start get a fallback offer, once. */
export async function offerFallbacks(now = new Date()) {
  const rows = await db()
    .update(booking)
    .set({ fallbackOfferedAt: now })
    .where(
      and(
        eq(booking.status, "booked"),
        eq(booking.kind, "pair"),
        isNull(booking.fallbackOfferedAt),
        gt(booking.startAt, addMinutes(now, -1)),
        lte(booking.startAt, addMinutes(now, FALLBACK_LEAD_MIN)),
      ),
    )
    .returning();
  for (const b of rows) {
    await db()
      .insert(matchFailure)
      .values({
        id: crypto.randomUUID(),
        bookingId: b.id,
        userId: b.userId,
        startAt: b.startAt,
        durationMin: b.durationMin,
      })
      .onConflictDoNothing();
    await publish(`user:${b.userId}`, "booking.fallback", {
      bookingId: b.id,
    }).catch(() => {});
    await notify.fallbackOffered(b.id);
  }
  return rows.length;
}
