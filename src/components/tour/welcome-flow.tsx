// SPDX-License-Identifier: AGPL-3.0-only
"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { WelcomeVideo } from "@/src/components/welcome-video";
import { Tour } from "./tour";
import { answerTour, dismissWelcomeVideo } from "./actions";
import styles from "./tour.module.css";

export function WelcomeFlow({
  initialPhase,
  replay = false,
}: {
  initialPhase: "video" | "tour" | "done";
  replay?: boolean;
}) {
  const t = useTranslations("onboarding.welcomeFlow");
  const [phase, setPhase] = useState(initialPhase);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!element || phase === "done") return;
    const previous = document.activeElement as HTMLElement | null;
    element.showModal();
    return () => {
      element.close();
      previous?.focus();
    };
  }, [phase]);
  function closeVideo() {
    startTransition(async () => {
      try {
        await dismissWelcomeVideo();
        setPhase("tour");
        setError(false);
      } catch {
        setError(true);
      }
    });
  }
  function respond(accepted: boolean) {
    startTransition(async () => {
      try {
        await answerTour(accepted);
        setPhase("done");
        setError(false);
        if (accepted)
          window.dispatchEvent(new CustomEvent("focuskept:start-tour"));
      } catch {
        setError(true);
      }
    });
  }
  return (
    <>
      <Tour autoStart={replay && initialPhase === "done"} />
      {phase !== "done" && (
        <dialog
          ref={dialog}
          className={styles.welcomeDialog}
          aria-labelledby="welcome-heading"
          onCancel={(event) => {
            event.preventDefault();
            if (!pending) {
              if (phase === "video") closeVideo();
              else respond(false);
            }
          }}
        >
          <div className="stack-lg">
            <h2 id="welcome-heading">
              {t(phase === "video" ? "title" : "tourQuestion")}
            </h2>
            <p className="muted">
              {t(phase === "video" ? "lead" : "tourLead")}
            </p>
            {phase === "video" && <WelcomeVideo />}
            {error && (
              <p role="alert" className="notice error">
                {t("saveError")}
              </p>
            )}
            <div className={styles.welcomeActions}>
              <button
                type="button"
                className="button secondary"
                disabled={pending}
                onClick={() =>
                  phase === "video" ? closeVideo() : respond(false)
                }
              >
                {t(phase === "video" ? "skip" : "no")}
              </button>
              <button
                type="button"
                className="button"
                disabled={pending}
                onClick={() =>
                  phase === "video" ? closeVideo() : respond(true)
                }
              >
                {t(phase === "video" ? "continue" : "yes")}
              </button>
            </div>
          </div>
        </dialog>
      )}
    </>
  );
}
