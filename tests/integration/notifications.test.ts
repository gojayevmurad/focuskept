import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import {
  createTestUsers,
  deleteTestUsers,
  setupTestDatabase,
  testDatabaseUrl,
} from "../support/db";
import { db } from "@/src/lib/db";
import {
  emailPreview,
  learningItem,
  notificationLog,
  question,
  userPreferences,
  user,
} from "@/src/lib/db/schema";
import {
  runReviewDigest,
  runWeeklyReport,
  runCleanup,
} from "@/src/features/notifications/jobs";
import {
  claimNotification,
  markNotification,
} from "@/src/features/notifications/log";
import { signUnsubscribe } from "@/src/features/notifications/tokens";
import { POST as cronPost } from "@/app/api/cron/[job]/route";
import { POST as unsubscribePost } from "@/app/api/unsubscribe/route";

vi.mock("@/src/lib/billing/entitlements", () => ({
  hasEntitlement: vi.fn(async (id: string) => id.endsWith("-pro")),
}));

const FREE = "nt-user";
const PRO = "nt-user-pro";
const SECRET = "x".repeat(40);
const AUTH = "y".repeat(48);

beforeAll(async () => {
  if (!(await setupTestDatabase())) return;
  vi.stubEnv("EMAIL_MODE", "preview");
  vi.stubEnv("CRON_SECRET", SECRET);
  vi.stubEnv("BETTER_AUTH_SECRET", AUTH);
  vi.stubEnv("VAPID_PUBLIC_KEY", "");
  vi.stubEnv("VAPID_PRIVATE_KEY", "");
  await createTestUsers(FREE, PRO);
  for (const id of [FREE, PRO]) {
    await db()
      .insert(userPreferences)
      .values({
        userId: id,
        timezone: "Asia/Tokyo",
        dailyReminderTime: "08:00",
        locale: "de",
      })
      .onConflictDoNothing();
    const cardId = crypto.randomUUID();
    await db()
      .insert(learningItem)
      .values({
        id: cardId,
        userId: id,
        topic: `Topic ${id}`,
        learningMethod: "feynman",
        explanation: "e",
        intervalDays: 5,
        dueOn: "2026-11-01",
      });
    await db().insert(question).values({
      id: crypto.randomUUID(),
      learningItemId: cardId,
      type: "open",
      prompt: "p",
      answer: "a",
    });
  }
});
afterAll(async () => {
  if (testDatabaseUrl) {
    await deleteTestUsers(FREE, PRO);
    await db()
      .delete(emailPreview)
      .where(eq(emailPreview.kind, "review_digest"));
    await db()
      .delete(emailPreview)
      .where(eq(emailPreview.kind, "weekly_report"));
  }
  vi.unstubAllEnvs();
});

describe.skipIf(!testDatabaseUrl)("notification jobs", () => {
  // 2026-11-02 00:30 UTC = 09:30 Monday in Tokyo.
  const monday = new Date("2026-11-02T00:30:00Z");

  it("sends exactly one digest per user and day, even under concurrent cron calls", async () => {
    const before = new Date("2026-11-01T22:30:00Z"); // 07:30 Tokyo: before reminder time
    expect((await runReviewDigest(before)).emails).toBe(0);
    const results = await Promise.all([
      runReviewDigest(monday),
      runReviewDigest(monday),
      runReviewDigest(monday),
    ]);
    expect(results.reduce((n, r) => n + r.emails, 0)).toBe(2);
    const mails = await db()
      .select()
      .from(emailPreview)
      .where(eq(emailPreview.kind, "review_digest"));
    expect(
      mails.filter((m) => m.recipient === `${FREE}@example.test`),
    ).toHaveLength(1);
    expect(mails[0].url).toContain("/de/app/review");
    const [log] = await db()
      .select()
      .from(notificationLog)
      .where(
        and(
          eq(notificationLog.userId, FREE),
          eq(notificationLog.kind, "review_digest"),
        ),
      );
    expect(log).toMatchObject({
      status: "sent",
      periodKey: "2026-11-02",
      channel: "email",
      attempts: 1,
    });
    expect((await runReviewDigest(monday)).emails).toBe(0);
  });

  it("retries failed sends at most three times", async () => {
    const period = `retry-${Date.now()}`;
    for (let i = 0; i < 3; i++) {
      const id = await claimNotification(FREE, "test", "email", period);
      expect(id).toBeTruthy();
      expect(await claimNotification(FREE, "test", "email", period)).toBeNull();
      await markNotification(id!, "failed", "Boom");
    }
    expect(await claimNotification(FREE, "test", "email", period)).toBeNull();
  });

  it("sends the weekly report to Pro users only, Monday after 09:00 local", async () => {
    expect((await runWeeklyReport(new Date("2026-11-01T23:30:00Z"))).sent).toBe(
      0,
    ); // 08:30 Tokyo
    const result = await runWeeklyReport(monday);
    expect(result.sent).toBe(1);
    const mails = await db()
      .select()
      .from(emailPreview)
      .where(eq(emailPreview.kind, "weekly_report"));
    expect(mails.map((m) => m.recipient)).toEqual([`${PRO}@example.test`]);
    expect((await runWeeklyReport(monday)).sent).toBe(0);
  });

  it("respects one-click unsubscribe and stops the digest", async () => {
    const token = signUnsubscribe(AUTH, FREE, "reviews");
    const response = await unsubscribePost(
      new Request(`http://localhost/api/unsubscribe?token=${token}`, {
        method: "POST",
      }),
    );
    expect(response.status).toBe(200);
    const [prefs] = await db()
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, FREE));
    expect(prefs.emailReviews).toBe(false);
    expect(
      (
        await unsubscribePost(
          new Request("http://localhost/api/unsubscribe?token=forged.x", {
            method: "POST",
          }),
        )
      ).status,
    ).toBe(400);
    const nextDay = new Date("2026-11-03T00:30:00Z");
    const mailsBefore = (
      await db()
        .select()
        .from(emailPreview)
        .where(eq(emailPreview.recipient, `${FREE}@example.test`))
    ).length;
    await runReviewDigest(nextDay);
    const mailsAfter = (
      await db()
        .select()
        .from(emailPreview)
        .where(eq(emailPreview.recipient, `${FREE}@example.test`))
    ).length;
    expect(mailsAfter).toBe(mailsBefore);
  });

  it("rejects cron calls without the bearer secret and runs cleanup with it", async () => {
    const call = (auth?: string) =>
      cronPost(
        new Request("http://localhost/api/cron/cleanup", {
          method: "POST",
          headers: auth ? { authorization: auth } : {},
        }),
        {
          params: Promise.resolve({ job: "cleanup" }),
        },
      );
    expect((await call()).status).toBe(401);
    expect((await call("Bearer wrong")).status).toBe(401);
    const ok = await call(`Bearer ${SECRET}`);
    expect(ok.status).toBe(200);
    expect((await ok.json()).result).toHaveProperty("notifications");
    expect(await runCleanup()).toHaveProperty("drafts");
    const unknown = await cronPost(
      new Request("http://localhost/api/cron/x", {
        method: "POST",
        headers: { authorization: `Bearer ${SECRET}` },
      }),
      {
        params: Promise.resolve({ job: "x" }),
      },
    );
    expect(unknown.status).toBe(404);
    await db().update(user).set({ name: "unchanged" }).where(eq(user.id, FREE));
  });
});
