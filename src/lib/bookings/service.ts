import "server-only";
import { and, eq, gt, inArray, lt, or, sql } from "drizzle-orm";
import { db } from "@/src/lib/db";
import {
  block,
  booking,
  focusSession,
  matchFailure,
  profile,
  sessionParticipant,
} from "@/src/lib/db/schema";
import { canBookAnother } from "@/src/lib/billing/plan";
import { publish } from "@/src/lib/realtime/publish";
import {
  addMinutes,
  checkBookable,
  isFreeCancellation,
  MATCH_LEAD_MIN,
  minutesUntil,
  nextSlot,
} from "@/src/lib/scheduling/slots";
import { runSlotMatching } from "@/src/lib/matching/run";
import * as notify from "@/src/lib/notifications";
import { trackForUser } from "@/src/lib/analytics/product";
import { logger } from "@/src/lib/logger";

export type BookingError =
  | "not_slot"
  | "too_late"
  | "too_far"
  | "duration"
  | "limit"
  | "overlap"
  | "blocked"
  | "self"
  | "not_found"
  | "not_allowed"
  | "suspended";

export class BookingFailure extends Error {
  constructor(public code: BookingError) {
    super(code);
  }
}

const ACTIVE = ["booked", "matched"] as const;

export async function isBlockedEitherWay(a: string, b: string) {
  const [row] = await db()
    .select({ id: block.blockerId })
    .from(block)
    .where(
      or(
        and(eq(block.blockerId, a), eq(block.blockedId, b)),
        and(eq(block.blockerId, b), eq(block.blockedId, a)),
      ),
    )
    .limit(1);
  return Boolean(row);
}

export async function createBooking(input: {
  userId: string;
  timeZone: string;
  startAt: Date;
  durationMin: number;
  preferredPartnerId?: string | null;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const check = checkBookable(input.startAt, input.durationMin, now);
  if (!check.ok) throw new BookingFailure(check.reason);
  if (input.preferredPartnerId === input.userId)
    throw new BookingFailure("self");
  if (
    input.preferredPartnerId &&
    (await isBlockedEitherWay(input.userId, input.preferredPartnerId))
  )
    throw new BookingFailure("blocked");
  const allowed = await canBookAnother(
    input.userId,
    input.timeZone,
    input.startAt,
  );
  if (!allowed.ok) throw new BookingFailure("limit");

  const end = addMinutes(input.startAt, input.durationMin);
  const id = crypto.randomUUID();
  await db().transaction(async (tx) => {
    // Serialize per user so two quick clicks cannot both pass the overlap check.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`book:${input.userId}`}, 0))`,
    );
    const overlapping = await tx
      .select({ id: booking.id })
      .from(booking)
      .where(
        and(
          eq(booking.userId, input.userId),
          inArray(booking.status, [...ACTIVE]),
          lt(booking.startAt, end),
          gt(
            sql`${booking.startAt} + make_interval(mins => ${booking.durationMin})`,
            input.startAt,
          ),
        ),
      )
      .limit(1);
    if (overlapping.length) throw new BookingFailure("overlap");
    await tx.insert(booking).values({
      id,
      userId: input.userId,
      startAt: input.startAt,
      durationMin: input.durationMin,
      preferredPartnerId: input.preferredPartnerId ?? null,
    });
  });

  await publish(`user:${input.userId}`, "booking.updated", {
    bookingId: id,
  }).catch(() => {});
  void trackForUser(input.userId, "booking_created", {
    duration: input.durationMin,
    direct: Boolean(input.preferredPartnerId),
  });
  if (minutesUntil(input.startAt, now) <= MATCH_LEAD_MIN)
    await runSlotMatching(input.startAt, input.durationMin).catch((error) =>
      logger.error({ err: error }, "Instant matching failed"),
    );
  else void notify.bookingConfirmed(id).catch(() => {});

  if (input.preferredPartnerId) void inviteIfNeeded(id).catch(() => {});
  return id;
}

/** Tell the preferred partner about a direct booking unless they already booked that slot. */
async function inviteIfNeeded(bookingId: string) {
  const [b] = await db()
    .select()
    .from(booking)
    .where(eq(booking.id, bookingId));
  if (!b?.preferredPartnerId) return;
  const [theirs] = await db()
    .select({ id: booking.id })
    .from(booking)
    .where(
      and(
        eq(booking.userId, b.preferredPartnerId),
        eq(booking.startAt, b.startAt),
        inArray(booking.status, [...ACTIVE]),
      ),
    );
  if (theirs) return;
  const [from] = await db()
    .select()
    .from(profile)
    .where(eq(profile.userId, b.userId));
  if (!from) return;
  await notify.directInvitation({
    toUserId: b.preferredPartnerId,
    fromName: from.displayName,
    fromUsername: from.username,
    startAt: b.startAt,
    durationMin: b.durationMin,
    bookingId: b.id,
  });
}

/**
 * Cancels a booking. Free until an hour before, a late cancel after that. If
 * the person was already matched, the partner goes back into the pool.
 */
export async function cancelBooking(
  userId: string,
  bookingId: string,
  now = new Date(),
) {
  const result = await db().transaction(async (tx) => {
    const [b] = await tx
      .select()
      .from(booking)
      .where(and(eq(booking.id, bookingId), eq(booking.userId, userId)))
      .for("update");
    if (!b) throw new BookingFailure("not_found");
    if (!ACTIVE.includes(b.status as (typeof ACTIVE)[number]))
      throw new BookingFailure("not_allowed");
    if (now >= b.startAt) throw new BookingFailure("too_late");
    const status = isFreeCancellation(b.startAt, now)
      ? "cancelled"
      : "late_cancel";
    await tx
      .update(booking)
      .set({ status, cancelledAt: now })
      .where(eq(booking.id, b.id));

    let partnerBookingId: string | null = null;
    if (b.sessionId) {
      await tx
        .delete(sessionParticipant)
        .where(
          and(
            eq(sessionParticipant.sessionId, b.sessionId),
            eq(sessionParticipant.userId, userId),
          ),
        );
      const [session] = await tx
        .select()
        .from(focusSession)
        .where(eq(focusSession.id, b.sessionId));
      if (session?.type === "pair") {
        const others = await tx
          .select()
          .from(sessionParticipant)
          .where(eq(sessionParticipant.sessionId, b.sessionId));
        await tx
          .update(focusSession)
          .set({ status: "cancelled" })
          .where(eq(focusSession.id, b.sessionId));
        for (const other of others) {
          await tx
            .delete(sessionParticipant)
            .where(
              and(
                eq(sessionParticipant.sessionId, b.sessionId),
                eq(sessionParticipant.userId, other.userId),
              ),
            );
          if (other.bookingId) {
            await tx
              .update(booking)
              .set({ status: "booked", sessionId: null })
              .where(eq(booking.id, other.bookingId));
            partnerBookingId = other.bookingId;
          }
        }
      }
    }
    return { b, status, partnerBookingId };
  });

  await publish(`user:${userId}`, "booking.updated", { bookingId }).catch(
    () => {},
  );
  if (result.partnerBookingId) {
    const [partner] = await db()
      .select()
      .from(booking)
      .where(eq(booking.id, result.partnerBookingId));
    if (partner) {
      await publish(`user:${partner.userId}`, "booking.partner_changed", {
        bookingId: partner.id,
      }).catch(() => {});
      void notify.partnerChanged(partner.id).catch(() => {});
      if (minutesUntil(partner.startAt, now) <= MATCH_LEAD_MIN)
        await runSlotMatching(partner.startAt, partner.durationMin).catch(
          () => {},
        );
    }
  }
  return result.status;
}

export type FallbackChoice = "room" | "next" | "cancel";

/** Handles the choice offered to someone left without a partner at T-2. */
export async function acceptFallback(
  userId: string,
  timeZone: string,
  bookingId: string,
  choice: FallbackChoice,
  now = new Date(),
) {
  const [b] = await db()
    .select()
    .from(booking)
    .where(and(eq(booking.id, bookingId), eq(booking.userId, userId)));
  if (!b || b.status !== "booked") throw new BookingFailure("not_allowed");
  const resolve = (resolution: string) =>
    db()
      .update(matchFailure)
      .set({ resolution })
      .where(eq(matchFailure.bookingId, b.id));

  if (choice === "cancel") {
    await db()
      .update(booking)
      .set({ status: "cancelled", cancelledAt: now })
      .where(eq(booking.id, b.id));
    await resolve("cancelled");
    return { bookingId: b.id };
  }
  if (choice === "next") {
    await db()
      .update(booking)
      .set({ status: "cancelled", cancelledAt: now })
      .where(eq(booking.id, b.id));
    await resolve("next_slot");
    const id = await createBooking({
      userId,
      timeZone,
      startAt: nextSlot(b.startAt),
      durationMin: b.durationMin,
      now,
    });
    return { bookingId: id };
  }
  const sessionId = await db().transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`room:${b.startAt.toISOString()}:${b.durationMin}`}, 0))`,
    );
    const [existing] = await tx
      .select()
      .from(focusSession)
      .where(
        and(
          eq(focusSession.startAt, b.startAt),
          eq(focusSession.durationMin, b.durationMin),
          eq(focusSession.isFallbackRoom, true),
          inArray(focusSession.status, ["scheduled", "live"]),
        ),
      );
    let id = existing?.id;
    if (!id) {
      id = crypto.randomUUID();
      await tx.insert(focusSession).values({
        id,
        startAt: b.startAt,
        durationMin: b.durationMin,
        type: "group",
        capacity: 9,
        isFallbackRoom: true,
      });
    }
    const [{ n }] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(sessionParticipant)
      .where(eq(sessionParticipant.sessionId, id));
    if (n >= 9) throw new BookingFailure("not_allowed");
    await tx
      .insert(sessionParticipant)
      .values({ sessionId: id, userId, bookingId: b.id })
      .onConflictDoNothing();
    await tx
      .update(booking)
      .set({ status: "matched", sessionId: id, kind: "group" })
      .where(eq(booking.id, b.id));
    return id;
  });
  await resolve("open_room");
  await publish(`session:${sessionId}`, "session.presence", {}).catch(() => {});
  return { bookingId: b.id, sessionId };
}

export async function upcomingBookings(userId: string, now = new Date()) {
  return db()
    .select()
    .from(booking)
    .where(
      and(
        eq(booking.userId, userId),
        inArray(booking.status, [...ACTIVE]),
        gt(
          sql`${booking.startAt} + make_interval(mins => ${booking.durationMin})`,
          now,
        ),
      ),
    )
    .orderBy(booking.startAt);
}
