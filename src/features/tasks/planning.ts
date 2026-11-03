// Day board rules, shared by the client and the
// server's morning fill. Pure: no React, no database.
import { SLOTS_135, type EISENHOWER, type SIZES_135 } from "./schema";

export type Size = (typeof SIZES_135)[number];
export type Eisenhower = (typeof EISENHOWER)[number];
export type Quadrant = "do" | "plan" | "quick" | "later";

type Slotted = {
  id: string;
  status: string;
  plannedFor: string | null;
  size135: Size | null;
};

/** ≥ 60 min is the day's big task, 25–59 medium, shorter small; unknown reads as medium. */
export function sizeForMinutes(minutes: number | null | undefined): Size {
  if (minutes == null) return "medium";
  return minutes >= 60 ? "big" : minutes >= 25 ? "medium" : "small";
}

const NEAREST: Record<Size, Size[]> = {
  big: ["big", "medium", "small"],
  medium: ["medium", "small", "big"],
  small: ["small", "medium", "big"],
};

/** Free slot for a task of `preferred` size on `day`, or null when the day is full. */
export function freeSlot(
  tasks: Slotted[],
  day: string,
  preferred: Size,
  excludeId?: string,
): Size | null {
  const used = (size: Size) =>
    tasks.filter(
      (x) =>
        x.id !== excludeId &&
        x.plannedFor === day &&
        x.size135 === size &&
        x.status !== "archived",
    ).length;
  return (
    NEAREST[preferred].find((size) => used(size) < SLOTS_135[size]) ?? null
  );
}

export function quadrantOf(eisenhower: Eisenhower | null): Quadrant {
  return eisenhower === "do"
    ? "do"
    : eisenhower === "schedule"
      ? "plan"
      : eisenhower === "delegate"
        ? "quick"
        : "later";
}

export function flagsOf(eisenhower: Eisenhower | null) {
  return {
    important: eisenhower === "do" || eisenhower === "schedule",
    urgent: eisenhower === "do" || eisenhower === "delegate",
  };
}

export function eisenhowerFor(
  important: boolean,
  urgent: boolean,
): Eisenhower | null {
  return important && urgent
    ? "do"
    : important
      ? "schedule"
      : urgent
        ? "delegate"
        : null;
}

const QUADRANT_ORDER: Record<Quadrant, number> = {
  do: 0,
  plan: 1,
  quick: 2,
  later: 3,
};

type Groupable = Slotted & {
  eisenhower: Eisenhower | null;
  ivyRank: number | null;
  sortOrder: number;
};

/** Incoming: everything open that isn't on today's board, in three groups. */
export function groupIncoming<T extends Groupable>(
  tasks: T[],
  today: string,
  tomorrow: string,
) {
  const open = tasks.filter(
    (x) =>
      (x.status === "todo" || x.status === "doing") && x.plannedFor !== today,
  );
  const byQuadrant = (a: T, b: T) =>
    QUADRANT_ORDER[quadrantOf(a.eisenhower)] -
      QUADRANT_ORDER[quadrantOf(b.eisenhower)] || a.sortOrder - b.sortOrder;
  return {
    tomorrow: open
      .filter((x) => x.plannedFor === tomorrow)
      .sort(
        (a, b) => (a.ivyRank ?? 99) - (b.ivyRank ?? 99) || byQuadrant(a, b),
      ),
    planned: open
      .filter((x) => x.plannedFor !== null && x.plannedFor > tomorrow)
      .sort(
        (a, b) =>
          a.plannedFor!.localeCompare(b.plannedFor!) || byQuadrant(a, b),
      ),
    unsorted: open
      .filter((x) => x.plannedFor === null || x.plannedFor < today)
      .sort(byQuadrant),
  };
}

type Fillable = Slotted & {
  ivyRank: number | null;
  isFrogOn: string | null;
  estimatedMinutes: number | null;
  sortOrder: number;
};

/**
 * Morning fill: today's open tasks without a slot, in list order, get
 * the free slot that suits their duration; the first one prefers the big slot.
 * A frog chosen for today counts as planned for today. Returns the moves.
 */
export function morningFill<T extends Fillable>(tasks: T[], today: string) {
  const board: Slotted[] = tasks.map((x) => ({ ...x }));
  const waiting = tasks
    .filter(
      (x) =>
        (x.status === "todo" || x.status === "doing") &&
        x.size135 === null &&
        (x.plannedFor === today || x.isFrogOn === today),
    )
    .sort(
      (a, b) =>
        Number(b.isFrogOn === today) - Number(a.isFrogOn === today) ||
        (a.ivyRank ?? 99) - (b.ivyRank ?? 99) ||
        a.sortOrder - b.sortOrder,
    );
  const moves: { id: string; size135: Size }[] = [];
  waiting.forEach((task, i) => {
    const preferred = i === 0 ? "big" : sizeForMinutes(task.estimatedMinutes);
    const size = freeSlot(board, today, preferred, task.id);
    if (!size) return;
    moves.push({ id: task.id, size135: size });
    const slot = board.find((x) => x.id === task.id)!;
    slot.plannedFor = today;
    slot.size135 = size;
  });
  return moves;
}

/** "45 min · #study" under a task title. */
export function taskMeta(
  task: { estimatedMinutes: number | null; tags: string[] },
  duration: (minutes: number) => string,
) {
  return [
    task.estimatedMinutes ? duration(task.estimatedMinutes) : null,
    ...task.tags.map((tag) => `#${tag}`),
  ]
    .filter(Boolean)
    .join(" · ");
}
