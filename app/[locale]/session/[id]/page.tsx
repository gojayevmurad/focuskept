// SPDX-License-Identifier: AGPL-3.0-only
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireAppUser } from "@/src/lib/app-user";
import { roomState } from "@/src/lib/sessions/lifecycle";
import { getAppConfig } from "@/src/config/app";
import { getPlan } from "@/src/lib/billing/plan";
import { db } from "@/src/lib/db";
import { favorite } from "@/src/lib/db/schema";
import { Room } from "./room";

export const metadata: Metadata = {
  title: "Session",
  robots: { index: false },
};

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user, profile } = await requireAppUser();
  const state = await roomState(id, user.id);
  if (!state) notFound();
  const app = getAppConfig();
  const [plan, favs] = await Promise.all([
    getPlan(user.id),
    db()
      .select({ id: favorite.partnerId })
      .from(favorite)
      .where(eq(favorite.userId, user.id)),
  ]);
  return (
    <Room
      initial={state}
      appName={app.name}
      provider={app.videoProvider}
      microphoneDefault={profile.microphoneDefault}
      timeZone={profile.timezone}
      canFavorite={plan.plan === "plus"}
      favorites={favs.map((f) => f.id)}
    />
  );
}
