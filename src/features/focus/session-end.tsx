"use client";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { formatMinutes } from "./format";
import { MIN_COMPLETED_SECONDS } from "@/src/features/sessions/schema";

export type EndInput = {
  rating: number | null;
  note: string;
  taskDone: boolean;
};

const MOODS = [1, 2, 3, 4, 5] as const;

/** End of a Working session: five words for the 1–5 rating, task done, Save. */
export function SessionEnd({
  focusedSeconds,
  task,
  defaultTaskDone,
  saving,
  onSave,
  onDiscard,
}: {
  focusedSeconds: number;
  task?: string;
  defaultTaskDone: boolean;
  saving: boolean;
  onSave: (input: EndInput) => void;
  onDiscard: () => void;
}) {
  const t = useTranslations("home");
  const end = useTranslations("focus.end");
  const locale = useLocale();
  const [rating, setRating] = useState<number | null>(null);
  const [taskDone, setTaskDone] = useState(defaultTaskDone);
  return (
    <form
      className="end-view"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ rating, note: "", taskDone });
      }}
    >
      <p className="eyebrow">
        {t("endFocused", {
          duration: formatMinutes(focusedSeconds / 60, locale),
        })}
      </p>
      {focusedSeconds < MIN_COMPLETED_SECONDS && (
        <p className="notice notice-warning small">{end("tooShort")}</p>
      )}
      <h1 className="end-title" id="rating-title">
        {t("howDidItGo")}
      </h1>
      <div className="moods" role="radiogroup" aria-labelledby="rating-title">
        {MOODS.map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={rating === value}
            aria-label={`${t(`moods.${value}`)} (${end("ratingValue", { value })})`}
            onClick={() => setRating(value)}
          >
            {t(`moods.${value}`)}
          </button>
        ))}
      </div>
      {task && (
        <button
          type="button"
          role="checkbox"
          aria-checked={taskDone}
          className="check-row"
          onClick={() => setTaskDone((v) => !v)}
        >
          <span className="check-dot" aria-hidden="true">
            {taskDone && <Check size={13} strokeWidth={3} />}
          </span>
          <span dir="auto">{t("taskDone", { task })}</span>
        </button>
      )}
      <div className="end-actions">
        <button className="btn btn-primary btn-lg" disabled={saving}>
          {t("save")}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            if (window.confirm(end("discardConfirm"))) onDiscard();
          }}
        >
          {t("discard")}
        </button>
      </div>
    </form>
  );
}
