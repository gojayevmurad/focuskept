// SPDX-License-Identifier: AGPL-3.0-only
export const ANCHOR_WEEKDAYS = [
  "sun",
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
] as const;

export type AnchorWeekday = (typeof ANCHOR_WEEKDAYS)[number];

export const DEFAULT_ANCHOR_WEEKDAYS: readonly AnchorWeekday[] = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
];

function utcDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  )
    throw new Error(`Invalid UTC date: ${value}; expected YYYY-MM-DD`);
  return date;
}

export function expandAnchorSlots(input: {
  from: string;
  to: string;
  times: readonly string[];
  weekdays?: readonly AnchorWeekday[];
}): Date[] {
  const first = utcDate(input.from);
  const last = utcDate(input.to);
  if (first > last) throw new Error("--from must be on or before --to");
  if (!input.times.length) throw new Error("At least one UTC time is required");
  const times = [...new Set(input.times)].sort();
  for (const time of times)
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time))
      throw new Error(`Invalid UTC time: ${time}; expected HH:MM`);

  const weekdays = new Set(input.weekdays ?? DEFAULT_ANCHOR_WEEKDAYS);
  for (const weekday of weekdays)
    if (!ANCHOR_WEEKDAYS.includes(weekday))
      throw new Error(`Invalid weekday: ${weekday}`);

  const slots: Date[] = [];
  for (
    const day = new Date(first);
    day <= last;
    day.setUTCDate(day.getUTCDate() + 1)
  ) {
    if (!weekdays.has(ANCHOR_WEEKDAYS[day.getUTCDay()])) continue;
    const date = day.toISOString().slice(0, 10);
    for (const time of times) slots.push(new Date(`${date}T${time}:00.000Z`));
  }
  return slots;
}
