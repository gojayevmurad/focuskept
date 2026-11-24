// SPDX-License-Identifier: AGPL-3.0-only
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  hostedSessionInput,
  hostApplicationInput,
} from "@/src/lib/hosts/validation";
const mocks = vi.hoisted(() => ({
  requireAppUser: vi.fn(),
  createGroupSession: vi.fn(),
  applyToHost: vi.fn(),
}));
vi.mock("@/src/lib/app-user", () => ({ requireAppUser: mocks.requireAppUser }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/src/lib/hosts", () => ({
  createGroupSession: mocks.createGroupSession,
  applyToHost: mocks.applyToHost,
  cancelGroupSession: vi.fn(),
}));
import { apply, scheduleGroup } from "@/app/[locale]/(app)/hosting/actions";
const valid = {
  startAt: "2026-11-25T12:00:00.000Z",
  duration: "50",
  title: "  Morning deep work  ",
  capacity: "9",
};
function form(values: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) f.set(k, v);
  return f;
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.requireAppUser.mockResolvedValue({ user: { id: "host" } });
});
describe("host scheduling", () => {
  it("accepts supported durations and seat limits including the host", () => {
    for (const duration of ["25", "50", "75"])
      expect(hostedSessionInput.parse({ ...valid, duration }).duration).toBe(
        Number(duration),
      );
    expect(hostedSessionInput.parse(valid).title).toBe("Morning deep work");
    expect(
      hostedSessionInput.safeParse({ ...valid, capacity: "2" }).success,
    ).toBe(true);
  });
  it.each([
    { duration: "30" },
    { duration: "abc" },
    { capacity: "1" },
    { capacity: "10" },
    { capacity: "2.5" },
    { title: " " },
    { title: "a".repeat(81) },
    { startAt: "tomorrow" },
  ])("rejects invalid fields %j before creating a session", async (changes) => {
    expect(await scheduleGroup({}, form({ ...valid, ...changes }))).toEqual({
      error: "invalid",
    });
    expect(mocks.createGroupSession).not.toHaveBeenCalled();
  });
  it("uses the signed-in host and delegates time/approval/overlap validation", async () => {
    mocks.createGroupSession.mockResolvedValue({
      ok: false,
      reason: "too_late",
    });
    expect(await scheduleGroup({}, form(valid))).toEqual({ error: "too_late" });
    expect(mocks.createGroupSession).toHaveBeenCalledWith({
      hostId: "host",
      startAt: new Date(valid.startAt),
      durationMin: 50,
      title: "Morning deep work",
      capacity: 9,
    });
  });
  it("requires authentication even for invalid requests", async () => {
    mocks.requireAppUser.mockRejectedValue(new Error("unauthorized"));
    await expect(scheduleGroup({}, form({}))).rejects.toThrow("unauthorized");
  });
});
describe("host application", () => {
  it("accepts an optional web audience and rejects unsafe protocols", () => {
    expect(
      hostApplicationInput.safeParse({
        pitch: "I want to welcome writers into quiet morning sessions.",
        audienceUrl: "",
      }).success,
    ).toBe(true);
    expect(
      hostApplicationInput.safeParse({
        pitch: "I want to welcome writers into quiet morning sessions.",
        audienceUrl: "javascript:alert(1)",
      }).success,
    ).toBe(false);
  });
  it("requires a useful pitch before applying", async () => {
    expect(await apply({}, form({ pitch: "Hi", audienceUrl: "" }))).toEqual({
      error: "invalid",
    });
    expect(mocks.applyToHost).not.toHaveBeenCalled();
  });
});
