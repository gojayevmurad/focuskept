"use client";
import { useTranslations } from "next-intl";
import { Plus, Trash2 } from "lucide-react";
import { BLANK } from "@/src/lib/ai/schemas";
import { MAX_QUESTIONS } from "./schema";

export type EditableQuestion = {
  id?: string;
  /** Stable React key for unsaved questions. */
  key: string;
  type: "open" | "true_false" | "cloze";
  prompt: string;
  answer: string;
  explanation: string;
  source: "ai" | "user" | "ai_edited";
};

export function newQuestion(
  type: EditableQuestion["type"] = "open",
): EditableQuestion {
  return {
    key: crypto.randomUUID(),
    type,
    prompt: type === "cloze" ? BLANK : "",
    answer: type === "true_false" ? "true" : "",
    explanation: "",
    source: "user",
  };
}

export function questionProblem(
  q: EditableQuestion,
): "prompt" | "answer" | "blank" | null {
  if (!q.prompt.trim()) return "prompt";
  if (q.type === "cloze" && q.prompt.split(BLANK).length !== 2) return "blank";
  if (!q.answer.trim()) return "answer";
  return null;
}

export function QuestionEditor({
  questions,
  onChange,
}: {
  questions: EditableQuestion[];
  onChange: (questions: EditableQuestion[]) => void;
}) {
  const t = useTranslations("cards.questions");
  const set = (index: number, patch: Partial<EditableQuestion>) =>
    onChange(
      questions.map((q, i) =>
        i === index
          ? {
              ...q,
              ...patch,
              source: q.source === "ai" ? "ai_edited" : q.source,
            }
          : q,
      ),
    );
  return (
    <div className="stack" style={{ gap: 14 }}>
      {questions.map((q, i) => {
        const problem = questionProblem(q);
        return (
          <fieldset
            key={q.key}
            className="card card-sm stack"
            style={{ gap: 10 }}
          >
            <legend className="sr-only">{t("number", { n: i + 1 })}</legend>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="label">{t("number", { n: i + 1 })}</span>
              <div className="flex items-center gap-2">
                {q.source !== "user" && (
                  <span className="badge">{t(`source.${q.source}`)}</span>
                )}
                <select
                  className="select select-sm"
                  aria-label={t("type")}
                  value={q.type}
                  onChange={(e) => {
                    const type = e.target.value as EditableQuestion["type"];
                    set(i, {
                      type,
                      answer:
                        type === "true_false"
                          ? "true"
                          : q.type === "true_false"
                            ? ""
                            : q.answer,
                      prompt:
                        type === "cloze" && !q.prompt.includes(BLANK)
                          ? `${q.prompt} ${BLANK}`.trim()
                          : q.prompt,
                    });
                  }}
                >
                  {(["open", "true_false", "cloze"] as const).map((type) => (
                    <option key={type} value={type}>
                      {t(`types.${type}`)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn btn-ghost btn-icon"
                  aria-label={t("delete", { n: i + 1 })}
                  onClick={() => onChange(questions.filter((_, j) => j !== i))}
                >
                  <Trash2 size={15} aria-hidden="true" />
                </button>
              </div>
            </div>
            <label className="field">
              <span className="label tiny">{t("prompt")}</span>
              <textarea
                className="textarea"
                style={{ minHeight: 60 }}
                dir="auto"
                maxLength={500}
                value={q.prompt}
                aria-invalid={problem === "prompt" || problem === "blank"}
                onChange={(e) => set(i, { prompt: e.target.value })}
              />
              {q.type === "cloze" && (
                <span className="hint">{t("clozeHint", { blank: BLANK })}</span>
              )}
            </label>
            {q.type === "true_false" ? (
              <fieldset className="field">
                <legend className="label tiny">{t("answer")}</legend>
                <div className="segmented">
                  {(["true", "false"] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={q.answer === value}
                      onClick={() => set(i, { answer: value })}
                    >
                      {t(value)}
                    </button>
                  ))}
                </div>
              </fieldset>
            ) : (
              <label className="field">
                <span className="label tiny">{t("answer")}</span>
                <input
                  className="input"
                  dir="auto"
                  maxLength={300}
                  value={q.answer}
                  aria-invalid={problem === "answer"}
                  onChange={(e) => set(i, { answer: e.target.value })}
                />
              </label>
            )}
            <label className="field">
              <span className="label tiny">{t("explanation")}</span>
              <input
                className="input"
                dir="auto"
                maxLength={500}
                value={q.explanation}
                placeholder={t("explanationPlaceholder")}
                onChange={(e) => set(i, { explanation: e.target.value })}
              />
            </label>
            {problem && (
              <p className="error-text">{t(`problems.${problem}`)}</p>
            )}
          </fieldset>
        );
      })}
      {questions.length < MAX_QUESTIONS && (
        <div className="flex flex-wrap gap-2">
          {(["open", "true_false", "cloze"] as const).map((type) => (
            <button
              key={type}
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => onChange([...questions, newQuestion(type)])}
            >
              <Plus size={15} aria-hidden="true" />
              {t(`add.${type}`)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
