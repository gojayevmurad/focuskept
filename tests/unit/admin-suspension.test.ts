// SPDX-License-Identifier: AGPL-3.0-only
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ db: vi.fn(), cancelBooking: vi.fn() }));
vi.mock("@/src/lib/db", () => ({ db: mocks.db }));
vi.mock("@/src/lib/bookings/service", () => ({
  cancelBooking: mocks.cancelBooking,
}));
import { suspendUser } from "@/src/lib/admin/mutations";

beforeEach(() => vi.resetAllMocks());
it("suspends the user and continues cancelling when one cancellation fails", async () => {
  const set = vi
    .fn()
    .mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
  mocks.db.mockReturnValue({
    update: () => ({ set }),
    select: () => ({
      from: () => ({ where: () => [{ id: "first" }, { id: "second" }] }),
    }),
  });
  mocks.cancelBooking
    .mockRejectedValueOnce(new Error("already cancelled"))
    .mockResolvedValueOnce(undefined);
  await suspendUser("target");
  expect(set).toHaveBeenCalledWith(
    expect.objectContaining({ suspendedAt: expect.any(Date) }),
  );
  expect(mocks.cancelBooking.mock.calls).toEqual([
    ["target", "first"],
    ["target", "second"],
  ]);
});
