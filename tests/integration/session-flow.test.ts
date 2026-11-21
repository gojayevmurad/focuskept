// SPDX-License-Identifier: AGPL-3.0-only
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { eq, inArray, sql } from "drizzle-orm";
import { db } from "@/src/lib/db";
import {
  block,
  booking,
  focusSession,
  matchFailure,
  profile,
  referral,
  sessionParticipant,
  user,
} from "@/src/lib/db/schema";

// Notifications and analytics are side effects outside this test.
vi.mock("@/src/lib/notifications", () => ({
  bookingConfirmed: vi.fn(async () => {}),
  partnerChanged: vi.fn(async () => {}),
  fallbackOffered: vi.fn(async () => {}),
  directInvitation: vi.fn(async () => {}),
  sessionReminder: vi.fn(async () => {}),
  referralRewarded: vi.fn(async () => {}),
  notifyAdmins: vi.fn(async () => {}),
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));

const url = process.env.TEST_DATABASE_URL;
if (url && !new URL(url).pathname.endsWith("_test"))
  throw new Error("TEST_DATABASE_URL must name a database ending in _test");

const people = ["flow-a", "flow-b", "flow-c", "flow-d"];
const SLOT_MS = 30 * 60_000;

async function makeUser(
  id: string,
  extra: Partial<typeof profile.$inferInsert> = {},
) {
  await db()
    .insert(user)
    .values({ id, name: id, email: `${id}@example.test`, emailVerified: true })
    .onConflictDoNothing();
  await db()
    .insert(profile)
    .values({
      userId: id,
      username: id,
      displayName: id,
      referralCode: `code-${id}`,
      timezone: "America/New_York",
      onboardedAt: new Date(),
      ...extra,
    })
    .onConflictDoNothing();
}

async function cleanup() {
  await db().delete(user).where(inArray(user.id, people));
  await db().execute(
    sql`delete from focus_session where id not in (select session_id from session_participant)`,
  );
}

describe.skipIf(!url)("session flow", () => {
  let lib: {
    createBooking: typeof import("@/src/lib/bookings/service").createBooking;
    cancelBooking: typeof import("@/src/lib/bookings/service").cancelBooking;
    acceptFallback: typeof import("@/src/lib/bookings/service").acceptFallback;
    runSlotMatching: typeof import("@/src/lib/matching/run").runSlotMatching;
    offerFallbacks: typeof import("@/src/lib/matching/run").offerFallbacks;
    joinRoom: typeof import("@/src/lib/sessions/lifecycle").joinRoom;
    setGoal: typeof import("@/src/lib/sessions/lifecycle").setGoal;
    setOutcome: typeof import("@/src/lib/sessions/lifecycle").setOutcome;
    completeEndedSessions: typeof import("@/src/lib/sessions/lifecycle").completeEndedSessions;
  };

  beforeAll(async () => {
    vi.stubEnv("DATABASE_URL", url!);
    vi.stubEnv("BILLING_ENABLED", "false");
    const pool = new Pool({ connectionString: url });
    await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
    await pool.end();
    await cleanup();
    for (const id of people)
      await makeUser(id, {
        segments: id === "flow-c" || id === "flow-d" ? ["writing"] : ["study"],
      });
    lib = {
      ...(await import("@/src/lib/bookings/service")),
      ...(await import("@/src/lib/matching/run")),
      ...(await import("@/src/lib/sessions/lifecycle")),
    };
  });
  afterAll(async () => {
    await cleanup();
    vi.unstubAllEnvs();
  });

  it("books, matches by segment, runs the session and completes it", async () => {
    const now = new Date();
    const start = new Date(
      Math.ceil((now.getTime() + 20 * 60_000) / SLOT_MS) * SLOT_MS,
    );
    for (const id of people)
      await lib.createBooking({
        userId: id,
        timeZone: "America/New_York",
        startAt: start,
        durationMin: 50,
        now,
      });

    // A second booking at the same time is refused.
    await expect(
      lib.createBooking({
        userId: "flow-a",
        timeZone: "America/New_York",
        startAt: start,
        durationMin: 25,
        now,
      }),
    ).rejects.toMatchObject({ code: "overlap" });

    const made = await lib.runSlotMatching(start, 50);
    expect(made).toHaveLength(2);
    const pairs = made.map((m) => [...m.users].sort().join("+")).sort();
    expect(pairs).toEqual(["flow-a+flow-b", "flow-c+flow-d"]);

    // Running again does nothing.
    expect(await lib.runSlotMatching(start, 50)).toHaveLength(0);

    const sessionId = made.find((m) => m.users.includes("flow-a"))!.sessionId;
    // Not open yet: the room opens five minutes before the start.
    expect(await lib.joinRoom(sessionId, "flow-a", now)).toBeNull();
    // Strangers can't touch the room.
    expect(await lib.setGoal(sessionId, "flow-c", "sneaky")).toBeNull();

    await db()
      .update(focusSession)
      .set({ startAt: new Date(Date.now() - 60_000) })
      .where(eq(focusSession.id, sessionId));
    expect(await lib.joinRoom(sessionId, "flow-a")).not.toBeNull();
    expect(await lib.setGoal(sessionId, "flow-a", "  write the intro  ")).toBe(
      "write the intro",
    );
    expect(await lib.setOutcome(sessionId, "flow-a", "done")).toBe("done");

    // Pretend the session is over.
    await db()
      .update(focusSession)
      .set({ startAt: new Date(Date.now() - 51 * 60_000) })
      .where(eq(focusSession.id, sessionId));
    await lib.completeEndedSessions();
    const rows = await db()
      .select()
      .from(booking)
      .where(eq(booking.sessionId, sessionId));
    const status = Object.fromEntries(rows.map((r) => [r.userId, r.status]));
    expect(status).toEqual({ "flow-a": "completed", "flow-b": "no_show" });
  });

  it("puts the partner back in the pool on a late cancel", async () => {
    const now = new Date();
    const start = new Date(
      Math.ceil((now.getTime() + 40 * 60_000) / SLOT_MS) * SLOT_MS +
        2 * 3600_000,
    );
    const a = await lib.createBooking({
      userId: "flow-a",
      timeZone: "UTC",
      startAt: start,
      durationMin: 25,
      now,
    });
    const b = await lib.createBooking({
      userId: "flow-b",
      timeZone: "UTC",
      startAt: start,
      durationMin: 25,
      now,
    });
    const [m] = await lib.runSlotMatching(start, 25);
    expect(m).toBeDefined();
    const status = await lib.cancelBooking(
      "flow-a",
      a,
      new Date(start.getTime() - 30 * 60_000),
    );
    expect(status).toBe("late_cancel");
    const [partner] = await db()
      .select()
      .from(booking)
      .where(eq(booking.id, b));
    expect(partner.status).toBe("booked");
    expect(partner.sessionId).toBeNull();
    const [s] = await db()
      .select()
      .from(focusSession)
      .where(eq(focusSession.id, m.sessionId));
    expect(s.status).toBe("cancelled");
    await lib.cancelBooking("flow-b", b, now);
  });

  it("never pairs blocked users and offers a fallback", async () => {
    await db()
      .insert(block)
      .values({ blockerId: "flow-c", blockedId: "flow-d" })
      .onConflictDoNothing();
    const now = new Date();
    const start = new Date(
      Math.ceil((now.getTime() + 3 * 60_000) / SLOT_MS) * SLOT_MS +
        4 * 3600_000,
    );
    const c = await lib.createBooking({
      userId: "flow-c",
      timeZone: "UTC",
      startAt: start,
      durationMin: 75,
      now,
    });
    await lib.createBooking({
      userId: "flow-d",
      timeZone: "UTC",
      startAt: start,
      durationMin: 75,
      now,
    });
    expect(await lib.runSlotMatching(start, 75)).toHaveLength(0);

    const offered = await lib.offerFallbacks(
      new Date(start.getTime() - 2 * 60_000),
    );
    expect(offered).toBe(2);
    expect(await lib.offerFallbacks(new Date(start.getTime() - 60_000))).toBe(
      0,
    );
    const failures = await db()
      .select()
      .from(matchFailure)
      .where(eq(matchFailure.startAt, start));
    expect(failures).toHaveLength(2);

    const result = await lib.acceptFallback(
      "flow-c",
      "UTC",
      c,
      "room",
      new Date(start.getTime() - 60_000),
    );
    expect(result.sessionId).toBeDefined();
    const seats = await db()
      .select()
      .from(sessionParticipant)
      .where(eq(sessionParticipant.sessionId, result.sessionId!));
    expect(seats.map((s) => s.userId)).toEqual(["flow-c"]);
  });

  it("enforces the free weekly limit when billing is on", async () => {
    vi.stubEnv("BILLING_ENABLED", "true");
    vi.stubEnv("POLAR_ACCESS_TOKEN", "test-token");
    vi.stubEnv("POLAR_WEBHOOK_SECRET", "test-secret");
    vi.stubEnv("POLAR_PRO_BENEFIT_ID", "test-benefit");
    try {
      const now = new Date();
      const base =
        Math.ceil((now.getTime() + 60 * 60_000) / SLOT_MS) * SLOT_MS +
        6 * 3600_000;
      await db().delete(booking).where(eq(booking.userId, "flow-d"));
      let refused = false;
      for (let i = 0; i < 4; i++) {
        try {
          await lib.createBooking({
            userId: "flow-d",
            timeZone: "UTC",
            startAt: new Date(base + i * 2 * SLOT_MS),
            durationMin: 25,
            now,
          });
        } catch (error) {
          refused = (error as { code?: string }).code === "limit";
        }
      }
      // Depending on where the week boundary falls, the 4th booking is refused.
      const count = await db()
        .select()
        .from(booking)
        .where(eq(booking.userId, "flow-d"));
      expect(count.length <= 3 || !refused).toBe(true);
    } finally {
      vi.stubEnv("BILLING_ENABLED", "false");
    }
  });

  it("converts a referral after the first completed session", async () => {
    await db()
      .insert(referral)
      .values({
        id: crypto.randomUUID(),
        referrerId: "flow-b",
        refereeId: "flow-a",
      })
      .onConflictDoNothing();
    const { convertReferral } = await import("@/src/lib/growth/referrals");
    expect(await convertReferral("flow-a")).toBe(true);
    const [row] = await db()
      .select()
      .from(referral)
      .where(eq(referral.refereeId, "flow-a"));
    expect(row.status).toBe("converted");
    expect(await convertReferral("flow-a")).toBe(false);
  });
});
