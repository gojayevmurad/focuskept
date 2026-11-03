import { describe, expect, it } from "vitest";
import {
  eisenhowerFor,
  flagsOf,
  freeSlot,
  groupIncoming,
  morningFill,
  quadrantOf,
  sizeForMinutes,
} from "@/src/features/tasks/planning";
import { parseQuickAdd, wordList } from "@/src/features/tasks/quick-add";

const none = { today: [], tomorrow: [], minutes: [], hours: [] };
const az = {
  today: wordList("bu gün, bugün"),
  tomorrow: wordList("sabah"),
  minutes: wordList("d, dəq"),
  hours: wordList("s, saat"),
};

describe("quick add", () => {
  it("reads duration, day, flags and tags in English", () => {
    expect(parseQuickAdd("Essay outline 45m tomorrow ! #uni", none)).toEqual({
      title: "Essay outline",
      minutes: 45,
      when: "tomorrow",
      important: true,
      urgent: false,
      tags: ["uni"],
    });
    expect(parseQuickAdd("Pay rent today!! 1.5h", none)).toMatchObject({
      title: "Pay rent",
      minutes: 90,
      when: "today",
      important: true,
      urgent: true,
    });
  });

  it("uses the locale's words, multi-word phrases included", () => {
    expect(parseQuickAdd("Esse planı 45d bu gün", az)).toMatchObject({
      title: "Esse planı",
      minutes: 45,
      when: "today",
    });
    expect(parseQuickAdd("Hesabat 2 saat sabah", az)).toMatchObject({
      title: "Hesabat",
      minutes: 120,
      when: "tomorrow",
    });
  });

  it("leaves ordinary words and numbers in the title", () => {
    expect(parseQuickAdd("Read chapter 3 of Sabahattin", az)).toMatchObject({
      title: "Read chapter 3 of Sabahattin",
      minutes: null,
      when: null,
    });
  });

  it("matches day words inside unspaced scripts", () => {
    const ja = { ...none, tomorrow: ["明日"] };
    expect(parseQuickAdd("明日レポートを書く", ja, false)).toMatchObject({
      title: "レポートを書く",
      when: "tomorrow",
    });
  });

  it("rejects durations out of range", () => {
    expect(parseQuickAdd("Marathon 2000m", none).minutes).toBeNull();
  });
});

const task = (over: Record<string, unknown>) => ({
  id: String(Math.random()),
  status: "todo",
  plannedFor: null as string | null,
  size135: null as "big" | "medium" | "small" | null,
  eisenhower: null as "do" | "schedule" | "delegate" | "delete" | null,
  ivyRank: null as number | null,
  isFrogOn: null as string | null,
  estimatedMinutes: null as number | null,
  sortOrder: 0,
  ...over,
});

describe("day board rules", () => {
  it("sizes by duration", () => {
    expect([90, 60, 59, 25, 24, null].map(sizeForMinutes)).toEqual([
      "big",
      "big",
      "medium",
      "medium",
      "small",
      "medium",
    ]);
  });

  it("falls back to the nearest free slot and reports a full day", () => {
    const day = "2026-10-30";
    const board = [
      task({ plannedFor: day, size135: "big" }),
      ...[1, 2, 3].map(() => task({ plannedFor: day, size135: "medium" })),
    ];
    expect(freeSlot(board, day, "big")).toBe("small");
    const full = [
      ...board,
      ...[1, 2, 3, 4, 5].map(() => task({ plannedFor: day, size135: "small" })),
    ];
    expect(freeSlot(full, day, "small")).toBeNull();
    // Archived tasks free their slot.
    full[0].status = "archived";
    expect(freeSlot(full, day, "small")).toBe("big");
  });

  it("maps the two flags onto Eisenhower and back", () => {
    for (const [i, u] of [
      [true, true],
      [true, false],
      [false, true],
      [false, false],
    ] as const)
      expect(flagsOf(eisenhowerFor(i, u))).toEqual({
        important: i,
        urgent: u,
      });
    expect(quadrantOf("delete")).toBe("later");
  });

  it("groups Incoming: tomorrow in list order, later dates, unsorted by quadrant", () => {
    const today = "2026-10-30";
    const tomorrow = "2026-10-31";
    const tasks = [
      task({ id: "t2", plannedFor: tomorrow, ivyRank: 2 }),
      task({ id: "t1", plannedFor: tomorrow, ivyRank: 1 }),
      task({ id: "p", plannedFor: "2026-11-05" }),
      task({ id: "u-later", eisenhower: null }),
      task({ id: "u-do", eisenhower: "do" }),
      task({ id: "missed", plannedFor: "2026-10-29", eisenhower: "schedule" }),
      task({ id: "today", plannedFor: today }),
      task({ id: "done", status: "done" }),
    ];
    const groups = groupIncoming(tasks, today, tomorrow);
    expect(groups.tomorrow.map((x) => x.id)).toEqual(["t1", "t2"]);
    expect(groups.planned.map((x) => x.id)).toEqual(["p"]);
    expect(groups.unsorted.map((x) => x.id)).toEqual([
      "u-do",
      "missed",
      "u-later",
    ]);
  });

  it("fills the morning board: frog or first in list gets the big slot", () => {
    const today = "2026-10-30";
    const tasks = [
      task({ id: "r2", plannedFor: today, ivyRank: 2, estimatedMinutes: 10 }),
      task({ id: "r1", plannedFor: today, ivyRank: 1, estimatedMinutes: 10 }),
      task({ id: "r3", plannedFor: today, ivyRank: 3, estimatedMinutes: 40 }),
    ];
    expect(morningFill(tasks, today)).toEqual([
      { id: "r1", size135: "big" },
      { id: "r2", size135: "small" },
      { id: "r3", size135: "medium" },
    ]);
    const withFrog = [...tasks, task({ id: "frog", isFrogOn: today })];
    expect(morningFill(withFrog, today)[0]).toEqual({
      id: "frog",
      size135: "big",
    });
  });
});
