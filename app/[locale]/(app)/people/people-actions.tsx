"use client";
import { useTransition } from "react";
import { Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { toggleFavorite, unblock } from "./actions";

export function FavoriteButton({
  userId,
  active,
  disabled,
}: {
  userId: string;
  active: boolean;
  disabled?: boolean;
}) {
  const t = useTranslations("people");
  const [pending, start] = useTransition();
  return (
    <button
      className={`button small ${active ? "on" : "secondary"}`}
      disabled={pending || disabled}
      onClick={() => start(async () => void (await toggleFavorite(userId)))}
    >
      <Star size={14} /> {active ? t("favorited") : t("favorite")}
    </button>
  );
}

export function UnblockButton({ userId }: { userId: string }) {
  const t = useTranslations("people");
  const [pending, start] = useTransition();
  return (
    <button
      className="button ghost small"
      disabled={pending}
      onClick={() => start(async () => void (await unblock(userId)))}
    >
      {t("unblock")}
    </button>
  );
}
