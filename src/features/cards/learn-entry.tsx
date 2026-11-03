"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import { useRouter } from "@/src/i18n/navigation";

/** Public Learning entry: signed-in users go to setup; visitors sign up first, topic preserved. */
export function LearnEntry() {
  const t = useTranslations("learn.public");
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const clean = topic.trim().slice(0, 200);
        const next = `/app/learn/new${clean ? `?topic=${encodeURIComponent(clean)}` : ""}`;
        const session = await fetch("/api/auth/get-session")
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null);
        if (session?.user?.emailVerified) router.push(next);
        else
          router.push({
            pathname: "/sign-up",
            query: { next, ...(clean ? { topic: clean } : {}) },
          });
      }}
    >
      <label className="field">
        <span className="label">{t("topicLabel")}</span>
        <input
          className="input"
          dir="auto"
          value={topic}
          maxLength={200}
          placeholder={t("topicPlaceholder")}
          onChange={(e) => setTopic(e.target.value)}
        />
      </label>
      <div>
        <button className="btn btn-primary btn-lg" disabled={busy}>
          {t("start")}
          <ArrowRight size={18} className="rtl-flip" aria-hidden="true" />
        </button>
      </div>
      <p className="hint">{t("accountNote")}</p>
    </form>
  );
}
