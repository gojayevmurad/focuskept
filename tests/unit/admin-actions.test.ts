// SPDX-License-Identifier: AGPL-3.0-only
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  db: vi.fn(),
  revalidatePath: vi.fn(),
  createBooking: vi.fn(),
  suspendUser: vi.fn(),
}));
vi.mock("@/src/lib/app-user", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/src/lib/db", () => ({ db: mocks.db }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/src/lib/bookings/service", () => ({
  createBooking: mocks.createBooking,
}));
vi.mock("@/src/lib/admin/mutations", () => ({
  suspendUser: mocks.suspendUser,
}));
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { adminAction } from "@/app/[locale]/(app)/admin/actions";

function form(values: Record<string, string>) {
  const result = new FormData();
  for (const [key, value] of Object.entries(values)) result.set(key, value);
  return result;
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.requireAdmin.mockResolvedValue({
    user: { id: "admin" },
    profile: { isHouse: true, timezone: "UTC" },
  });
});
describe("admin server action boundaries", () => {
  it("authorizes even invalid submissions before validating or accessing data", async () => {
    mocks.requireAdmin.mockRejectedValue(new Error("unauthorized"));
    await expect(adminAction({}, form({}))).rejects.toThrow("unauthorized");
    expect(mocks.db).not.toHaveBeenCalled();
  });
  it("prevents removing your own admin role", async () => {
    expect(
      await adminAction(
        {},
        form({ intent: "user", id: "admin", operation: "removeAdmin" }),
      ),
    ).toEqual({ error: "selfRole" });
    expect(mocks.db).not.toHaveBeenCalled();
  });
  it("requires the exact deletion confirmation", async () => {
    expect(
      await adminAction(
        {},
        form({
          intent: "groupDelete",
          id: "8bba2632-e4b5-49c3-8716-2d6bacad601b",
          confirm: "delete",
        }),
      ),
    ).toEqual({ error: "invalid" });
    expect(mocks.db).not.toHaveBeenCalled();
  });
  it("checks house mode from the database before booking", async () => {
    const where = vi.fn().mockResolvedValue([{ isHouse: false }]);
    mocks.db.mockReturnValue({ select: () => ({ from: () => ({ where }) }) });
    expect(
      await adminAction(
        {},
        form({
          intent: "house",
          startAt: "2027-01-01T12:00:00.000Z",
          durationMin: "25",
        }),
      ),
    ).toEqual({ error: "houseRequired" });
    expect(mocks.createBooking).not.toHaveBeenCalled();
  });
  it("stores hours as minutes and revalidates the admin and public pages", async () => {
    const values = vi.fn().mockResolvedValue(undefined);
    mocks.db.mockReturnValue({ insert: () => ({ values }) });
    const result = await adminAction(
      {},
      form({
        intent: "challengeSave",
        id: "",
        title: "Focus together",
        slug: "focus-together",
        description: "",
        startsAt: "2027-01-01",
        endsAt: "2027-02-01",
        goalType: "minutes",
        goalValue: "1.5",
      }),
    );
    expect(result).toEqual({ ok: true });
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        goalValue: 90,
        startsAt: new Date("2027-01-01T00:00:00.000Z"),
      }),
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      "/[locale]/admin",
      "layout",
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      "/[locale]/challenges",
      "layout",
    );
  });
});

describe("admin mutation guards", () => {
  it("guards challenge deletion by its start time in the delete query", async () => {
    const returning = vi.fn().mockResolvedValue([]);
    const where = vi.fn().mockReturnValue({ returning });
    mocks.db.mockReturnValue({ delete: () => ({ where }) });
    expect(
      await adminAction(
        {},
        form({
          intent: "challengeDelete",
          id: "8bba2632-e4b5-49c3-8716-2d6bacad601b",
        }),
      ),
    ).toEqual({ error: "notFound" });
    const predicate = where.mock.calls[0][0] as SQL;
    expect(new PgDialect().sqlToQuery(predicate).sql).toContain(
      '"challenge"."starts_at" > now()',
    );
  });
  it("rejects a house slot that no longer has exactly one waiting person", async () => {
    const where = vi
      .fn()
      .mockResolvedValueOnce([{ isHouse: true, timezone: "UTC" }])
      .mockResolvedValueOnce([{ userId: "a" }, { userId: "b" }]);
    mocks.db.mockReturnValue({ select: () => ({ from: () => ({ where }) }) });
    const startAt = new Date(Date.now() + 3600000).toISOString();
    expect(
      await adminAction(
        {},
        form({ intent: "house", startAt, durationMin: "25" }),
      ),
    ).toEqual({ error: "notFound" });
    expect(mocks.createBooking).not.toHaveBeenCalled();
  });
  it("records the resolver and resolution time when dismissing an open report", async () => {
    const returning = vi.fn().mockResolvedValue([{ targetId: "target" }]);
    const set = vi.fn().mockReturnValue({ where: () => ({ returning }) });
    const tx = {
      select: () => ({
        from: () => ({
          where: () => ({ for: () => [{ id: "report", targetId: "target" }] }),
        }),
      }),
      update: () => ({ set }),
    };
    mocks.db.mockReturnValue({
      transaction: (run: (client: typeof tx) => unknown) => run(tx),
    });
    expect(
      await adminAction(
        {},
        form({
          intent: "report",
          id: "8bba2632-e4b5-49c3-8716-2d6bacad601b",
          operation: "dismiss",
        }),
      ),
    ).toEqual({ ok: true });
    expect(set).toHaveBeenCalledWith({
      status: "dismissed",
      resolvedBy: "admin",
      resolvedAt: expect.any(Date),
    });
    expect(mocks.suspendUser).not.toHaveBeenCalled();
  });
});
