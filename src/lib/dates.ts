// Pure calendar helpers. A "date" here is a local calendar day `YYYY-MM-DD`
// in some IANA timezone. Day arithmetic happens on the calendar (UTC noon), so
// daylight-saving transitions can never shift a date.

const partsCache = new Map<string, Intl.DateTimeFormat>();
function formatter(timeZone: string) {
  let f = partsCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      weekday: "short",
    });
    partsCache.set(timeZone, f);
  }
  return f;
}

export function isValidTimeZone(timeZone: string) {
  if (!timeZone || timeZone.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Local wall-clock parts of an instant in a timezone. */
export function zonedParts(timeZone: string, at: Date = new Date()) {
  const parts = Object.fromEntries(
    formatter(timeZone)
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
    hour: Number(parts.hour),
    weekday: weekdays.indexOf(parts.weekday),
  };
}

/** Today's calendar date in a timezone. */
export function localDate(timeZone: string, at: Date = new Date()) {
  return zonedParts(timeZone, at).date;
}

/** Local time `HH:MM` in a timezone. */
export function localTime(timeZone: string, at: Date = new Date()) {
  return zonedParts(timeZone, at).time;
}

function toUtcNoon(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d, 12);
}
function fromUtc(ms: number) {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(date: string, days: number) {
  return fromUtc(toUtcNoon(date) + days * 86400000);
}

/** Whole calendar days from `a` to `b` (b - a). */
export function diffDays(a: string, b: string) {
  return Math.round((toUtcNoon(b) - toUtcNoon(a)) / 86400000);
}

/** 0 = Sunday … 6 = Saturday. */
export function weekdayOf(date: string) {
  return new Date(toUtcNoon(date)).getUTCDay();
}

/** First day of the week containing `date`. */
export function startOfWeek(date: string, weekStartsOn: number) {
  const offset = (weekdayOf(date) - weekStartsOn + 7) % 7;
  return addDays(date, -offset);
}

/** Calendar month `YYYY-MM` of a local date. */
export function monthKey(date: string) {
  return date.slice(0, 7);
}

export function startOfMonth(date: string) {
  return `${date.slice(0, 7)}-01`;
}

/** ISO-8601 week key, e.g. `2026-W45` (weeks start Monday). */
export function isoWeekKey(date: string) {
  const d = new Date(toUtcNoon(date));
  const dayIndex = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - dayIndex + 3); // Thursday decides the year
  const year = d.getUTCFullYear();
  const jan4 = new Date(Date.UTC(year, 0, 4, 12));
  const jan4Index = (jan4.getUTCDay() + 6) % 7;
  const week1Thursday = jan4.getTime() + (3 - jan4Index) * 86400000;
  const week = 1 + Math.round((d.getTime() - week1Thursday) / (7 * 86400000));
  return `${year}-W${String(week).padStart(2, "0")}`;
}

export function isTimeOfDay(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

/** True when `time` (HH:MM) is within [start, end). Supports windows past midnight. */
export function withinWindow(time: string, start: string, end: string) {
  if (start === end) return true;
  return start < end
    ? time >= start && time < end
    : time >= start || time < end;
}

export function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return fromUtc(toUtcNoon(value)) === value;
}
