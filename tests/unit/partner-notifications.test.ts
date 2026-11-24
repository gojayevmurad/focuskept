// SPDX-License-Identifier: AGPL-3.0-only
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  db: vi.fn(),
  sendEmail: vi.fn(),
  sendPush: vi.fn(),
  warn: vi.fn(),
}));
vi.mock("@/src/lib/db", () => ({ db: mocks.db }));
vi.mock("@/src/config/app", () => ({
  getAppConfig: () => ({ name: "FocusKept", url: "https://focuskept.com" }),
}));
vi.mock("@/src/lib/email/send", () => ({ sendEmail: mocks.sendEmail }));
vi.mock("@/src/lib/notifications/push", () => ({ sendPush: mocks.sendPush }));
vi.mock("@/src/lib/logger", () => ({ logger: { warn: mocks.warn } }));
vi.mock("@/src/lib/lifecycle/scheduler", () => ({}));
import { booking, sessionParticipant } from "@/src/lib/db/schema";
import { partnerMatched } from "@/src/lib/notifications";

let recipient: {
  email: string;
  name: string;
  timezone: string;
  locale: string;
  isHouse: boolean;
  emailReminders: boolean;
  pushReminders: boolean;
};
let status: string;
let claims: Set<string>;
const saved = {
  id: "booking",
  userId: "person",
  sessionId: "session",
  startAt: new Date("2027-01-01T10:00:00Z"),
  durationMin: 50,
};
beforeEach(() => {
  vi.resetAllMocks();
  status = "matched";
  claims = new Set();
  recipient = {
    email: "person@example.test",
    name: "Person",
    timezone: "Asia/Baku",
    locale: "en",
    isHouse: false,
    emailReminders: true,
    pushReminders: true,
  };
  mocks.db.mockReturnValue({
    select: () => ({
      from: (table: unknown) => ({
        where: async () => (table === booking ? [{ ...saved, status }] : []),
        innerJoin: () => ({
          where: async () =>
            table === sessionParticipant ? [{ name: "Alex" }] : [recipient],
        }),
      }),
    }),
    insert: () => ({
      values: (values: { id: string; kind: string; channel: string }) => ({
        onConflictDoNothing: () => ({
          returning: async () => {
            const key = `${values.kind}:${values.channel}`;
            if (claims.has(key)) return [];
            claims.add(key);
            return [{ id: values.id }];
          },
        }),
      }),
    }),
    delete: () => ({
      where: async () => {
        claims.delete("partner_matched:email");
      },
    }),
  });
});
describe("regular partner match alerts", () => {
  it("sends the partner and local time via email and push, once per channel", async () => {
    await partnerMatched("booking");
    await partnerMatched("booking");
    const url = "https://focuskept.com/session/session";
    expect(mocks.sendEmail).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        kind: "partner_matched",
        url,
        text: expect.stringContaining(
          "You're matched with Alex: your 2:00 PM session starts in 5 minutes",
        ),
      }),
    );
    expect(mocks.sendEmail.mock.calls[0][0].text).toContain(
      `Open the session: ${url}`,
    );
    expect(mocks.sendPush).toHaveBeenCalledExactlyOnceWith(
      "person",
      expect.objectContaining({
        tag: "partner_matched",
        body: expect.stringContaining("Alex"),
        url,
      }),
    );
  });
  it.each(["emailReminders", "pushReminders"] as const)(
    "respects %s independently",
    async (setting) => {
      recipient[setting] = false;
      await partnerMatched("booking");
      expect(mocks.sendEmail).toHaveBeenCalledTimes(
        setting === "emailReminders" ? 0 : 1,
      );
      expect(mocks.sendPush).toHaveBeenCalledTimes(
        setting === "pushReminders" ? 0 : 1,
      );
    },
  );
  it.each(["de", "fr", "nl", "es"])(
    "localizes the match alert in %s",
    async (locale) => {
      recipient.locale = locale;
      await partnerMatched("booking");
      expect(mocks.sendEmail.mock.calls[0][0].subject).toContain("Alex");
      expect(mocks.sendEmail.mock.calls[0][0].subject).not.toContain(
        "You're matched",
      );
    },
  );
  it("never gives a house participant the regular alert", async () => {
    recipient.isHouse = true;
    await partnerMatched("booking");
    expect(mocks.sendEmail).not.toHaveBeenCalled();
    expect(mocks.sendPush).not.toHaveBeenCalled();
  });
  it("ignores unmatched bookings", async () => {
    status = "booked";
    await partnerMatched("booking");
    expect(mocks.sendEmail).not.toHaveBeenCalled();
    expect(mocks.sendPush).not.toHaveBeenCalled();
  });
  it("logs send failures, attempts the other channel, and allows retry", async () => {
    mocks.sendEmail.mockRejectedValueOnce(new Error("offline"));
    await expect(partnerMatched("booking")).resolves.toBeUndefined();
    expect(mocks.sendPush).toHaveBeenCalledOnce();
    expect(mocks.warn).toHaveBeenCalled();
    await partnerMatched("booking");
    expect(mocks.sendEmail).toHaveBeenCalledTimes(2);
    expect(mocks.sendPush).toHaveBeenCalledOnce();
  });
  it("logs lookup failures without throwing", async () => {
    mocks.db.mockImplementation(() => {
      throw new Error("database offline");
    });
    await expect(partnerMatched("booking")).resolves.toBeUndefined();
    expect(mocks.warn).toHaveBeenCalled();
  });
});
