// SPDX-License-Identifier: AGPL-3.0-only
import "server-only";
import { and, eq, gt, inArray } from "drizzle-orm";
import { db } from "@/src/lib/db";
import { booking, profile } from "@/src/lib/db/schema";
import { cancelBooking } from "@/src/lib/bookings/service";

export async function suspendUser(userId: string) {
  await db()
    .update(profile)
    .set({ suspendedAt: new Date(), updatedAt: new Date() })
    .where(eq(profile.userId, userId));
  const future = await db()
    .select({ id: booking.id })
    .from(booking)
    .where(
      and(
        eq(booking.userId, userId),
        gt(booking.startAt, new Date()),
        inArray(booking.status, ["booked", "matched"]),
      ),
    );
  for (const row of future) await cancelBooking(userId, row.id).catch(() => {});
}
