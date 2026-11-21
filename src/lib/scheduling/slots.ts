// SPDX-License-Identifier: AGPL-3.0-only
import { TZDate } from "@date-fns/tz";
import { startOfWeek, addWeeks, startOfDay, addDays } from "date-fns";

export const DURATIONS = [25, 50, 75] as const;
export type Duration = (typeof DURATIONS)[number];
export const SLOT_MINUTES = 30;
export const MAX_DAYS_AHEAD = 14;
/** Bookings close this many minutes before the start. */
export const BOOKING_CUTOFF_MIN = 2;
/** Cancelling at least this long before the start is free. */
export const FREE_CANCEL_MIN = 60;
export const MATCH_LEAD_MIN = 5;
export const FALLBACK_LEAD_MIN = 2;
export const REMINDER_LEAD_MIN = 10;
/** The room opens this many minutes before the start. */
export const ROOM_OPENS_MIN = 5;

const MINUTE = 60_000;
const SLOT_MS = SLOT_MINUTES * MINUTE;

export function isDuration(value: unknown): value is Duration {
  return DURATIONS.includes(value as Duration);
}

/** Slots start at :00 and :30 UTC with no seconds. */
export function isSlotStart(date: Date) {
  return date.getTime() % SLOT_MS === 0;
}

export function floorToSlot(date: Date) {
  return new Date(Math.floor(date.getTime() / SLOT_MS) * SLOT_MS);
}

export function nextSlot(date: Date) {
  return new Date(Math.floor(date.getTime() / SLOT_MS) * SLOT_MS + SLOT_MS);
}

export function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * MINUTE);
}

export function minutesUntil(target: Date, now: Date) {
  return (target.getTime() - now.getTime()) / MINUTE;
}

export function endOf(startAt: Date, durationMin: number) {
  return addMinutes(startAt, durationMin);
}

export type BookableCheck =
  | { ok: true }
  | { ok: false; reason: "not_slot" | "too_late" | "too_far" | "duration" };

export function checkBookable(
  startAt: Date,
  durationMin: number,
  now = new Date(),
): BookableCheck {
  if (!isDuration(durationMin)) return { ok: false, reason: "duration" };
  if (!isSlotStart(startAt)) return { ok: false, reason: "not_slot" };
  if (minutesUntil(startAt, now) < BOOKING_CUTOFF_MIN)
    return { ok: false, reason: "too_late" };
  if (minutesUntil(startAt, now) > MAX_DAYS_AHEAD * 24 * 60)
    return { ok: false, reason: "too_far" };
  return { ok: true };
}

export function isFreeCancellation(startAt: Date, now = new Date()) {
  return minutesUntil(startAt, now) >= FREE_CANCEL_MIN;
}

export function isValidTimeZone(timeZone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** Monday 00:00 to the next Monday 00:00 in the user's zone, as UTC instants. */
export function weekBounds(date: Date, timeZone: string) {
  const local = new TZDate(date.getTime(), timeZone);
  const start = startOfWeek(local, { weekStartsOn: 1 });
  const end = addWeeks(start, 1);
  return { start: new Date(start.getTime()), end: new Date(end.getTime()) };
}

/** Calendar day in the user's zone, e.g. "2026-03-08". */
export function localDayKey(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function localDayStart(date: Date, timeZone: string) {
  return new Date(startOfDay(new TZDate(date.getTime(), timeZone)).getTime());
}

export type GridDay = { key: string; start: Date; slots: Date[] };

/**
 * Seven local days starting at `weekStart`'s local day. Each day lists the slot
 * instants that fall inside it, so DST days get 46 or 50 slots instead of 48.
 */
export function weekGrid(weekStart: Date, timeZone: string, days = 7) {
  const first = startOfDay(new TZDate(weekStart.getTime(), timeZone));
  const result: GridDay[] = [];
  for (let i = 0; i < days; i++) {
    const dayStart = new Date(addDays(first, i).getTime());
    const dayEnd = new Date(addDays(first, i + 1).getTime());
    const slots: Date[] = [];
    for (
      let t = Math.ceil(dayStart.getTime() / SLOT_MS) * SLOT_MS;
      t < dayEnd.getTime();
      t += SLOT_MS
    )
      slots.push(new Date(t));
    result.push({
      key: localDayKey(dayStart, timeZone),
      start: dayStart,
      slots,
    });
  }
  return result;
}

export const US_ZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
] as const;
export const EU_ZONES = [
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Amsterdam",
] as const;

/** People in Europe see European working hours as popular; everyone else the US ones. */
export function popularZonesFor(timeZone: string): readonly string[] {
  return timeZone.startsWith("Europe/") || timeZone === "Atlantic/Reykjavik"
    ? EU_ZONES
    : US_ZONES;
}

function localParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const weekday = parts.find((p) => p.type === "weekday")!.value;
  const hour = Number(parts.find((p) => p.type === "hour")!.value);
  return { weekday, hour };
}

/** How many of the given zones are inside weekday working hours (9:00–17:00) at this instant. */
export function businessHourScore(
  date: Date,
  zones: readonly string[] = US_ZONES,
) {
  return zones.filter((zone) => {
    const { weekday, hour } = localParts(date, zone);
    return weekday !== "Sat" && weekday !== "Sun" && hour >= 9 && hour < 17;
  }).length;
}

/** A slot is "popular" when most US time zones are at work. */
export function isPopularSlot(date: Date, zones: readonly string[] = US_ZONES) {
  return businessHourScore(date, zones) >= Math.ceil(zones.length * 0.75);
}
