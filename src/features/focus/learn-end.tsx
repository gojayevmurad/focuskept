"use client";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/src/i18n/navigation";
import { formatMinutes } from "./format";

/** Learning session without a topic: ask for it before the card is created. */
export function LearnTopic({
  focusedSeconds,
  saving,
  onContinue,
}: {
  focusedSeconds: number;
  saving: boolean;
  onContinue: (topic: string) => void;
}) {
  const t = useTranslations("home");
  const locale = useLocale();
  const [topic, setTopic] = useState("");
  return (
    <form
      className="end-view"
      onSubmit={(e) => {
        e.preventDefault();
        if (topic.trim()) onContinue(topic.trim());
      }}
    >
      <p className="eyebrow">
        {t("endFocused", {
          duration: formatMinutes(focusedSeconds / 60, locale),
        })}
      </p>
      <label className="end-title" htmlFor="learn-topic">
        {t("topicTitle")}
      </label>
      <input
        id="learn-topic"
        className="line-input"
        dir="auto"
        required
        maxLength={200}
        autoFocus
        value={topic}
        placeholder={t("placeholderLearn")}
        onChange={(e) => setTopic(e.target.value)}
      />
      <p className="hint">{t("topicHint")}</p>
      <div className="end-actions">
        <button
          className="btn btn-amber btn-lg"
          disabled={saving || !topic.trim()}
        >
          {t("continue")}
        </button>
      </div>
    </form>
  );
}

/**
 * Visitors: explanation and cards need an account. The finished
 * session stays in the device's active-session store and continues after
 * sign-in.
 */
export function LearnSignUp({
  focusedSeconds,
  topic,
  onSkip,
}: {
  focusedSeconds: number;
  topic: string;
  onSkip: () => void;
}) {
  const t = useTranslations("home");
  const locale = useLocale();
  const next = encodeURIComponent("/app");
  return (
    <div className="end-view">
      <p className="eyebrow eyebrow-amber">
        {t("oneStep")}
        {topic ? ` · ${topic}` : ""}
      </p>
      <h1 className="end-title">{t("anonTitle")}</h1>
      <p className="end-lead">
        {t("endFocused", {
          duration: formatMinutes(focusedSeconds / 60, locale),
        })}
        {" · "}
        {t("anonText")}
      </p>
      <div className="end-actions">
        <Link href={`/sign-up?next=${next}`} className="btn btn-amber btn-lg">
          {t("createAccount")}
        </Link>
        <Link
          href={`/sign-in?next=${next}`}
          className="btn btn-secondary btn-lg"
        >
          {t("haveAccount")}
        </Link>
        <button type="button" className="btn btn-ghost" onClick={onSkip}>
          {t("skipCard")}
        </button>
      </div>
    </div>
  );
}
