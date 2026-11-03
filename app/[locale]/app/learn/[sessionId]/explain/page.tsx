import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ClientIntl } from "@/src/components/client-intl";
import { ExplainApp } from "@/src/features/cards/explain-app";
import { getDraftBySession } from "@/src/features/cards/server";
import { getSession } from "@/src/features/sessions/server";
import { techniqueLabels } from "@/src/features/techniques/content";
import { getPreferences } from "@/src/features/preferences/server";
import {
  aiAllowance,
  budgetBlocked,
  cardAllowance,
  getPlan,
} from "@/src/features/limits/server";
import { aiConfigured } from "@/src/lib/ai";
import { requireSession } from "@/src/lib/auth/session";
import { getEnv } from "@/src/config/env";
import { Link } from "@/src/i18n/navigation";
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
  return { title: t("explain") };
}

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; sessionId: string }>;
}) {
  const locale = await resolveLocale(params);
  const { sessionId } = await params;
  const { user } = await requireSession(`/app/learn/${sessionId}/explain`);
  const draft = await getDraftBySession(user.id, sessionId);
  const t = await getTranslations("learn.explain");
  if (!draft)
    return (
      <div className="empty">
        <p>{t("notFound")}</p>
        <Link href="/app/cards" className="btn btn-secondary">
          {(await getTranslations("cards"))("title")}
        </Link>
      </div>
    );
  const prefs = await getPreferences(user.id);
  const session = await getSession(user.id, sessionId);
  const plan = await getPlan(user.id);
  const [labels, ai, cards, blocked] = await Promise.all([
    techniqueLabels(locale),
    aiAllowance(user.id, prefs.timezone, plan),
    cardAllowance(user.id, plan),
    budgetBlocked(plan.pro),
  ]);
  return (
    <ClientIntl namespaces={["learn", "cards", "limits", "notifications"]}>
      <ExplainApp
        sessionId={sessionId}
        topic={draft.topic}
        methodName={
          labels[draft.learningMethod as keyof typeof labels]?.name ??
          draft.learningMethod
        }
        initialExplanation={draft.explanation ?? ""}
        initialAnalysis={draft.analysis}
        initialQuestions={draft.questions}
        analysesUsed={draft.analysisCount}
        pro={plan.pro}
        aiAvailable={aiConfigured() && !blocked}
        aiRemaining={draft.aiCounted ? Math.max(1, ai.remaining) : ai.remaining}
        aiLimit={ai.limit}
        cardsRemaining={cards.remaining}
        vapidPublicKey={getEnv().VAPID_PUBLIC_KEY}
        focusedMinutes={Math.round((session?.focusedSeconds ?? 0) / 60)}
        notesText={draft.notes?.notes ?? ""}
      />
    </ClientIntl>
  );
}
