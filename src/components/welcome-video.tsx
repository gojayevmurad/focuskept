// SPDX-License-Identifier: AGPL-3.0-only
"use client";
import { useState, useSyncExternalStore } from "react";
import { useLocale, useTranslations } from "next-intl";

const subscribeMotion = (listener: () => void) => {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
};

/** Local media only. Missing assets leave a useful text introduction and working controls. */
export function WelcomeVideo({ captionsSrc }: { captionsSrc?: string }) {
  const t = useTranslations("onboarding.welcomeFlow");
  const locale = useLocale();
  const [unavailable, setUnavailable] = useState(false);
  const reducedMotion = useSyncExternalStore(subscribeMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches, () => true);
  if (unavailable) return <p role="status">{t("videoUnavailable")}</p>;
  return <video controls autoPlay={!reducedMotion} muted playsInline preload="metadata"
    poster="/media/welcome-poster.jpg" aria-label={t("videoLabel")} onError={() => setUnavailable(true)}
    style={{ width: "100%", aspectRatio: "16 / 9", borderRadius: "var(--radius-sm)", background: "var(--surface-2)" }}>
    <source src="/media/welcome.mp4" type="video/mp4" />
    <track kind="captions" src={captionsSrc ?? `/media/welcome.${locale}.vtt`} srcLang={locale} label={t("captions")} default />
    {t("videoUnavailable")}
  </video>;
}
