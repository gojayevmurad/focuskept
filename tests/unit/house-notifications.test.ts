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
import { booking } from "@/src/lib/db/schema";
import { formatWhen, houseMatched } from "@/src/lib/notifications";

const startAt = new Date("2027-01-01T10:00:00Z");
const savedBooking = {
  id: "anchor-booking",
  userId: "anchor",
  startAt,
  durationMin: 50,
  status: "matched",
  sessionId: "focus-session",
};
const recipient = {
  email: "anchor@example.com",
  name: "Host",
  timezone: "Asia/Baku",
  locale: "de",
  emailReminders: false,
  pushReminders: true,
};
let status: string;
beforeEach(() => {
  vi.resetAllMocks();
  status = "matched";
  const sent = new Set<string>();
  mocks.db.mockReturnValue({
    select: () => ({
      from: (table: unknown) => ({
        where: async () =>
          table === booking ? [{ ...savedBooking, status }] : [],
        innerJoin: () => ({ where: async () => [recipient] }),
      }),
    }),
    insert: () => ({
      values: (values: {
        userId: string;
        kind: string;
        refId: string;
        channel: string;
      }) => ({
        onConflictDoNothing: () => ({
          returning: async () => {
            const key = [
              values.userId,
              values.kind,
              values.refId,
              values.channel,
            ].join(":");
            if (sent.has(key)) return [];
            sent.add(key);
            return [{ id: key }];
          },
        }),
      }),
    }),
    delete: () => ({ where: async () => {} }),
  });
});

describe("house match notifications", () => {
  it("sends email despite reminder opt-out and sends push, once per booking and channel", async () => {
    await houseMatched("anchor-booking");
    await houseMatched("anchor-booking");
    const url = "https://focuskept.com/session/focus-session";
    expect(mocks.sendEmail).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        to: recipient.email,
        subject: `Someone is joining your ${formatWhen(startAt, recipient.timezone, recipient.locale)} session`,
        kind: "house_matched",
        url,
        text: expect.stringContaining(`Open the session: ${url}`),
        react: expect.anything(),
      }),
    );
    expect(mocks.sendPush).toHaveBeenCalledExactlyOnceWith(
      "anchor",
      expect.objectContaining({ url, tag: "house_matched" }),
    );
  });

  it("still attempts push when email fails and logs the failure", async () => {
    mocks.sendEmail.mockRejectedValue(new Error("email failed"));
    await expect(houseMatched("anchor-booking")).resolves.toBeUndefined();
    expect(mocks.sendPush).toHaveBeenCalledOnce();
    expect(mocks.warn).toHaveBeenCalled();
  });

  it("does not send for an unmatched booking", async () => {
    status = "booked";
    await houseMatched("anchor-booking");
    expect(mocks.sendEmail).not.toHaveBeenCalled();
    expect(mocks.sendPush).not.toHaveBeenCalled();
  });
});
