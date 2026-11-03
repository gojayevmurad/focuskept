import { describe, expect, it } from "vitest";
import {
  emptyLocal,
  guardSize,
  hasImportableData,
  migrateLocal,
  MAX_LOCAL_BYTES,
  type LocalSession,
} from "@/src/features/focus/local-store";

const session = (i: number): LocalSession => ({
  clientId: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
  mode: "work",
  timeTechnique: "pomodoro",
  goal: "x".repeat(150),
  startedAt: "2026-11-02T09:00:00.000Z",
  endedAt: "2026-11-02T09:25:00.000Z",
  focusedSeconds: 1500,
  breakSeconds: 0,
  cyclesCompleted: 1,
  interruptions: 0,
  overrunSeconds: 0,
  focusRating: 4,
  note: null,
});

describe("anonymous local store", () => {
  it("migrates unversioned data and rejects garbage", () => {
    expect(migrateLocal(null)).toEqual(emptyLocal());
    expect(migrateLocal({ version: 99, tasks: [1] })).toEqual(emptyLocal());
    const migrated = migrateLocal({ sessions: [session(1)], tasks: "bad" });
    expect(migrated.version).toBe(1);
    expect(migrated.sessions).toHaveLength(1);
    expect(migrated.tasks).toEqual([]);
  });
  it("keeps the newest records within the size guard", () => {
    const big = {
      ...emptyLocal(),
      sessions: Array.from({ length: 6000 }, (_, i) => session(i)),
    };
    const guarded = guardSize(big);
    expect(JSON.stringify(guarded).length).toBeLessThanOrEqual(MAX_LOCAL_BYTES);
    expect(guarded.sessions.at(-1)?.clientId).toBe(session(5999).clientId);
  });
  it("offers the import again only for records added after a decline", () => {
    const data = { ...emptyLocal(), sessions: [session(1)] };
    expect(hasImportableData(emptyLocal())).toBe(false);
    expect(hasImportableData(data)).toBe(true);
    const declined = { ...data, importDeclinedAt: "2026-11-02T10:00:00.000Z" };
    expect(hasImportableData(declined)).toBe(false);
    const later = { ...session(2), endedAt: "2026-11-02T10:30:00.000Z" };
    expect(
      hasImportableData({ ...declined, sessions: [session(1), later] }),
    ).toBe(true);
    expect(
      hasImportableData({ ...data, importedAt: "2026-11-02T10:00:00.000Z" }),
    ).toBe(false);
  });
});
