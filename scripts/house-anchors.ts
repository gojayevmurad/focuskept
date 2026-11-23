// SPDX-License-Identifier: AGPL-3.0-only
import { parseArgs } from "node:util";
import { and, eq, gt, inArray, lt, sql } from "drizzle-orm";
import { db } from "@/src/lib/db";
import { booking, profile, user } from "@/src/lib/db/schema";
import {
  ANCHOR_WEEKDAYS,
  DEFAULT_ANCHOR_WEEKDAYS,
  expandAnchorSlots,
  type AnchorWeekday,
} from "@/src/lib/bookings/anchors";
import { BookingFailure, createBooking } from "@/src/lib/bookings/service";
import {
  addMinutes,
  BOOKING_CUTOFF_MIN,
  checkBookable,
  isDuration,
  MAX_DAYS_AHEAD,
  minutesUntil,
} from "@/src/lib/scheduling/slots";

const usage = `Usage: node .house-anchors.cjs --email ADDRESS --from YYYY-MM-DD --to YYYY-MM-DD --times HH:MM,HH:MM [options]

Dates are inclusive and all dates/times are UTC.
  --weekdays mon,tue,wed,thu,fri  Default: Mon–Fri (also accepts sat,sun)
  --duration 25|50|75            Default: 50 minutes
  --dry-run                     Preview slot rules and overlaps without writes
  --set-house                   Set profile.is_house before booking
  --help                        Show this help

Dry-run created lines mean would-create; booking-time plan limits are checked on a real run.
With --dry-run --set-house, house status is simulated without updating the profile.
House slots beyond ${MAX_DAYS_AHEAD} days use startAt minus 7 days as the booking clock.`;

async function main() {
  const { values } = parseArgs({
    options: {
      email: { type: "string" },
      from: { type: "string" },
      to: { type: "string" },
      times: { type: "string" },
      weekdays: { type: "string" },
      duration: { type: "string", default: "50" },
      "dry-run": { type: "boolean", default: false },
      "set-house": { type: "boolean", default: false },
      help: { type: "boolean", default: false },
    },
    allowPositionals: false,
    strict: true,
  });
  if (values.help) {
    console.log(usage);
    return;
  }
  const required = (name: "email" | "from" | "to" | "times") => {
    const value = values[name]?.trim();
    if (!value) throw new Error(`--${name} is required\n${usage}`);
    return value;
  };
  const email = required("email");
  if (!/^[^\s@]+@[^\s@]+$/.test(email))
    throw new Error("--email must be an email address");
  const durationMin = Number(values.duration);
  if (!isDuration(durationMin))
    throw new Error("--duration must be 25, 50, or 75");
  const weekdays =
    values.weekdays !== undefined
      ? values.weekdays.split(",").map((value) => value.trim().toLowerCase())
      : [...DEFAULT_ANCHOR_WEEKDAYS];
  for (const weekday of weekdays)
    if (!ANCHOR_WEEKDAYS.includes(weekday as AnchorWeekday))
      throw new Error(
        `Invalid weekday: ${weekday}; use mon,tue,wed,thu,fri,sat,sun`,
      );
  const slots = expandAnchorSlots({
    from: required("from"),
    to: required("to"),
    times: required("times")
      .split(",")
      .map((value) => value.trim()),
    weekdays: weekdays as AnchorWeekday[],
  });
  const dryRun = values["dry-run"];
  const database = db();
  try {
    const rows = await database
      .select({ userId: user.id, profile })
      .from(user)
      .leftJoin(profile, eq(profile.userId, user.id))
      .where(sql`lower(${user.email}) = lower(${email})`)
      .limit(2);
    if (!rows.length) throw new Error(`User not found: ${email}`);
    if (rows.length > 1)
      throw new Error(
        `Multiple users match this email case-insensitively: ${email}`,
      );
    const { userId, profile: prof } = rows[0];
    if (!prof?.onboardedAt) throw new Error(`User is not onboarded: ${email}`);
    if (prof.suspendedAt) throw new Error(`User is suspended: ${email}`);
    if (values["set-house"] && !prof.isHouse) {
      if (!dryRun)
        await database
          .update(profile)
          .set({ isHouse: true, updatedAt: new Date() })
          .where(eq(profile.userId, userId));
      console.log(
        dryRun
          ? "Dry run: would set profile.is_house=true"
          : "Set profile.is_house=true",
      );
    }
    const isHouse = prof.isHouse || values["set-house"];
    if (dryRun)
      console.log(
        "Dry run: created means would-create; no writes; booking-time plan limits are not evaluated.",
      );
    const counts = {
      created: 0,
      exists: 0,
      past: 0,
      failed: 0,
      wouldCreate: 0,
    };
    const planned: { startAt: Date; endAt: Date }[] = [];
    for (const startAt of slots) {
      const report = (result: string, detail = "") =>
        console.log(
          `${startAt.toISOString()} ${result}${detail ? ` ${detail}` : ""}`,
        );
      const now = new Date();
      if (minutesUntil(startAt, now) < BOOKING_CUTOFF_MIN) {
        counts.past++;
        report("skipped-past");
        continue;
      }
      const override =
        isHouse && minutesUntil(startAt, now) > MAX_DAYS_AHEAD * 24 * 60;
      const bookingNow = override ? addMinutes(startAt, -7 * 24 * 60) : now;
      const detail = override
        ? `house-horizon-override now=${bookingNow.toISOString()} (startAt minus 7 days)`
        : "";
      try {
        const endAt = addMinutes(startAt, durationMin);
        const [overlap] = await database
          .select({ id: booking.id })
          .from(booking)
          .where(
            and(
              eq(booking.userId, userId),
              inArray(booking.status, ["booked", "matched"]),
              lt(booking.startAt, endAt),
              gt(
                sql`${booking.startAt} + make_interval(mins => ${booking.durationMin})`,
                startAt,
              ),
            ),
          )
          .limit(1);
        if (
          overlap ||
          planned.some((slot) => slot.startAt < endAt && slot.endAt > startAt)
        ) {
          counts.exists++;
          report("skipped-exists");
          continue;
        }
        if (dryRun) {
          const check = checkBookable(startAt, durationMin, bookingNow);
          if (!check.ok) throw new BookingFailure(check.reason);
          planned.push({ startAt, endAt });
          counts.wouldCreate++;
          report("created", `dry-run=true ${detail}`.trim());
          continue;
        }
        const id = await createBooking({
          userId,
          timeZone: prof.timezone,
          startAt,
          durationMin,
          ...(override ? { now: bookingNow } : {}),
          awaitSideEffects: true,
        });
        counts.created++;
        report("created", `bookingId=${id} ${detail}`.trim());
      } catch (error) {
        if (error instanceof BookingFailure && error.code === "overlap") {
          counts.exists++;
          report("skipped-exists");
        } else if (
          error instanceof BookingFailure &&
          error.code === "too_late"
        ) {
          counts.past++;
          report("skipped-past");
        } else {
          counts.failed++;
          report(
            `failed:${error instanceof BookingFailure ? error.code : "unexpected"}`,
            detail,
          );
          if (!(error instanceof BookingFailure)) console.error(error);
        }
      }
    }
    console.log(
      `Summary: total=${slots.length} created=${counts.created} skipped-exists=${counts.exists} skipped-past=${counts.past} failed=${counts.failed}${dryRun ? ` would-create=${counts.wouldCreate} dry-run=true` : ""}`,
    );
    if (counts.failed) process.exitCode = 1;
  } finally {
    await database.$client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
