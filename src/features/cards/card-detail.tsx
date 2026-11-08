"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { useRouter } from "@/src/i18n/navigation";
import { toast } from "@/src/components/ui/toast";
import {
  QuestionEditor,
  questionProblem,
  type EditableQuestion,
} from "./question-editor";
import { EXPLANATION_MAX, EXPLANATION_MIN } from "./schema";

export function CardEditor({
  id,
  topic: initialTopic,
  explanation: initialExplanation,
  status,
  subjectId,
  subjects,
  questions: initialQuestions,
}: {
  id: string;
  topic: string;
  explanation: string;
  status: "active" | "archived";
  subjectId: string | null;
  subjects: { id: string; name: string }[];
  questions: Omit<EditableQuestion, "key">[];
}) {
  const t = useTranslations("cards.detail");
  const router = useRouter();
  const [topic, setTopic] = useState(initialTopic);
  const [explanation, setExplanation] = useState(initialExplanation);
  const [questions, setQuestions] = useState<EditableQuestion[]>(() =>
    initialQuestions.map((q) => ({ ...q, key: q.id ?? crypto.randomUUID() })),
  );
  const [busy, setBusy] = useState(false);

  async function patch(body: Record<string, unknown>, message = t("saved")) {
    setBusy(true);
    try {
      const response = await fetch(`/api/cards/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error();
      toast(message);
      router.refresh();
    } catch {
      toast(t("error"), "error");
    } finally {
      setBusy(false);
    }
  }

  const invalid =
    !topic.trim() ||
    explanation.trim().length < EXPLANATION_MIN ||
    !questions.length ||
    questions.some((q) => questionProblem(q));

  return (
    <div className="stack" style={{ gap: 20 }}>
      <section className="card stack">
        <label className="field">
          <span className="label">{t("editTopic")}</span>
          <input
            className="input"
            dir="auto"
            maxLength={200}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
          />
        </label>
        <label className="field">
          <span className="label">{t("subject")}</span>
          <select
            className="select"
            value={subjectId ?? ""}
            disabled={busy}
            onChange={(e) => void patch({ subjectId: e.target.value || null })}
          >
            <option value="">{t("noSubject")}</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="label">{t("explanation")}</span>
          <textarea
            className="textarea"
            rows={8}
            dir="auto"
            maxLength={EXPLANATION_MAX}
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
          />
        </label>
      </section>
      <QuestionEditor questions={questions} onChange={setQuestions} />
      <div className="flex flex-wrap gap-2">
        <button
          className="btn btn-primary"
          disabled={busy || invalid}
          onClick={() =>
            void patch({
              topic: topic.trim(),
              explanation: explanation.trim(),
              questions: questions.map(({ key: _key, ...q }) => {
                void _key;
                return q;
              }),
            })
          }
        >
          {t("save")}
        </button>
        <button
          className="btn btn-secondary"
          disabled={busy}
          onClick={() =>
            void patch({ status: status === "active" ? "archived" : "active" })
          }
        >
          {status === "active" ? (
            <Archive size={16} aria-hidden="true" />
          ) : (
            <ArchiveRestore size={16} aria-hidden="true" />
          )}
          {status === "active" ? t("archive") : t("unarchive")}
        </button>
        <button
          className="btn btn-ghost"
          disabled={busy}
          onClick={async () => {
            if (!window.confirm(t("deleteConfirm"))) return;
            const response = await fetch(`/api/cards/${id}`, {
              method: "DELETE",
            });
            if (response.ok) {
              router.push("/app/cards");
              router.refresh();
            } else toast(t("error"), "error");
          }}
        >
          <Trash2 size={16} aria-hidden="true" />
          {t("delete")}
        </button>
      </div>
    </div>
  );
}
