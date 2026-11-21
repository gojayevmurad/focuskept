// SPDX-License-Identifier: AGPL-3.0-only
"use server";
import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/src/lib/db";
import { booking, focusSession, sessionParticipant } from "@/src/lib/db/schema";
import { requireAppUser } from "@/src/lib/app-user";
import { getProfileByUsername } from "@/src/lib/profiles";
import { canBookAnother } from "@/src/lib/billing/plan";
import {
  acceptFallback,
  BookingFailure,
  cancelBooking,
  createBooking,
  isBlockedEitherWay,
  type BookingError,
  type FallbackChoice,
} from "@/src/lib/bookings/service";
import { publish } from "@/src/lib/realtime/publish";
import { addMinutes } from "@/src/lib/scheduling/slots";

export type ActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: BookingError | "invalid" | "full" };

function fail(error: unknown): ActionResult {
  if (error instanceof BookingFailure) return { ok: false, error: error.code };
  throw error;
}

const bookSchema = z.object({
  startAt: z.string().datetime(),
  duration: z.number().int(),
  partner: z.string().max(40).optional(),
});

export async function bookSlot(
  input: z.infer<typeof bookSchema>,
): Promise<ActionResult> {
  const { user, profile } = await requireAppUser();
  const parsed = bookSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  let preferredPartnerId: string | null = null;
  if (parsed.data.partner) {
    const partner = await getProfileByUsername(parsed.data.partner);
    if (!partner || partner.suspendedAt)
      return { ok: false, error: "not_found" };
    preferredPartnerId = partner.userId;
  }
  try {
    const id = await createBooking({
      userId: user.id,
      timeZone: profile.timezone,
      startAt: new Date(parsed.data.startAt),
      durationMin: parsed.data.duration,
      preferredPartnerId,
    });
    revalidatePath("/[locale]", "layout");
    return { ok: true, id };
  } catch (error) {
    return fail(error);
  }
}

export async function cancel(bookingId: string): Promise<ActionResult> {
  const { user } = await requireAppUser();
  try {
    await cancelBooking(user.id, z.string().uuid().parse(bookingId));
    revalidatePath("/[locale]", "layout");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function chooseFallback(
  bookingId: string,
  choice: FallbackChoice,
): Promise<ActionResult> {
  const { user, profile } = await requireAppUser();
  try {
    const result = await acceptFallback(
      user.id,
      profile.timezone,
      z.string().uuid().parse(bookingId),
      z.enum(["room", "next", "cancel"]).parse(choice),
    );
    revalidatePath("/[locale]", "layout");
    return { ok: true, id: result.sessionId ?? result.bookingId };
  } catch (error) {
    return fail(error);
  }
}

/** Takes a seat in a hosted group session. */
export async function joinGroup(sessionId: string): Promise<ActionResult> {
  const { user, profile } = await requireAppUser();
  const id = z.string().uuid().parse(sessionId);
  const [s] = await db()
    .select()
    .from(focusSession)
    .where(eq(focusSession.id, id));
  if (!s || s.type !== "group" || !["scheduled", "live"].includes(s.status))
    return { ok: false, error: "not_found" };
  if (addMinutes(s.startAt, s.durationMin) <= new Date())
    return { ok: false, error: "too_late" };
  if (s.hostId && (await isBlockedEitherWay(user.id, s.hostId)))
    return { ok: false, error: "blocked" };
  const allowed = await canBookAnother(user.id, profile.timezone, s.startAt);
  if (!allowed.ok) return { ok: false, error: "limit" };
  const result = await db()
    .transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`seat:${id}`}, 0))`,
      );
      const [{ n }] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(sessionParticipant)
        .where(eq(sessionParticipant.sessionId, id));
      if (n >= s.capacity) return "full" as const;
      const [existing] = await tx
        .select()
        .from(sessionParticipant)
        .where(
          and(
            eq(sessionParticipant.sessionId, id),
            eq(sessionParticipant.userId, user.id),
          ),
        );
      if (existing) return "ok" as const;
      const bookingId = crypto.randomUUID();
      await tx.insert(booking).values({
        id: bookingId,
        userId: user.id,
        startAt: s.startAt,
        durationMin: s.durationMin,
        status: "matched",
        kind: "group",
        sessionId: id,
      });
      await tx
        .insert(sessionParticipant)
        .values({ sessionId: id, userId: user.id, bookingId });
      return "ok" as const;
    })
    .catch((error: unknown) => {
      // The unique active-booking index rejects a second booking at the same start.
      if (String((error as { code?: string }).code) === "23505")
        return "overlap" as const;
      throw error;
    });
  if (result === "full") return { ok: false, error: "full" };
  if (result === "overlap") return { ok: false, error: "overlap" };
  await publish(`session:${id}`, "session.presence", {}).catch(() => {});
  revalidatePath("/[locale]", "layout");
  return { ok: true, id };
}
