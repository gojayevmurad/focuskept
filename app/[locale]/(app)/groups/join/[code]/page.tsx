// SPDX-License-Identifier: AGPL-3.0-only
import { getLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { requireAppUser } from "@/src/lib/app-user";
import { joinByCode } from "@/src/lib/community";
import { redirect } from "@/src/i18n/navigation";

export default async function Page({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const { user } = await requireAppUser();
  const slug = await joinByCode(code.slice(0, 40), user.id);
  if (!slug) notFound();
  redirect({ href: `/groups/${slug}`, locale: await getLocale() });
}
