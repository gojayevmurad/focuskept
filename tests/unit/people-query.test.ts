// SPDX-License-Identifier: AGPL-3.0-only
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("@/src/lib/db", async () => {
  const { drizzle } = await import("drizzle-orm/node-postgres");
  return { db: () => drizzle({ client: { query: mocks.query } as never }) };
});
import {
  peoplePage,
  peopleParameters,
  literalSearch,
} from "@/app/[locale]/(app)/people/queries";
beforeEach(() => {
  mocks.query.mockReset().mockResolvedValue({ rows: [] });
});
it("paginates distinct partners in SQL after grouping their full history", async () => {
  mocks.query.mockResolvedValue({
    rows: Array.from({ length: 25 }, (_, i) => [
      `id${i}`,
      `Person ${i}`,
      `person-${i}`,
      null,
      "Bio",
      3,
      "2026-11-24T09:00:00Z",
      false,
    ]),
  });
  const result = await peoplePage("member", peopleParameters({ page: "2" }));
  const [query, params] = mocks.query.mock.calls[0];
  expect(query.text).toContain("group by");
  expect(query.text).toContain('"last_session" desc nulls last');
  expect(query.text).toContain("limit");
  expect(params.slice(-2)).toEqual([25, 24]);
  expect(result.rows).toHaveLength(24);
  expect(result.more).toBe(true);
  expect(result.rows[0].count).toBe(3);
});
it("uses an escaped, parameterized name search", async () => {
  await peoplePage(
    "member",
    peopleParameters({ q: "  Alex_%  ", tab: "favorites" }),
  );
  const [query, params] = mocks.query.mock.calls[0];
  expect(query.text).toContain('"profile"."display_name" ilike');
  expect(query.text).not.toContain("Alex");
  expect(params).toContain("%Alex\\_\\%%");
  expect(query.text).toContain('"favorite"."partner_id" is not null');
});
it("selects blocked partners separately and clamps invalid pagination", async () => {
  const options = peopleParameters({
    page: "-2",
    tab: "blocked",
    q: "a".repeat(90),
  });
  expect(options.page).toBe(1);
  expect(options.q).toHaveLength(60);
  await peoplePage("member", options);
  expect(mocks.query.mock.calls[0][0].text).toContain(
    '"block"."blocked_id" is not null',
  );
  expect(peopleParameters({ tab: "other", page: "NaN" })).toEqual({
    tab: "recent",
    q: "",
    page: 1,
  });
  expect(literalSearch("100%_\\")).toBe("%100\\%\\_\\\\%");
});
