// SPDX-License-Identifier: AGPL-3.0-only
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  db: vi.fn(),
  houseMatched: vi.fn(),
  partnerMatched: vi.fn(),
  publish: vi.fn(),
  warn: vi.fn(),
}));
vi.mock("@/src/lib/db", () => ({ db: mocks.db }));
vi.mock("@/src/lib/billing/plan", () => ({
  getPlan: async () => ({ plan: "plus" }),
}));
vi.mock("@/src/lib/notifications", () => ({
  houseMatched: mocks.houseMatched,
  partnerMatched: mocks.partnerMatched,
}));
vi.mock("@/src/lib/realtime/publish", () => ({ publish: mocks.publish }));
vi.mock("@/src/lib/logger", () => ({ logger: { warn: mocks.warn } }));
import { booking, profile } from "@/src/lib/db/schema";
import { runSlotMatching } from "@/src/lib/matching/run";

const start = new Date("2027-01-01T14:00:00Z");
let houseUsers: string[];
let committed: boolean;
beforeEach(() => {
  vi.resetAllMocks();
  houseUsers = ["anchor"];
  committed = false;
  const tx = {
    execute: async () => {},
    select: () => ({
      from: (table: unknown) => ({
        where: () => {
          const rows =
            table === booking
              ? ["anchor", "partner"].map((userId, index) => ({
                  id: `booking-${userId}`,
                  userId,
                  createdAt: new Date(index),
                }))
              : table === profile
                ? ["anchor", "partner"].map((userId) => ({
                    userId,
                    isHouse: houseUsers.includes(userId),
                  }))
                : [];
          return Object.assign(Promise.resolve(rows), { for: () => rows });
        },
      }),
    }),
    insert: () => ({ values: async () => {} }),
    update: () => ({ set: () => ({ where: async () => {} }) }),
  };
  mocks.db.mockReturnValue({
    transaction: async (run: (client: typeof tx) => Promise<unknown>) => {
      const result = await run(tx);
      committed = true;
      return result;
    },
  });
  mocks.publish.mockResolvedValue(undefined);
  mocks.partnerMatched.mockImplementation(async () => {
    expect(committed).toBe(true);
  });
  mocks.houseMatched.mockImplementation(async () => {
    expect(committed).toBe(true);
  });
});

describe("house matching alerts", () => {
  it.each(["anchor", "partner"])(
    "alerts only the house participant (%s), after commit",
    async (houseUser) => {
      houseUsers = [houseUser];
      const sessions = await runSlotMatching(start, 50);
      expect(sessions).toHaveLength(1);
      expect(mocks.houseMatched).toHaveBeenCalledExactlyOnceWith(
        `booking-${houseUser}`,
      );
      expect(mocks.partnerMatched).toHaveBeenCalledExactlyOnceWith(
        `booking-${houseUser === "anchor" ? "partner" : "anchor"}`,
      );
      expect(mocks.publish).toHaveBeenCalledWith(
        "user:partner",
        "booking.matched",
        { sessionId: sessions[0].sessionId },
      );
    },
  );

  it("sends partner notifications to both regular participants", async () => {
    houseUsers = [];
    expect(await runSlotMatching(start, 50)).toHaveLength(1);
    expect(mocks.houseMatched).not.toHaveBeenCalled();
    expect(mocks.partnerMatched).toHaveBeenCalledTimes(2);
  });

  it("does not alert when both bookings are house bookings", async () => {
    houseUsers = ["anchor", "partner"];
    await runSlotMatching(start, 50);
    expect(mocks.houseMatched).not.toHaveBeenCalled();
    expect(mocks.partnerMatched).not.toHaveBeenCalled();
  });

  it("logs notification failures without failing the committed match", async () => {
    const error = new Error("email unavailable");
    mocks.houseMatched.mockRejectedValue(error);
    expect(await runSlotMatching(start, 50)).toHaveLength(1);
    expect(mocks.warn).toHaveBeenCalledWith(
      { err: error, bookingId: "booking-anchor" },
      "House match notification failed",
    );
  });

  it("sends no alert when the transaction fails to commit", async () => {
    mocks.db.mockReturnValue({
      transaction: async () => {
        throw new Error("rollback");
      },
    });
    await expect(runSlotMatching(start, 50)).rejects.toThrow("rollback");
    expect(mocks.houseMatched).not.toHaveBeenCalled();
    expect(mocks.partnerMatched).not.toHaveBeenCalled();
  });

  it("keeps matches and realtime delivery when a regular notification fails", async () => {
    mocks.partnerMatched.mockRejectedValue(new Error("push offline"));
    expect(await runSlotMatching(start, 50)).toHaveLength(1);
    expect(mocks.warn).toHaveBeenCalled();
    expect(mocks.publish).toHaveBeenCalledTimes(2);
  });
});
