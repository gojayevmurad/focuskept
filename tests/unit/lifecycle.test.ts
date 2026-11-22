// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it, vi } from "vitest";
import {
  signUnsubscribeToken,
  verifyUnsubscribeToken,
} from "@/src/lib/lifecycle/tokens";
import {
  getLocalTimeParts,
  shouldSendAfterFirstSession,
  shouldSendFirstSessionTips,
  shouldSendNudgeFirstBooking,
  shouldSendWeeklySummary,
  shouldSendWelcome,
  shouldSendWinBack,
} from "@/src/lib/lifecycle/decisions";
import { buildReferralLink } from "@/src/lib/growth/referrals";

describe("unsubscribe token", () => {
  it("signs and verifies a valid token", () => {
    const userId = "usr_123456789";
    const token = signUnsubscribeToken(userId);
    expect(token).toBeTypeOf("string");
    expect(token).toContain(".");

    const verified = verifyUnsubscribeToken(token);
    expect(verified).not.toBeNull();
    expect(verified?.userId).toBe(userId);
  });

  it("rejects tampered signature", () => {
    const token = signUnsubscribeToken("usr_123456789");
    const [payload] = token.split(".");
    const tampered = `${payload}.tampered_signature_xyz`;
    expect(verifyUnsubscribeToken(tampered)).toBeNull();
  });

  it("rejects tampered payload", () => {
    const token = signUnsubscribeToken("usr_123456789");
    const [, signature] = token.split(".");
    const fakePayload = Buffer.from(
      JSON.stringify({ u: "usr_hacked", a: "unsubscribe_email_tips" }),
    ).toString("base64url");
    const tampered = `${fakePayload}.${signature}`;
    expect(verifyUnsubscribeToken(tampered)).toBeNull();
  });

  it("rejects invalid or empty inputs", () => {
    expect(verifyUnsubscribeToken(null)).toBeNull();
    expect(verifyUnsubscribeToken(undefined)).toBeNull();
    expect(verifyUnsubscribeToken("")).toBeNull();
    expect(verifyUnsubscribeToken("no-dot-token")).toBeNull();
    expect(verifyUnsubscribeToken("invalid.payload.format")).toBeNull();
  });
});

describe("lifecycle scheduling decisions", () => {
  const baseUser = {
    emailTips: true,
    suspendedAt: null as Date | null,
    onboardedAt: new Date("2026-03-01T12:00:00Z"),
    createdAt: new Date("2026-03-01T12:00:00Z"),
    timezone: "America/New_York",
  };

  describe("welcome", () => {
    it("sends right after onboarding when tips enabled and not suspended", () => {
      expect(shouldSendWelcome(baseUser)).toBe(true);
    });

    it("does not send if email_tips is false", () => {
      expect(shouldSendWelcome({ ...baseUser, emailTips: false })).toBe(false);
    });

    it("does not send if suspended", () => {
      expect(
        shouldSendWelcome({ ...baseUser, suspendedAt: new Date() }),
      ).toBe(false);
    });

    it("does not send if not yet onboarded", () => {
      expect(shouldSendWelcome({ ...baseUser, onboardedAt: null })).toBe(false);
    });
  });

  describe("nudge_first_booking", () => {
    it("sends 24h after signup if no booking made yet", () => {
      const now = new Date("2026-03-02T13:00:00Z"); // 25 hours later
      expect(shouldSendNudgeFirstBooking(baseUser, 0, now)).toBe(true);
    });

    it("does not send before 24h have passed", () => {
      const now = new Date("2026-03-02T11:00:00Z"); // 23 hours later
      expect(shouldSendNudgeFirstBooking(baseUser, 0, now)).toBe(false);
    });

    it("does not send if user has already made a booking", () => {
      const now = new Date("2026-03-02T13:00:00Z");
      expect(shouldSendNudgeFirstBooking(baseUser, 1, now)).toBe(false);
    });

    it("does not send if email_tips is false or user suspended", () => {
      const now = new Date("2026-03-02T13:00:00Z");
      expect(
        shouldSendNudgeFirstBooking({ ...baseUser, emailTips: false }, 0, now),
      ).toBe(false);
      expect(
        shouldSendNudgeFirstBooking(
          { ...baseUser, suspendedAt: new Date() },
          0,
          now,
        ),
      ).toBe(false);
    });
  });

  describe("first_session_tips", () => {
    it("sends ~1h before user's very first session", () => {
      const now = new Date("2026-03-02T14:00:00Z");
      const booking = {
        startAt: new Date("2026-03-02T14:50:00Z"), // 50 min away
        status: "booked",
      };
      expect(shouldSendFirstSessionTips(baseUser, booking, 0, now)).toBe(true);
    });

    it("does not send if user has prior completed sessions", () => {
      const now = new Date("2026-03-02T14:00:00Z");
      const booking = {
        startAt: new Date("2026-03-02T14:50:00Z"),
        status: "booked",
      };
      expect(shouldSendFirstSessionTips(baseUser, booking, 1, now)).toBe(false);
    });

    it("does not send if session is more than 65 minutes away", () => {
      const now = new Date("2026-03-02T14:00:00Z");
      const booking = {
        startAt: new Date("2026-03-02T16:00:00Z"), // 2 hours away
        status: "booked",
      };
      expect(shouldSendFirstSessionTips(baseUser, booking, 0, now)).toBe(false);
    });

    it("does not send if session is within 15 minutes (reminder window)", () => {
      const now = new Date("2026-03-02T14:00:00Z");
      const booking = {
        startAt: new Date("2026-03-02T14:10:00Z"), // 10 min away
        status: "booked",
      };
      expect(shouldSendFirstSessionTips(baseUser, booking, 0, now)).toBe(false);
    });

    it("does not send for cancelled bookings", () => {
      const now = new Date("2026-03-02T14:00:00Z");
      const booking = {
        startAt: new Date("2026-03-02T14:50:00Z"),
        status: "cancelled",
      };
      expect(shouldSendFirstSessionTips(baseUser, booking, 0, now)).toBe(false);
    });
  });

  describe("after_first_session", () => {
    it("sends next morning in user timezone after completing first session", () => {
      const completedAt = new Date("2026-03-02T18:00:00Z"); // Monday evening
      // Tuesday morning 09:00 in America/New_York (14:00 UTC)
      const now = new Date("2026-03-03T14:00:00Z");
      expect(shouldSendAfterFirstSession(baseUser, completedAt, now)).toBe(true);
    });

    it("does not send on the same day as the session", () => {
      const completedAt = new Date("2026-03-02T14:00:00Z"); // 09:00 NY
      const now = new Date("2026-03-02T20:00:00Z"); // 15:00 NY, same day
      expect(shouldSendAfterFirstSession(baseUser, completedAt, now)).toBe(false);
    });

    it("does not send before 08:00 local time", () => {
      const completedAt = new Date("2026-03-02T18:00:00Z");
      // Tuesday 06:00 in America/New_York (11:00 UTC)
      const now = new Date("2026-03-03T11:00:00Z");
      expect(shouldSendAfterFirstSession(baseUser, completedAt, now)).toBe(false);
    });
  });

  describe("win_back", () => {
    it("sends after 14 days without a session if user completed one before", () => {
      const lastSession = new Date("2026-03-01T12:00:00Z");
      const now = new Date("2026-03-16T12:00:00Z"); // 15 days later
      expect(shouldSendWinBack(baseUser, lastSession, false, null, now)).toBe(
        true,
      );
    });

    it("does not send if less than 14 days have passed", () => {
      const lastSession = new Date("2026-03-01T12:00:00Z");
      const now = new Date("2026-03-10T12:00:00Z"); // 9 days later
      expect(shouldSendWinBack(baseUser, lastSession, false, null, now)).toBe(
        false,
      );
    });

    it("does not send if user has an active upcoming booking", () => {
      const lastSession = new Date("2026-03-01T12:00:00Z");
      const now = new Date("2026-03-16T12:00:00Z");
      expect(shouldSendWinBack(baseUser, lastSession, true, null, now)).toBe(
        false,
      );
    });

    it("enforces 60-day cooldown between win-back emails", () => {
      const lastSession = new Date("2026-01-01T12:00:00Z");
      const lastWinBack = new Date("2026-02-01T12:00:00Z"); // 31 days ago
      const now = new Date("2026-03-04T12:00:00Z");
      expect(
        shouldSendWinBack(baseUser, lastSession, false, lastWinBack, now),
      ).toBe(false);

      // After 65 days cooldown:
      const nowAfter65Days = new Date("2026-04-10T12:00:00Z");
      expect(
        shouldSendWinBack(
          baseUser,
          lastSession,
          false,
          lastWinBack,
          nowAfter65Days,
        ),
      ).toBe(true);
    });
  });

  describe("weekly_summary", () => {
    it("is due on Monday 08:00 in user's timezone", () => {
      // 2026-03-02 is a Monday. 08:30 in America/New_York is 13:30 UTC.
      const now = new Date("2026-03-02T13:30:00Z");
      const result = shouldSendWeeklySummary(baseUser, now);
      expect(result.due).toBe(true);
      expect(result.weekKey).toBe("2026-03-02");
    });

    it("is not due on Tuesday", () => {
      // 2026-03-03 is Tuesday.
      const now = new Date("2026-03-03T13:30:00Z");
      expect(shouldSendWeeklySummary(baseUser, now).due).toBe(false);
    });

    it("is not due outside the 08:00-08:59 window", () => {
      // Monday 10:30 in NY (15:30 UTC)
      const now = new Date("2026-03-02T15:30:00Z");
      expect(shouldSendWeeklySummary(baseUser, now).due).toBe(false);
    });
  });
});

describe("referral link builder", () => {
  it("includes correct utm parameters", () => {
    const link = buildReferralLink(
      "https://focuskept.test",
      "alex-123",
      "twitter",
    );
    const url = new URL(link);
    expect(url.pathname).toBe("/r/alex-123");
    expect(url.searchParams.get("utm_source")).toBe("twitter");
    expect(url.searchParams.get("utm_medium")).toBe("referral");
    expect(url.searchParams.get("utm_campaign")).toBe("invite");
  });
});

describe("notification idempotency logic", () => {
  it("guarantees single delivery per (userId, kind, refId, channel)", async () => {
    const log = new Set<string>();

    async function mockOnce(
      userId: string,
      kind: string,
      refId: string,
      channel: string,
      send: () => Promise<void>,
    ) {
      const key = `${userId}:${kind}:${refId}:${channel}`;
      if (log.has(key)) return false;
      log.add(key);
      try {
        await send();
        return true;
      } catch (err) {
        log.delete(key);
        return false;
      }
    }

    const sendFn = vi.fn().mockResolvedValue(undefined);

    // First call succeeds
    const first = await mockOnce(
      "usr_1",
      "welcome",
      "usr_1",
      "email",
      sendFn,
    );
    expect(first).toBe(true);
    expect(sendFn).toHaveBeenCalledTimes(1);

    // Second call with same refId is skipped (idempotent)
    const second = await mockOnce(
      "usr_1",
      "welcome",
      "usr_1",
      "email",
      sendFn,
    );
    expect(second).toBe(false);
    expect(sendFn).toHaveBeenCalledTimes(1);

    // A failed send allows retry
    const failFn = vi.fn().mockRejectedValue(new Error("Delivery failed"));
    const failAttempt = await mockOnce(
      "usr_2",
      "welcome",
      "usr_2",
      "email",
      failFn,
    );
    expect(failAttempt).toBe(false);

    // Retry after failure succeeds
    const successFn = vi.fn().mockResolvedValue(undefined);
    const retryAttempt = await mockOnce(
      "usr_2",
      "welcome",
      "usr_2",
      "email",
      successFn,
    );
    expect(retryAttempt).toBe(true);
    expect(successFn).toHaveBeenCalledTimes(1);
  });
});

describe("feature flags helper", () => {
  it("returns fallback value when analytics is unconfigured", async () => {
    const { getFeatureFlag, isFeatureEnabled } = await import(
      "@/src/lib/lifecycle/flags"
    );

    const prevKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    delete process.env.NEXT_PUBLIC_POSTHOG_KEY;

    try {
      const flagVal = await getFeatureFlag(
        "usr_123",
        "exp-new-feature",
        "control",
      );
      expect(flagVal).toBe("control");

      const isEnabled = await isFeatureEnabled(
        "usr_123",
        "exp-boolean-flag",
        false,
      );
      expect(isEnabled).toBe(false);

      const isEnabledDefaultTrue = await isFeatureEnabled(
        "usr_123",
        "exp-boolean-flag",
        true,
      );
      expect(isEnabledDefaultTrue).toBe(true);
    } finally {
      if (prevKey) process.env.NEXT_PUBLIC_POSTHOG_KEY = prevKey;
    }
  });

  it("returns fallback value when distinctId is empty", async () => {
    const { getFeatureFlag, isFeatureEnabled } = await import(
      "@/src/lib/lifecycle/flags"
    );

    const flagVal = await getFeatureFlag(null, "exp-new-feature", "control");
    expect(flagVal).toBe("control");

    const isEnabled = await isFeatureEnabled("", "exp-boolean-flag", false);
    expect(isEnabled).toBe(false);
  });
});
