// SPDX-License-Identifier: AGPL-3.0-only
// Pairing for one slot (same start, same duration). Pure: no I/O, deterministic.

export type Candidate = {
  bookingId: string;
  userId: string;
  createdAt: Date;
  preferredPartnerId?: string | null;
  /** Favorites only count for people on a plan that includes them. */
  favorites?: readonly string[];
  segments?: readonly string[];
  communities?: readonly string[];
  /** Advanced filter: only accept partners who share a segment. */
  requireSharedSegment?: boolean;
};

export type Pair = {
  a: Candidate;
  b: Candidate;
  score: number;
  reason: MatchReason;
};
export type MatchReason =
  "preferred" | "favorite" | "community" | "segment" | "any";

export type MatchResult = { pairs: Pair[]; unmatched: Candidate[] };

export const SCORES = {
  mutualPreferred: 1000,
  preferred: 500,
  mutualFavorite: 300,
  favorite: 150,
  community: 100,
  segment: 10,
  base: 1,
} as const;

/** Unordered key for a pair of user ids. */
export function pairKey(a: string, b: string) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function shared(a: readonly string[] = [], b: readonly string[] = []) {
  const set = new Set(a);
  return b.filter((x) => set.has(x)).length;
}

export function scorePair(
  a: Candidate,
  b: Candidate,
  blocked: ReadonlySet<string>,
): { score: number; reason: MatchReason } | null {
  if (a.userId === b.userId) return null;
  if (blocked.has(pairKey(a.userId, b.userId))) return null;
  const segments = shared(a.segments, b.segments);
  if ((a.requireSharedSegment || b.requireSharedSegment) && segments === 0)
    return null;

  let score: number = SCORES.base;
  let reason: MatchReason = "any";
  const aWantsB = a.preferredPartnerId === b.userId;
  const bWantsA = b.preferredPartnerId === a.userId;
  if (aWantsB && bWantsA) {
    score += SCORES.mutualPreferred;
    reason = "preferred";
  } else if (aWantsB || bWantsA) {
    score += SCORES.preferred;
    reason = "preferred";
  }
  const aFav = a.favorites?.includes(b.userId) ?? false;
  const bFav = b.favorites?.includes(a.userId) ?? false;
  if (aFav && bFav) score += SCORES.mutualFavorite;
  else if (aFav || bFav) score += SCORES.favorite;
  if ((aFav || bFav) && reason === "any") reason = "favorite";
  if (shared(a.communities, b.communities) > 0) {
    score += SCORES.community;
    if (reason === "any") reason = "community";
  }
  if (segments > 0) {
    score += SCORES.segment * Math.min(segments, 3);
    if (reason === "any") reason = "segment";
  }
  return { score, reason };
}

/**
 * Greedy maximum-score pairing. Pairs are taken by score, then by how long the
 * people have been waiting (older bookings first), then by booking id so the
 * result never depends on input order. With an odd count, the most recent
 * booking is the one most likely to be left over.
 */
export function matchSlot(
  candidates: readonly Candidate[],
  blocked: ReadonlySet<string> = new Set(),
): MatchResult {
  // One booking per user per slot; keep the oldest if duplicates slip in.
  const byUser = new Map<string, Candidate>();
  for (const c of [...candidates].sort(compareAge))
    if (!byUser.has(c.userId)) byUser.set(c.userId, c);
  const pool = [...byUser.values()];

  const options: Pair[] = [];
  for (let i = 0; i < pool.length; i++)
    for (let j = i + 1; j < pool.length; j++) {
      const scored = scorePair(pool[i], pool[j], blocked);
      if (scored) options.push({ a: pool[i], b: pool[j], ...scored });
    }
  options.sort(
    (x, y) =>
      y.score - x.score ||
      pairAge(x) - pairAge(y) ||
      pairId(x).localeCompare(pairId(y)),
  );

  const taken = new Set<string>();
  const pairs: Pair[] = [];
  for (const option of options) {
    if (taken.has(option.a.userId) || taken.has(option.b.userId)) continue;
    taken.add(option.a.userId);
    taken.add(option.b.userId);
    pairs.push(option);
  }
  const unmatched = pool.filter((c) => !taken.has(c.userId));
  return { pairs, unmatched };
}

function compareAge(a: Candidate, b: Candidate) {
  return (
    a.createdAt.getTime() - b.createdAt.getTime() ||
    a.bookingId.localeCompare(b.bookingId)
  );
}
function pairAge(p: Pair) {
  return Math.max(p.a.createdAt.getTime(), p.b.createdAt.getTime());
}
function pairId(p: Pair) {
  return [p.a.bookingId, p.b.bookingId].sort().join("|");
}
