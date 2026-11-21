import { describe, expect, it } from "vitest";
import {
  matchSlot,
  pairKey,
  type Candidate,
} from "@/src/lib/matching/algorithm";

let seq = 0;
function c(userId: string, extra: Partial<Candidate> = {}): Candidate {
  seq += 1;
  return {
    bookingId: `b-${userId}`,
    userId,
    createdAt: new Date(Date.UTC(2026, 0, 1, 0, seq)),
    ...extra,
  };
}
const ids = (r: ReturnType<typeof matchSlot>) =>
  r.pairs.map((p) => [p.a.userId, p.b.userId].sort().join("+")).sort();

describe("matchSlot", () => {
  it("pairs everyone when the count is even", () => {
    const r = matchSlot([c("a"), c("b"), c("c"), c("d")]);
    expect(r.pairs).toHaveLength(2);
    expect(r.unmatched).toHaveLength(0);
  });

  it("leaves the most recent booking out with an odd count", () => {
    const r = matchSlot([c("first"), c("second"), c("third")]);
    expect(r.pairs).toHaveLength(1);
    expect(r.unmatched.map((u) => u.userId)).toEqual(["third"]);
  });

  it("returns nothing for zero or one candidate", () => {
    expect(matchSlot([]).pairs).toHaveLength(0);
    const solo = matchSlot([c("solo")]);
    expect(solo.pairs).toHaveLength(0);
    expect(solo.unmatched).toHaveLength(1);
  });

  it("never pairs blocked users, in either direction", () => {
    const blocked = new Set([pairKey("b", "a")]);
    const r = matchSlot([c("a"), c("b")], blocked);
    expect(r.pairs).toHaveLength(0);
    expect(r.unmatched).toHaveLength(2);
  });

  it("works around a block when there is another option", () => {
    const blocked = new Set([pairKey("a", "b")]);
    const r = matchSlot([c("a"), c("b"), c("c"), c("d")], blocked);
    expect(ids(r)).not.toContain("a+b");
    expect(r.pairs).toHaveLength(2);
  });

  it("puts preferred partners together first", () => {
    const r = matchSlot([
      c("a"),
      c("b"),
      c("x", { preferredPartnerId: "y" }),
      c("y", { preferredPartnerId: "x" }),
    ]);
    expect(ids(r)).toContain("x+y");
    expect(
      r.pairs.find((p) => p.a.userId === "x" || p.b.userId === "x")?.reason,
    ).toBe("preferred");
  });

  it("honors a one-way preference over segments", () => {
    const r = matchSlot([
      c("a", { segments: ["study"] }),
      c("b", { segments: ["study"] }),
      c("x", { preferredPartnerId: "a" }),
    ]);
    expect(ids(r)).toEqual(["a+x"]);
  });

  it("prefers favorites, then communities, then shared segments", () => {
    const fav = matchSlot([
      c("a", { favorites: ["c"], segments: ["adhd"] }),
      c("b", { segments: ["adhd"] }),
      c("c"),
    ]);
    expect(ids(fav)).toEqual(["a+c"]);

    const community = matchSlot([
      c("a", { communities: ["uni"], segments: ["adhd"] }),
      c("b", { segments: ["adhd"] }),
      c("c", { communities: ["uni"] }),
    ]);
    expect(ids(community)).toEqual(["a+c"]);

    const segment = matchSlot([
      c("a", { segments: ["writing"] }),
      c("b", { segments: ["study"] }),
      c("c", { segments: ["writing"] }),
    ]);
    expect(ids(segment)).toEqual(["a+c"]);
  });

  it("respects the same-segment filter", () => {
    const r = matchSlot([
      c("a", { segments: ["study"], requireSharedSegment: true }),
      c("b", { segments: ["writing"] }),
    ]);
    expect(r.pairs).toHaveLength(0);
  });

  it("ignores duplicate bookings from one user", () => {
    const r = matchSlot([c("a"), { ...c("a"), bookingId: "dup" }, c("b")]);
    expect(r.pairs).toHaveLength(1);
    expect(r.unmatched).toHaveLength(0);
  });

  it("does not depend on input order", () => {
    const list = [
      c("a", { segments: ["study"] }),
      c("b"),
      c("c", { segments: ["study"] }),
      c("d", { favorites: ["b"] }),
      c("e"),
    ];
    const forward = ids(matchSlot(list));
    const backward = ids(matchSlot([...list].reverse()));
    expect(backward).toEqual(forward);
  });
});
