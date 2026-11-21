"use client";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/src/i18n/navigation";
import { bookSlot } from "../../(app)/book/actions";

export function JoinSlot({
  startAt,
  duration,
  username,
}: {
  startAt: string;
  duration: number;
  username: string;
}) {
  const t = useTranslations("publicProfile");
  const b = useTranslations("book");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="stack-sm" style={{ justifyItems: "end" }}>
      <button
        className="button small"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await bookSlot({
              startAt,
              duration,
              partner: username,
            });
            if (result.ok) router.push("/dashboard");
            else
              setError(
                b.has(`errors.${result.error}`)
                  ? b(`errors.${result.error}`)
                  : t("failed"),
              );
          })
        }
      >
        {t("join")}
      </button>
      {error && (
        <span className="small" style={{ color: "var(--danger)" }}>
          {error}
        </span>
      )}
    </div>
  );
}
