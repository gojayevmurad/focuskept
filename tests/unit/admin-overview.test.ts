// SPDX-License-Identifier: AGPL-3.0-only
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
const mocks = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("@/src/lib/db", () => ({ db: () => ({ execute: mocks.execute }) }));
import { overviewMetrics, needsAttention } from "@/src/lib/admin/metrics";
const dialect = new PgDialect();
beforeEach(() => vi.resetAllMocks());
describe("operations overview", () => {
  it("queries room totals, local-day boundaries, rolling seven days and live waiting requests", async () => {
    mocks.execute.mockResolvedValue({
      rows: [
        {
          signupsToday: 2,
          signupsWeek: 12,
          sessionsToday: 4,
          sessionsWeek: 20,
          matched: 8,
          failed: 2,
          reports: 3,
          support: 1,
          waiting: 2,
          unmatched: 5,
        },
      ],
    });
    const result = await overviewMetrics(
      "Asia/Baku",
      new Date("2026-11-24T12:00:00Z"),
    );
    expect(result).toMatchObject({
      signupsToday: 2,
      sessionsWeek: 20,
      matchRate: 0.8,
      waiting: 2,
      unmatched: 5,
    });
    expect(mocks.execute).toHaveBeenCalledTimes(1);
    const query = dialect.sqlToQuery(mocks.execute.mock.calls[0][0]);
    expect(query.params).toContain("2026-11-23T20:00:00.000Z");
    expect(query.params).toContain("2026-11-17T12:00:00.000Z");
    expect(query.params).toContain("2026-11-24T11:50:00.000Z");
    expect(query.params).toContain("2026-11-25T12:00:00.000Z");
    expect(query.sql).toContain("from focus_session");
    expect(query.sql).toContain("status <> 'cancelled'");
    expect(query.sql).toContain("resolution is distinct from 'matched_late'");
    expect(query.sql).toContain("p.suspended_at is null");
    expect(query.sql).toContain("status = 'open'");
  });
  it("returns zero match rate for a period without attempts", async () => {
    mocks.execute.mockResolvedValue({ rows: [{ matched: 0, failed: 0 }] });
    expect((await overviewMetrics("UTC")).matchRate).toBe(0);
  });
  it("fetches bounded actionable reports, support tickets, and unmatched upcoming bookings", async () => {
    const rows = [
      {
        id: "ticket",
        kind: "support",
        label: "Need help",
        at: "2026-11-24T12:00:00Z",
      },
    ];
    mocks.execute.mockResolvedValue({ rows });
    expect(await needsAttention(new Date("2026-11-24T12:00:00Z"))).toEqual(
      rows,
    );
    const query = dialect.sqlToQuery(mocks.execute.mock.calls[0][0]);
    expect(query.sql.match(/limit 5/g)).toHaveLength(3);
    expect(query.sql).toContain("b.session_id is null");
    expect(query.sql).toContain("b.kind = 'pair'");
    expect(query.params).toEqual([
      "2026-11-24T12:00:00.000Z",
      "2026-11-25T12:00:00.000Z",
    ]);
  });
});
