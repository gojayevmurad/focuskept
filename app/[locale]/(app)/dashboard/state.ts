// SPDX-License-Identifier: AGPL-3.0-only
export type HeroBooking = {
  id: string;
  startAt: string;
  durationMin: number;
  sessionId: string | null;
  partner: { name: string; avatar: string | null; goal: string } | null;
};
export function dashboardState(
  bookings: HeroBooking[],
  completed: number,
  now: number,
) {
  const active = bookings
    .filter((b) => Date.parse(b.startAt) + b.durationMin * 60000 > now)
    .sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt));
  const booking =
    active.find((b) => Date.parse(b.startAt) <= now + 600000) ??
    active[0] ??
    null;
  return {
    booking,
    mode: !booking
      ? "none"
      : Date.parse(booking.startAt) <= now
        ? "live"
        : Date.parse(booking.startAt) <= now + 600000
          ? "soon"
          : "upcoming",
    showExplainer: completed === 0,
  } as const;
}
