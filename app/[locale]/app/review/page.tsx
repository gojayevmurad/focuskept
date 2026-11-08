import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ClientIntl } from "@/src/components/client-intl";
import { PageHeader } from "@/src/components/page-header";
import { ReviewApp } from "@/src/features/reviews/review-app";
import { cardForReview, dueCards } from "@/src/features/reviews/server";
import { getPreferences, today } from "@/src/features/preferences/server";
import { budgetBlocked, getPlan } from "@/src/features/limits/server";
import { aiConfigured } from "@/src/lib/ai";
import { idSchema } from "@/src/lib/api";
import { requireSession } from "@/src/lib/auth/session";
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
  return { title: t("review") };
}

export default async function Page({
  params,
  searchParams,
}: LocaleParams & {
  searchParams: Promise<{ card?: string; subject?: string }>;
}) {
  await resolveLocale(params);
  const query = await searchParams;
  const subject =
    query.subject === "none" || idSchema.safeParse(query.subject).success
      ? query.subject
      : undefined;
  const { user } = await requireSession(
    query.card
      ? `/app/review?card=${encodeURIComponent(query.card)}`
      : subject
        ? `/app/review?subject=${encodeURIComponent(subject)}`
        : "/app/review",
  );
  const prefs = await getPreferences(user.id);
  const single =
    query.card && idSchema.safeParse(query.card).success
      ? await cardForReview(user.id, query.card)
      : undefined;
  const cards = single
    ? [single]
    : await dueCards(user.id, today(prefs), 50, subject);
  const plan = await getPlan(user.id);
  const t = await getTranslations("review");
  return (
    <>
      <PageHeader title={t("title")} description={t("lead")} />
      <ClientIntl namespaces={["review"]}>
        <ReviewApp
          cards={cards}
          aiAvailable={aiConfigured() && !(await budgetBlocked(plan.pro))}
        />
      </ClientIntl>
    </>
  );
}
