// SPDX-License-Identifier: AGPL-3.0-only
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  taken: vi.fn(),
  plan: vi.fn(),
  require: vi.fn(),
  writes: [] as { table: unknown; values: Record<string, unknown> }[],
  deletes: [] as unknown[],
}));
vi.mock("@/src/lib/db", () => ({
  db: () => ({ transaction: mocks.transaction }),
}));
vi.mock("@/src/lib/app-user", () => ({ requireAppUser: mocks.require }));
vi.mock("@/src/lib/profiles", () => ({ isUsernameTaken: mocks.taken }));
vi.mock("@/src/lib/billing/plan", () => ({ getPlan: mocks.plan }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import {
  saveProfile,
  savePreferences,
} from "@/app/[locale]/(app)/settings/actions";
import { analyticsOutbox, profile, user } from "@/src/lib/db/schema";
const form = (fields: Record<string, string | string[]>) => {
  const result = new FormData();
  for (const [key, value] of Object.entries(fields))
    for (const item of Array.isArray(value) ? value : [value])
      result.append(key, item);
  return result;
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.writes = [];
  mocks.deletes = [];
  mocks.require.mockResolvedValue({ user: { id: "member" } });
  mocks.taken.mockResolvedValue(false);
  mocks.plan.mockResolvedValue({ plan: "plus" });
  mocks.transaction.mockImplementation(async (fn) =>
    fn({
      update: (table: unknown) => ({
        set: (values: Record<string, unknown>) => {
          mocks.writes.push({ table, values });
          return { where: vi.fn() };
        },
      }),
      delete: (table: unknown) => {
        mocks.deletes.push(table);
        return { where: vi.fn() };
      },
    }),
  );
});
it("saves custom work tags without clearing an existing uploaded or absolute avatar URL", async () => {
  const result = await saveProfile(
    {},
    form({
      displayName: "Alex",
      username: "alex",
      timezone: "Europe/Berlin",
      segments: ["study", "Language Learning"],
    }),
  );
  expect(result).toEqual({ ok: true });
  expect(mocks.writes.find((w) => w.table === profile)?.values).toMatchObject({
    segments: ["study", "language learning"],
  });
  expect(mocks.writes[0].values).not.toHaveProperty("avatarUrl");
  expect(mocks.writes.find((w) => w.table === user)?.values).toEqual({
    name: "Alex",
  });
});
it("rejects too many tags and duplicate custom tags on the server", async () => {
  for (const segments of [
    ["a", "b", "c", "d", "e", "f"],
    ["Design", "design"],
  ])
    expect(
      await saveProfile(
        {},
        form({
          displayName: "Alex",
          username: "alex",
          timezone: "Europe/Berlin",
          segments,
        }),
      ),
    ).toEqual({ error: "invalid" });
  expect(mocks.transaction).not.toHaveBeenCalled();
});
it("focus saves preserve notification and public-stat choices", async () => {
  expect(
    await savePreferences(
      {},
      form({
        section: "focus",
        defaultDuration: "75",
        weeklyGoal: "4",
        preferredTimes: ["morning", "evening"],
        matchSameSegment: "on",
      }),
    ),
  ).toMatchObject({ ok: true });
  expect(mocks.writes[0].values).toMatchObject({
    defaultDuration: 75,
    weeklyGoal: 4,
    preferredTimes: ["morning", "evening"],
    matchSameSegment: true,
  });
  expect(mocks.writes[0].values).not.toHaveProperty("emailTips");
  expect(mocks.writes[0].values).not.toHaveProperty("statsPublic");
});
it("privacy saves persist analytics choice and clear pending analytics when disabled", async () => {
  expect(
    await savePreferences(
      {},
      form({ section: "privacy", statsPublic: "on", analyticsEnabled: "yes" }),
    ),
  ).toEqual({ ok: true, analyticsConsent: false });
  expect(mocks.writes.find((w) => w.table === user)?.values).toEqual({
    analyticsConsent: false,
  });
  expect(mocks.deletes).toContain(analyticsOutbox);
});
it("rejects unknown preference sections without writing", async () => {
  expect(await savePreferences({}, form({ section: "other" }))).toEqual({
    error: "invalid",
  });
  expect(mocks.transaction).not.toHaveBeenCalled();
});
