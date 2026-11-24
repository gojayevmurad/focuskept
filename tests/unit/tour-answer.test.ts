// SPDX-License-Identifier: AGPL-3.0-only
import { beforeEach, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
const mocks = vi.hoisted(() => ({
  requireAppUser: vi.fn(),
  set: vi.fn(),
  where: vi.fn(),
}));
vi.mock("@/src/lib/app-user", () => ({ requireAppUser: mocks.requireAppUser }));
vi.mock("@/src/lib/db", () => ({
  db: () => ({ update: () => ({ set: mocks.set }) }),
}));
import { answerTour, dismissWelcomeVideo } from "@/src/components/tour/actions";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.requireAppUser.mockResolvedValue({ user: { id: "member" } });
  mocks.set.mockReturnValue({ where: mocks.where });
});
it.each([true, false])(
  "persists the tour answer %s for the authenticated profile only, once",
  async (answer) => {
    await answerTour(answer);
    expect(mocks.set).toHaveBeenCalledWith({
      tourAnsweredAt: expect.any(Date),
    });
    const query = new PgDialect().sqlToQuery(mocks.where.mock.calls[0][0]);
    expect(query.params).toEqual(["member"]);
    expect(query.sql).toContain('"profile"."tour_answered_at" is null');
  },
);
it("persists dismissal separately so the tour question survives a refresh", async () => {
  await dismissWelcomeVideo();
  expect(mocks.set).toHaveBeenCalledWith({
    welcomeVideoSeenAt: expect.any(Date),
  });
});
it("rejects malformed answers without updating a profile", async () => {
  await expect(answerTour("yes" as unknown as boolean)).rejects.toThrow(
    "Invalid tour answer",
  );
  expect(mocks.set).not.toHaveBeenCalled();
});
