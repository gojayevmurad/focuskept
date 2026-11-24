// SPDX-License-Identifier: AGPL-3.0-only
"use client";
import React, { useEffect, useState, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { X, ChevronRight, ChevronLeft, Check } from "lucide-react";
import {
  trackTourStarted,
  trackTourCompleted,
} from "@/src/lib/analytics/client";
import styles from "./tour.module.css";

type TourTitleKey =
  | "stepBookTitle"
  | "stepUpcomingTitle"
  | "stepSuggestionsTitle"
  | "stepPeopleTitle"
  | "stepProgressTitle";

type TourDescKey =
  | "stepBookDesc"
  | "stepUpcomingDesc"
  | "stepSuggestionsDesc"
  | "stepPeopleDesc"
  | "stepProgressDesc";

interface TourStep {
  id: string;
  target: string;
  titleKey: TourTitleKey;
  descKey: TourDescKey;
}

const STEPS: TourStep[] = [
  {
    id: "book",
    target: 'a[href="/book"], a[href$="/book"]',
    titleKey: "stepBookTitle",
    descKey: "stepBookDesc",
  },
  {
    id: "upcoming",
    target:
      '[data-tour="upcoming"], [data-tour="first-run"], section[class*="upcoming"]',
    titleKey: "stepUpcomingTitle",
    descKey: "stepUpcomingDesc",
  },
  {
    id: "suggestions",
    target: '[data-tour="suggestions"], [class*="suggestions"]',
    titleKey: "stepSuggestionsTitle",
    descKey: "stepSuggestionsDesc",
  },
  {
    id: "people",
    target: 'a[href="/people"], a[href$="/people"]',
    titleKey: "stepPeopleTitle",
    descKey: "stepPeopleDesc",
  },
  {
    id: "progress",
    target:
      'a[href="/progress"], a[href$="/progress"], [data-tour="stats"], dl[class*="stats"]',
    titleKey: "stepProgressTitle",
    descKey: "stepProgressDesc",
  },
];

export function Tour({ autoStart = false }: { autoStart?: boolean }) {
  const t = useTranslations("tour");
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [popoverPos, setPopoverPos] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  const startTour = useCallback(() => {
    previousFocus.current = document.activeElement as HTMLElement | null;
    setStepIndex(0);
    setActive(true);
    trackTourStarted();
  }, []);

  const completeTour = useCallback(() => {
    setActive(false);
    previousFocus.current?.focus();
    trackTourCompleted();
  }, []);

  const skipTour = useCallback(() => {
    setActive(false);
    previousFocus.current?.focus();
  }, []);

  // Listen for manual trigger from help menu / topbar
  useEffect(() => {
    const handleTrigger = () => startTour();
    window.addEventListener("focuskept:start-tour", handleTrigger);
    return () =>
      window.removeEventListener("focuskept:start-tour", handleTrigger);
  }, [startTour]);

  // Automatic start is only used for an explicit Settings replay.
  useEffect(() => {
    if (!autoStart) return;
    const timer = setTimeout(startTour, 200);
    return () => clearTimeout(timer);
  }, [autoStart, startTour]);

  const updatePosition = useCallback(() => {
    if (!active) return;
    const currentStep = STEPS[stepIndex];
    if (!currentStep) return;

    const el = document.querySelector(currentStep.target);
    if (!el) {
      // If target element is not present on this screen, center spotlight or skip
      setRect(null);
      setPopoverPos(null);
      return;
    }

    const r = el.getBoundingClientRect();
    setRect(r);

    // Scroll into view if needed
    if (r.top < 80 || r.bottom > window.innerHeight - 80) {
      el.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
        block: "center",
      });
    }

    // Compute popover position for desktop
    const popoverWidth = 380;
    const padding = 16;
    let left = r.left + r.width / 2 - popoverWidth / 2;
    left = Math.max(
      padding,
      Math.min(window.innerWidth - popoverWidth - padding, left),
    );

    let top = r.bottom + 12;
    if (top + 240 > window.innerHeight) {
      // Place above target
      top = Math.max(padding, r.top - 240);
    }

    setPopoverPos({ top, left });
  }, [active, stepIndex]);

  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => {
      updatePosition();
    }, 0);

    const handleResize = () => updatePosition();
    const handleScroll = () => updatePosition();

    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleScroll, true);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [active, updatePosition]);

  // Focus trap & keyboard navigation
  useEffect(() => {
    if (!active) return;

    popoverRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Tab") {
        const buttons =
          popoverRef.current?.querySelectorAll<HTMLButtonElement>("button");
        if (!buttons?.length) return;
        const first = buttons[0];
        const last = buttons[buttons.length - 1];
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === popoverRef.current)
        ) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        skipTour();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        if (stepIndex < STEPS.length - 1) {
          setStepIndex((i) => i + 1);
        } else {
          completeTour();
        }
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (stepIndex > 0) {
          setStepIndex((i) => i - 1);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [active, stepIndex, skipTour, completeTour]);

  if (!active) return null;

  const currentStep = STEPS[stepIndex];
  const isLast = stepIndex === STEPS.length - 1;

  return (
    <>
      <div className={styles.overlay} onClick={skipTour} aria-hidden="true" />
      {rect && (
        <div
          className={styles.spotlight}
          style={{
            top: `${Math.max(0, rect.top - 6)}px`,
            left: `${Math.max(0, rect.left - 6)}px`,
            width: `${rect.width + 12}px`,
            height: `${rect.height + 12}px`,
          }}
          aria-hidden="true"
        />
      )}
      <section
        ref={popoverRef}
        tabIndex={-1}
        className={styles.popover}
        style={
          popoverPos && window.innerWidth > 760
            ? {
                top: `${popoverPos.top}px`,
                left: `${popoverPos.left}px`,
              }
            : undefined
        }
        role="dialog"
        aria-modal="true"
        aria-label={t(currentStep.titleKey)}
      >
        <header className={styles.header}>
          <span className={styles.badge}>
            {t("stepCounter", { current: stepIndex + 1, total: STEPS.length })}
          </span>
          <button
            type="button"
            className={styles.closeButton}
            onClick={skipTour}
            aria-label={t("skip")}
          >
            <X size={16} />
          </button>
        </header>

        <div className={styles.content}>
          <h2 className={styles.title}>{t(currentStep.titleKey)}</h2>
          <p className={styles.description}>{t(currentStep.descKey)}</p>
        </div>

        <footer className={styles.footer}>
          <div className={styles.dots} aria-hidden="true">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`${styles.dot} ${i === stepIndex ? styles.dotActive : ""}`}
              />
            ))}
          </div>
          <div className={styles.actions}>
            {stepIndex > 0 && (
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => setStepIndex((i) => i - 1)}
              >
                <ChevronLeft size={14} /> {t("back")}
              </button>
            )}
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={() => {
                if (isLast) completeTour();
                else setStepIndex((i) => i + 1);
              }}
            >
              {isLast ? (
                <>
                  <Check size={14} /> {t("done")}
                </>
              ) : (
                <>
                  {t("next")} <ChevronRight size={14} />
                </>
              )}
            </button>
          </div>
        </footer>
      </section>
    </>
  );
}

/** Compatibility mount in the shell; replay now lives in Settings. */
export function TourTrigger(props: { className?: string }) {
  void props;
  return null;
}
