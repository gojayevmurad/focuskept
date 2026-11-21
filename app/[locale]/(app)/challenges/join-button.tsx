// SPDX-License-Identifier: AGPL-3.0-only
"use client";
import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { toggleChallenge } from "./actions";

export function JoinChallenge({
  id,
  joined,
  ended,
}: {
  id: string;
  joined: boolean;
  ended: boolean;
}) {
  const t = useTranslations("challenges");
  const [pending, start] = useTransition();
  if (ended) return null;
  return (
    <button
      className={`button small ${joined ? "secondary" : ""}`}
      disabled={pending}
      onClick={() => start(() => toggleChallenge(id, !joined))}
    >
      {joined ? t("leave") : t("join")}
    </button>
  );
}
