"use client";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CheckCircle2, LoaderCircle, PartyPopper, XCircle } from "lucide-react";
import { Link } from "@/src/i18n/navigation";
import { toast } from "@/src/components/ui/toast";
import { BLANK } from "@/src/lib/ai/schemas";
import { gradeByRule, type Verdict } from "./grading";
import type { ReviewCard } from "./server";

type Answer = {
  answer: string;
  verdict?: Verdict;
  feedback?: string;
  gradedBy: "rule" | "ai" | "self";
};
type CardResult = {
  passed: boolean;
  scorePct: number;
  nextDueOn: string;
  early: boolean;
  missed: string[];
};

export function ReviewApp({
  cards,
  aiAvailable,
}: {
  cards: ReviewCard[];
  aiAvailable: boolean;
}) {
  const t = useTranslations("review");
  const locale = useLocale();
  const [cardIndex, setCardIndex] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [selfGrade, setSelfGrade] = useState(false);
  const [result, setResult] = useState<CardResult | null>(null);
  const [done, setDone] = useState<{ passed: number; total: number }>({
    passed: 0,
    total: 0,
  });
  const [clientId, setClientId] = useState(() => crypto.randomUUID());

  const nf = new Intl.NumberFormat(locale);
  const dateFmt = new Intl.DateTimeFormat(locale, {
    dateStyle: "long",
    timeZone: "UTC",
  });
  const formatDay = (day: string) =>
    dateFmt.format(new Date(`${day}T12:00:00Z`));

  if (!cards.length || cardIndex >= cards.length)
    return (
      <div className="card empty mx-auto" style={{ maxWidth: 560 }}>
        <PartyPopper size={34} aria-hidden="true" />
        <h1 className="text-xl">
          {cards.length ? t("allDoneTitle") : t("emptyTitle")}
        </h1>
        <p className="small">
          {cards.length
            ? t("allDoneText", { passed: done.passed, total: done.total })
            : t("emptyText")}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Link href="/app" className="btn btn-secondary">
            {t("toTimer")}
          </Link>
          <Link href="/app/learn/new" className="btn btn-primary">
            {t("learnSomething")}
          </Link>
        </div>
      </div>
    );

  const card = cards[cardIndex];
  const q = card.questions[questionIndex];
  const current = answers[q.id];
  const checked = Boolean(current?.verdict);

  function record(answer: Answer) {
    setAnswers((all) => ({ ...all, [q.id]: answer }));
  }

  async function check(value: string) {
    if (q.type !== "open") {
      record({
        answer: value,
        verdict: gradeByRule(q.type, value, q.answer),
        gradedBy: "rule",
      });
      return;
    }
    if (!aiAvailable) {
      record({ answer: value, gradedBy: "self" });
      setSelfGrade(true);
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/reviews/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: q.id, answer: value }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error);
      record({
        answer: value,
        verdict: data.verdict,
        feedback: data.feedback,
        gradedBy: "ai",
      });
    } catch {
      // AI unavailable or daily limit: the learner grades the answer themselves.
      record({ answer: value, gradedBy: "self" });
      setSelfGrade(true);
    } finally {
      setBusy(false);
    }
  }

  async function finishCard(final: Record<string, Answer>) {
    setBusy(true);
    try {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardId: card.id,
          clientId,
          answers: card.questions.map((question) => ({
            questionId: question.id,
            answer: final[question.id]?.answer ?? "",
            verdict: final[question.id]?.verdict,
            feedback: final[question.id]?.feedback,
            gradedBy: final[question.id]?.gradedBy ?? "self",
          })),
        }),
      });
      if (!response.ok) throw new Error();
      const data = (await response.json()) as Omit<CardResult, "missed">;
      const missed = card.questions
        .filter((question) => final[question.id]?.verdict !== "correct")
        .map((question) => question.prompt);
      setResult({ ...data, missed });
      setDone((d) => ({
        passed: d.passed + (data.passed ? 1 : 0),
        total: d.total + 1,
      }));
    } catch {
      toast(t("saveError"), "error");
    } finally {
      setBusy(false);
    }
  }

  function next() {
    setDraft("");
    setSelfGrade(false);
    if (questionIndex < card.questions.length - 1)
      setQuestionIndex(questionIndex + 1);
    else void finishCard(answers);
  }

  function nextCard() {
    setResult(null);
    setAnswers({});
    setQuestionIndex(0);
    setClientId(crypto.randomUUID());
    setCardIndex(cardIndex + 1);
  }

  const progress = (
    <div className="stack" style={{ gap: 6 }}>
      <div className="flex justify-between tiny muted">
        <span>
          {t("progress", { current: cardIndex + 1, total: cards.length })}
        </span>
        {!result && (
          <span>
            {t("questionProgress", {
              current: questionIndex + 1,
              total: card.questions.length,
            })}
          </span>
        )}
      </div>
      <div className="progress progress-amber" aria-hidden="true">
        <span
          style={{
            inlineSize: `${((cardIndex + (result ? 1 : 0)) / cards.length) * 100}%`,
          }}
        />
      </div>
    </div>
  );

  if (result)
    return (
      <div className="stack mx-auto w-full" style={{ maxWidth: 640 }}>
        {progress}
        <section className="card stack items-center text-center">
          {result.passed ? (
            <CheckCircle2
              size={36}
              className="text-success"
              aria-hidden="true"
            />
          ) : (
            <XCircle size={36} className="text-warning" aria-hidden="true" />
          )}
          <h1 className="text-xl">
            {result.passed ? t("passedTitle") : t("missedTitle")}
          </h1>
          <p className="stat-value">{t("score", { score: result.scorePct })}</p>
          <p className="muted small">
            {result.early
              ? t("earlyNote", { date: formatDay(result.nextDueOn) })
              : t("nextReview", { date: formatDay(result.nextDueOn) })}
          </p>
          {result.missed.length > 0 && (
            <div className="w-full text-start">
              <h2 className="label mb-1">{t("revisit")}</h2>
              <ul
                className="small"
                style={{ margin: 0, paddingInlineStart: 18 }}
              >
                {result.missed.map((prompt, i) => (
                  <li key={i} dir="auto">
                    {prompt}
                  </li>
                ))}
              </ul>
              <Link href={`/app/cards/${card.id}`} className="link small">
                {t("openExplanation")}
              </Link>
            </div>
          )}
          <button className="btn btn-primary" onClick={nextCard} autoFocus>
            {cardIndex < cards.length - 1 ? t("nextCard") : t("finish")}
          </button>
        </section>
      </div>
    );

  const [before, after] =
    q.type === "cloze" ? q.prompt.split(BLANK) : [q.prompt, ""];

  return (
    <div className="stack mx-auto w-full" style={{ maxWidth: 640 }}>
      {progress}
      <section className="review-card stack" aria-live="polite">
        <span className="eyebrow" dir="auto">
          {card.topic}
        </span>
        <span className="badge self-start">{t(`types.${q.type}`)}</span>
        {q.type === "cloze" ? (
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              if (!checked && draft.trim()) void check(draft);
            }}
          >
            <p className="review-prompt" dir="auto">
              {before}
              <input
                className="input inline-block mx-1"
                style={{
                  inlineSize: "12ch",
                  minHeight: 36,
                  padding: "4px 8px",
                }}
                aria-label={t("blankLabel")}
                value={draft}
                disabled={checked}
                autoFocus
                onChange={(e) => setDraft(e.target.value)}
              />
              {after}
            </p>
            {!checked && (
              <div>
                <button className="btn btn-primary" disabled={!draft.trim()}>
                  {t("check")}
                </button>
              </div>
            )}
          </form>
        ) : (
          <h1 className="review-prompt" dir="auto">
            {q.prompt}
          </h1>
        )}
        {q.type === "true_false" && !checked && (
          <div className="flex gap-2">
            {(["true", "false"] as const).map((value) => (
              <button
                key={value}
                className="btn btn-secondary btn-lg flex-1"
                onClick={() => void check(value)}
              >
                {t(value)}
              </button>
            ))}
          </div>
        )}
        {q.type === "open" && !checked && !selfGrade && (
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              if (draft.trim()) void check(draft);
            }}
          >
            <label className="field">
              <span className="sr-only">{t("yourAnswer")}</span>
              <textarea
                className="textarea"
                style={{ minHeight: 100 }}
                dir="auto"
                maxLength={2000}
                value={draft}
                placeholder={t("yourAnswer")}
                autoFocus
                onChange={(e) => setDraft(e.target.value)}
              />
            </label>
            <div>
              <button
                className="btn btn-primary"
                disabled={!draft.trim() || busy}
              >
                {busy && (
                  <LoaderCircle
                    size={16}
                    className="animate-spin"
                    aria-hidden="true"
                  />
                )}
                {busy ? t("grading") : t("check")}
              </button>
            </div>
          </form>
        )}

        {selfGrade && !checked && (
          <div className="stack">
            <p className="notice small">{t("selfGradeNote")}</p>
            <div>
              <span className="label">{t("modelAnswer")}</span>
              <p dir="auto">{q.answer}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {(["correct", "partial", "incorrect"] as const).map((verdict) => (
                <button
                  key={verdict}
                  className="btn btn-secondary"
                  onClick={() =>
                    record({ ...current!, verdict, gradedBy: "self" })
                  }
                >
                  {t(`self.${verdict}`)}
                </button>
              ))}
            </div>
          </div>
        )}

        {checked && current && (
          <div className="stack" style={{ gap: 10 }}>
            <p
              className={
                current.verdict === "correct"
                  ? "notice notice-success"
                  : current.verdict === "partial"
                    ? "notice notice-warning"
                    : "notice notice-danger"
              }
              role="status"
            >
              <strong>{t(`verdict.${current.verdict!}`)}</strong>
              {current.feedback ? ` ${current.feedback}` : ""}
            </p>
            {current.verdict !== "correct" && (
              <div>
                <span className="label">{t("modelAnswer")}</span>
                <p dir="auto">
                  {q.type === "true_false"
                    ? t(q.answer as "true" | "false")
                    : q.answer}
                </p>
              </div>
            )}
            {q.explanation && (
              <p className="small muted" dir="auto">
                {q.explanation}
              </p>
            )}
            <div>
              <button
                className="btn btn-primary"
                onClick={next}
                disabled={busy}
                autoFocus
              >
                {busy && (
                  <LoaderCircle
                    size={16}
                    className="animate-spin"
                    aria-hidden="true"
                  />
                )}
                {questionIndex < card.questions.length - 1
                  ? t("nextQuestion")
                  : t("finishCard")}
              </button>
            </div>
          </div>
        )}
      </section>
      <p className="hint text-center">
        {t("passRule", { count: nf.format(card.questions.length) })}
      </p>
    </div>
  );
}
