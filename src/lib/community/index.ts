import "server-only";
import { randomBytes } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/src/lib/db";
import { community, communityMember, profile } from "@/src/lib/db/schema";

export const COMMUNITY_KINDS = [
  "university",
  "bootcamp",
  "company",
  "other",
] as const;
export type CommunityKind = (typeof COMMUNITY_KINDS)[number];

function slugify(name: string) {
  return (
    name
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "group"
  );
}

export function newJoinCode() {
  return randomBytes(6).toString("base64url");
}

export async function createCommunity(
  ownerId: string,
  input: { name: string; description: string; kind: CommunityKind },
) {
  const base = slugify(input.name);
  let slug = base;
  for (let i = 0; i < 5; i++) {
    const [taken] = await db()
      .select({ id: community.id })
      .from(community)
      .where(eq(community.slug, slug));
    if (!taken) break;
    slug = `${base}-${randomBytes(2).toString("hex")}`;
  }
  const id = crypto.randomUUID();
  await db().transaction(async (tx) => {
    await tx
      .insert(community)
      .values({ id, slug, ...input, ownerId, joinCode: newJoinCode() });
    await tx
      .insert(communityMember)
      .values({ communityId: id, userId: ownerId, role: "owner" });
  });
  return slug;
}

export async function myCommunities(userId: string) {
  return db()
    .select({
      id: community.id,
      slug: community.slug,
      name: community.name,
      kind: community.kind,
      role: communityMember.role,
      members: sql<number>`(select count(*)::int from ${communityMember} m where m.community_id = ${community.id})`,
    })
    .from(communityMember)
    .innerJoin(community, eq(community.id, communityMember.communityId))
    .where(eq(communityMember.userId, userId));
}

export async function getCommunity(slug: string) {
  const [row] = await db()
    .select()
    .from(community)
    .where(eq(community.slug, slug));
  return row;
}

export async function membership(communityId: string, userId: string) {
  const [row] = await db()
    .select()
    .from(communityMember)
    .where(
      and(
        eq(communityMember.communityId, communityId),
        eq(communityMember.userId, userId),
      ),
    );
  return row;
}

export async function members(communityId: string) {
  return db()
    .select({
      userId: communityMember.userId,
      role: communityMember.role,
      name: profile.displayName,
      username: profile.username,
      avatarUrl: profile.avatarUrl,
      joinedAt: communityMember.joinedAt,
    })
    .from(communityMember)
    .innerJoin(profile, eq(profile.userId, communityMember.userId))
    .where(eq(communityMember.communityId, communityId))
    .orderBy(communityMember.joinedAt);
}

export async function joinByCode(code: string, userId: string) {
  const [c] = await db()
    .select()
    .from(community)
    .where(eq(community.joinCode, code));
  if (!c) return null;
  await db()
    .insert(communityMember)
    .values({ communityId: c.id, userId })
    .onConflictDoNothing();
  return c.slug;
}

export async function leaveCommunity(communityId: string, userId: string) {
  const m = await membership(communityId, userId);
  if (!m || m.role === "owner") return false;
  await db()
    .delete(communityMember)
    .where(
      and(
        eq(communityMember.communityId, communityId),
        eq(communityMember.userId, userId),
      ),
    );
  return true;
}

export async function removeMember(
  communityId: string,
  actorId: string,
  userId: string,
) {
  const actor = await membership(communityId, actorId);
  if (!actor || actor.role === "member" || actorId === userId) return false;
  const target = await membership(communityId, userId);
  if (!target || target.role === "owner") return false;
  await db()
    .delete(communityMember)
    .where(
      and(
        eq(communityMember.communityId, communityId),
        eq(communityMember.userId, userId),
      ),
    );
  return true;
}

export async function rotateJoinCode(communityId: string, actorId: string) {
  const actor = await membership(communityId, actorId);
  if (!actor || actor.role === "member") return false;
  await db()
    .update(community)
    .set({ joinCode: newJoinCode() })
    .where(eq(community.id, communityId));
  return true;
}
