// SPDX-License-Identifier: AGPL-3.0-only
import "server-only";
import { and, eq, gte, inArray } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { db } from "@/src/lib/db";
import { booking } from "@/src/lib/db/schema";
import { requireAppUser } from "@/src/lib/app-user";
import { suggestedSlots } from "@/src/lib/bookings/availability";
import { formatWhen } from "@/src/lib/notifications";
import { NudgeBannerClient } from "./nudge-banner-client";

/**
 * Server component that checks if the user has an upcoming booking.
 * If none, finds the next popular suggested slot and renders a slim dismissible banner.
 */
export async function ActivationNudge() {
  const { user, profile } = await requireAppUser();
  const now = new Date();

  // Check if user has any active upcoming bookings
  const [activeBooking] = await db()
    .select({ id: booking.id })
    .from(booking)
    .where(
      and(
        eq(booking.userId, user.id),
        inArray(booking.status, ["booked", "matched"]),
        gte(booking.startAt, now),
      ),
    )
    .limit(1);

  if (activeBooking) return null;

  // Find next popular slot
  let slots: Awaited<ReturnType<typeof suggestedSlots>> = [];
  try {
    slots = await suggestedSlots(user.id, 50, now, 1, profile.timezone);
  } catch {
    return null;
  }

  if (!slots.length) return null;

  const topSlot = slots[0];
  const t = await getTranslations("nudge");
  const formattedTime = formatWhen(topSlot.startAt, profile.timezone, profile.locale);
  const bookUrl = `/book?start=${topSlot.startAt.toISOString()}&duration=50`;

  return (
    <NudgeBannerClient
      slotIso={topSlot.startAt.toISOString()}
      formattedTime={formattedTime}
      waitingCount={topSlot.waiting}
      bookUrl={bookUrl}
      promptLabel={t("prompt")}
      waitingLabel={t("waiting", { count: topSlot.waiting })}
      bookLabel={t("bookSlot")}
      dismissLabel={t("dismiss")}
    />
  );
}
