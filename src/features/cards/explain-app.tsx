"use client";
import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { LoaderCircle, Sparkles } from "lucide-react";
import { formatMinutes } from "@/src/features/focus/format";
import { Link } from "@/src/i18n/navigation";
import { toast } from "@/src/components/ui/toast";
import type {
  ExplanationAnalysis,
  DraftQuestion,
} from "@/src/lib/db/json-types";
import {
  UpgradeCard,
  type UpgradeReason,
} from "@/src/features/limits/upgrade-card";
import { FREE_ANALYSES_PER_CARD } from "@/src/features/limits/rules";
import { EXPLANATION_MAX, EXPLANATION_MIN } from "./schema";
import {
  QuestionEditor,
  questionProblem,
  type EditableQuestion,
} from "./question-editor";
import { PushOptIn } from "@/src/features/notifications/push-opt-in";

type Stage = "write" | "analyzing" | "review" | "saving" | "saved";

const toEditable = (questions: DraftQuestion[]): EditableQuestion[] =>
  questions.map((q) => ({ ...q, key: crypto.randomUUID() }));

export function ExplainApp({
  sessionId,
  topic,
  initialExplanation,
  initialAnalysis,
  initialQuestions,
  analysesUsed: initialAnalysesUsed,
  pro,
  aiAvailable,
  aiRemaining,
  aiLimit,
  cardsRemaining,
  vapidPublicKey,
  focusedMinutes,
  notesText = "",
}: {
  sessionId: string;
  topic: string;
  /** Kept for callers; methods are no longer shown. */
  methodName?: string;
  initialExplanation: string;
  initialAnalysis: ExplanationAnalysis | null;
  initialQuestions: DraftQuestion[] | null;
  analysesUsed: number;
  pro: boolean;
  aiAvailable: boolean;
  aiRemaining: number;
  aiLimit: number;
  cardsRemaining: number | null;
  vapidPublicKey?: string;
  /** Focused minutes of the session: scales the writing hint (DESIGN). */
  focusedMinutes: number;
  /** Break notes, pre-filled into an empty explanation. */
  notesText?: string;
}) {
  const t = useTranslations("learn.explain");
  const locale = useLocale();
  const [explanation, setExplanation] = useState(
    initialExplanation || notesText,
  );
  const [analysis, setAnalysis] = useState(initialAnalysis);
  const [questions, setQuestions] = useState<EditableQuestion[]>(
    toEditable(initialQuestions ?? []),
  );
  const [stage, setStage] = useState<Stage>(
    initialAnalysis || initialQuestions ? "review" : "write",
  );
  const [analysesUsed, setAnalysesUsed] = useState(initialAnalysesUsed);
  const [blocked, setBlocked] = useState<{
    reason: UpgradeReason;
    values?: Record<string, number>;
  } | null>(
    cardsRemaining === 0
      ? { reason: "card_limit" }
      : !pro && aiRemaining === 0 && !initialAnalysis
        ? { reason: "monthly_limit", values: { limit: aiLimit } }
        : null,
  );
  const [aiError, setAiError] = useState(false);
  const [saved, setSaved] = useState<{ id: string; dueOn: string } | null>(
    null,
  );
  const nf = new Intl.NumberFormat(locale);
  const length = explanation.trim().length;
  const tooShort = length < EXPLANATION_MIN;
  const canReanalyze = pro || analysesUsed < FREE_ANALYSES_PER_CARD;

  // Autosave the explanation while typing (debounced).
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    if (stage !== "write") return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void fetch(`/api/learn/${encodeURIComponent(sessionId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ explanation }),
      }).catch(() => {});
    }, 1200);
    return () => clearTimeout(timer.current);
  }, [explanation, sessionId, stage]);

  async function analyze() {
    setStage("analyzing");
    setAiError(false);
    try {
      const response = await fetch(
        `/api/learn/${encodeURIComponent(sessionId)}/analyze`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ explanation }),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        setAnalysis(data.analysis);
        setQuestions(toEditable(data.questions));
        setAnalysesUsed(data.analysesUsed);
        setStage("review");
        return;
      }
      if (
        ["monthly_limit", "reanalysis_limit", "budget", "card_limit"].includes(
          data.error,
        )
      )
        setBlocked({
          reason: data.error,
          values:
            data.allowance?.limit !== undefined
              ? { limit: data.allowance.limit }
              : undefined,
        });
      else setAiError(true);
    } catch {
      setAiError(true);
    }
    // Manual fallback: the card can always be created by hand.
    setStage("review");
  }

  async function save() {
    if (questions.some((q) => questionProblem(q))) {
      toast(t("fixQuestions"), "error");
      return;
    }
    setStage("saving");
    try {
      const response = await fetch("/api/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          explanation,
          questions: questions.map(
            ({ type, prompt, answer, explanation: why, source }) => ({
              type,
              prompt,
              answer,
              explanation: why,
              source,
            }),
          ),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 403 && data.error === "card_limit") {
        setBlocked({ reason: "card_limit" });
        setStage("review");
        return;
      }
      if (!response.ok) throw new Error();
      setSaved(data);
      setStage("saved");
    } catch {
      toast(t("saveError"), "error");
      setStage("review");
    }
  }

  if (stage === "saved" && saved)
    return (
      <div className="end-view">
        <p className="eyebrow eyebrow-amber" dir="auto">
          {t("savedTitle")} · {topic}
        </p>
        <h1 className="end-title">
          {t("keptTitle", { count: questions.length })}
        </h1>
        <p className="end-lead">
          {t("savedText", {
            date: new Intl.DateTimeFormat(locale, {
              dateStyle: "long",
              timeZone: "UTC",
            }).format(new Date(`${saved.dueOn}T12:00:00Z`)),
          })}
        </p>
        <PushOptIn vapidPublicKey={vapidPublicKey} variant="card" />
        <div className="end-actions">
          <Link href="/app" className="btn btn-primary btn-lg">
            {t("newSession")}
          </Link>
          <Link
            href={`/app/cards/${saved.id}`}
            className="btn btn-secondary btn-lg"
          >
            {t("viewCard")}
          </Link>
        </div>
      </div>
    );

  if (stage === "analyzing")
    return (
      <div className="end-view analyzing" role="status">
        <div className="dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <p className="end-title">{t("analyzing")}</p>
        <p className="end-lead">{t("readingText")}</p>
      </div>
    );

  const hint =
    focusedMinutes <= 30
      ? t("hintShort")
      : focusedMinutes <= 60
        ? t("hintMid")
        : t("hintLong");

  return (
    <div className="explain">
      {stage === "write" ? (
        <section className="explain-write">
          <p className="eyebrow" dir="auto">
            {t("focused", {
              duration: formatMinutes(focusedMinutes, locale),
            })}{" "}
            · {topic}
          </p>
          <label className="end-title" htmlFor="explain-text">
            {t("writeTitle")}
          </label>
          <p className="end-lead">{hint}</p>
          <textarea
            id="explain-text"
            className="note-field explain-field"
            rows={9}
            dir="auto"
            value={explanation}
            maxLength={EXPLANATION_MAX}
            aria-describedby="explain-count"
            onChange={(e) => setExplanation(e.target.value)}
          />
          <p
            id="explain-count"
            className={tooShort ? "hint" : "hint text-success"}
            aria-live="polite"
          >
            {t("counter", {
              count: nf.format(length),
              max: nf.format(EXPLANATION_MAX),
              min: nf.format(EXPLANATION_MIN),
            })}
          </p>
          {blocked && (
            <UpgradeCard reason={blocked.reason} values={blocked.values} />
          )}
          <div className="end-actions">
            <button
              className="btn btn-amber btn-lg"
              disabled={tooShort || !aiAvailable || Boolean(blocked)}
              onClick={() => void analyze()}
            >
              <Sparkles size={17} aria-hidden="true" />
              {t("check")}
            </button>
            <button
              className="btn btn-ghost"
              disabled={tooShort}
              onClick={() => setStage("review")}
            >
              {t("manual")}
            </button>
            {!aiAvailable && <span className="hint">{t("aiOff")}</span>}
            {aiAvailable && !pro && !blocked && (
              <span className="hint">
                {t("remaining", { count: aiRemaining })}
              </span>
            )}
          </div>
          <p className="hint">
            {t.rich("openaiNotice", {
              privacy: (chunks) => (
                <Link className="link" href="/privacy">
                  {chunks}
                </Link>
              ),
            })}
          </p>
        </section>
      ) : (
        <div className="explain-review">
          <div className="explain-side">
            <p className="eyebrow" dir="auto">
              {t("analysisTitle")} · {topic}
            </p>
            <section className="card stack">
              <div className="flex items-center justify-between gap-2">
                <h2 className="card-title">{t("yourExplanation")}</h2>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setStage("write")}
                >
                  {analysis && canReanalyze ? t("revise") : t("edit")}
                </button>
              </div>
              <p className="small whitespace-pre-wrap" dir="auto">
                {explanation}
              </p>
            </section>

            {aiError && (
              <p className="notice notice-warning">{t("aiFailed")}</p>
            )}
            {blocked && (
              <UpgradeCard reason={blocked.reason} values={blocked.values} />
            )}

            {analysis && (
              <section className="card stack" aria-labelledby="analysis-title">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 id="analysis-title" className="card-title">
                    {t("analysisTitle")}
                  </h2>
                  <span className="badge badge-accent tabular">
                    {t("clarity", { score: analysis.clarityScore })}
                  </span>
                </div>
                <div
                  className="progress"
                  role="meter"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={analysis.clarityScore}
                  aria-label={t("clarityLabel")}
                >
                  <span style={{ inlineSize: `${analysis.clarityScore}%` }} />
                </div>
                <div className="grid-2">
                  <div>
                    <h3 className="label mb-1">{t("gaps")}</h3>
                    {analysis.gaps.length ? (
                      <ul
                        className="small stack"
                        style={{ gap: 4, paddingInlineStart: 18, margin: 0 }}
                      >
                        {analysis.gaps.map((g, i) => (
                          <li key={i} dir="auto">
                            {g}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="small muted">{t("noGaps")}</p>
                    )}
                  </div>
                  <div>
                    <h3 className="label mb-1">{t("mistakes")}</h3>
                    {analysis.mistakes.length ? (
                      <ul
                        className="small stack"
                        style={{ gap: 4, paddingInlineStart: 18, margin: 0 }}
                      >
                        {analysis.mistakes.map((m, i) => (
                          <li key={i} dir="auto">
                            {m}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="small muted">{t("noMistakes")}</p>
                    )}
                  </div>
                </div>
                {analysis.rewriteSuggestion && (
                  <details>
                    <summary className="label" style={{ cursor: "pointer" }}>
                      {t("rewrite")}
                    </summary>
                    <p className="small mt-2 whitespace-pre-wrap" dir="auto">
                      {analysis.rewriteSuggestion}
                    </p>
                    <button
                      className="btn btn-ghost btn-sm mt-2"
                      onClick={() => {
                        setExplanation(analysis.rewriteSuggestion);
                        setStage("write");
                      }}
                    >
                      {t("useRewrite")}
                    </button>
                  </details>
                )}
                {!canReanalyze && <p className="hint">{t("reanalysisUsed")}</p>}
              </section>
            )}
          </div>
          <div className="explain-main">
            <section className="stack" aria-labelledby="questions-title">
              <div>
                <h2 id="questions-title" className="card-title">
                  {t("questionsTitle")}
                </h2>
                <p className="hint">{t("questionsHint")}</p>
              </div>
              <QuestionEditor questions={questions} onChange={setQuestions} />
            </section>

            <div className="end-actions">
              <button
                className="btn btn-amber btn-lg"
                disabled={
                  !questions.length ||
                  stage === "saving" ||
                  blocked?.reason === "card_limit"
                }
                onClick={() => void save()}
              >
                {stage === "saving" && (
                  <LoaderCircle
                    size={17}
                    className="animate-spin"
                    aria-hidden="true"
                  />
                )}
                {questions.length
                  ? t("keep", { count: questions.length })
                  : t("save")}
              </button>
              {!questions.length && (
                <span className="hint">{t("needQuestion")}</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
