import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/src/lib/auth/session";
import { SignedInTimerHome } from "@/src/features/focus/timer-home";
import {
  metadataLocale,
  resolveLocale,
  type LocaleParams,
} from "@/src/i18n/server";

export async function generateMetadata({
  params,
}: LocaleParams): Promise<Metadata> {
  const locale = await metadataLocale(params);
  const t = await getTranslations({ locale, namespace: "meta" });
  return { title: t("focusTitle") };
}

/** Kept for links and bookmarks: the same timer as /app. */
export default async function Page({
  params,
  searchParams,
}: LocaleParams & {
  searchParams: Promise<{ technique?: string; task?: string; topic?: string }>;
}) {
  await resolveLocale(params);
  const { user } = await requireSession("/app/focus");
  const query = await searchParams;
  return (
    <SignedInTimerHome
      userId={user.id}
      technique={query.technique}
      task={query.task}
      topic={query.topic}
    />
  );
}
