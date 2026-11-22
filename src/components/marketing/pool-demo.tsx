// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createTranslator } from "next-intl";
import { Mic, MicOff, Pause, Play, Video } from "lucide-react";
import { LaneRope, PaceClock } from "@/src/components/lanes";
import { Link } from "@/src/i18n/navigation";
import styles from "./marketing.module.css";

const FOCUS_FROM = 3 / 50;
const WRAP_FROM = 47 / 50;
const RESTING_PROGRESS = 1 - (42 * 60 + 18) / (50 * 60);
const DEMO_MS = 12_000;

export function BookingLink({
  label,
  nextLabel,
  locale,
  cutoffMinutes,
  slotMinutes,
}: {
  label: string;
  nextLabel: string;
  locale: string;
  cutoffMinutes: number;
  slotMinutes: number;
}) {
  const [next, setNext] = useState<Date | null>(null);
  const t = useMemo(
    () => createTranslator({ locale, messages: { next: nextLabel } }),
    [locale, nextLabel],
  );

  useEffect(() => {
    const update = () => {
      const slotMs = slotMinutes * 60_000;
      const earliest = Date.now() + cutoffMinutes * 60_000;
      const start = Math.ceil(earliest / slotMs) * slotMs;
      setNext((current) =>
        current?.getTime() === start ? current : new Date(start),
      );
    };
    const frame = requestAnimationFrame(update);
    const interval = window.setInterval(update, 1_000);
    return () => {
      cancelAnimationFrame(frame);
      window.clearInterval(interval);
    };
  }, [cutoffMinutes, slotMinutes]);

  return (
    <Link href="/sign-up" className={`button ${styles.bookingButton}`}>
      {next
        ? t("next", {
            time: new Intl.DateTimeFormat(undefined, {
              hour: "numeric",
              minute: "2-digit",
            }).format(next),
          })
        : label}
    </Link>
  );
}

type DemoCopy = {
  label: string;
  example: string;
  note: string;
  timer: string;
  minutesLeft: string;
  pause: string;
  resume: string;
  intro: string;
  focus: string;
  wrap: string;
  preview: string;
  people: { name: string; goal: string }[];
};

export function PoolDemo({ copy, locale }: { copy: DemoCopy; locale: string }) {
  const [demo, setDemo] = useState({
    progress: RESTING_PROGRESS,
    running: false,
  });
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const t = useMemo(
    () => createTranslator({ locale, messages: { left: copy.minutesLeft } }),
    [locale, copy.minutesLeft],
  );

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (motion.matches) return;
    let frame = 0;
    let elapsed = 0;
    let last = 0;
    let renderedAt = -100;
    const tick = (now: number) => {
      if (last && !pausedRef.current) elapsed += now - last;
      last = now;
      if (elapsed >= DEMO_MS) {
        setDemo({ progress: RESTING_PROGRESS, running: false });
        return;
      }
      if (!pausedRef.current && now - renderedAt >= 100) {
        setDemo({ progress: elapsed / DEMO_MS, running: true });
        renderedAt = now;
      }
      frame = requestAnimationFrame(tick);
    };
    const stop = () => {
      if (!motion.matches) return;
      cancelAnimationFrame(frame);
      setDemo({ progress: RESTING_PROGRESS, running: false });
    };
    frame = requestAnimationFrame(tick);
    motion.addEventListener("change", stop);
    return () => {
      cancelAnimationFrame(frame);
      motion.removeEventListener("change", stop);
    };
  }, []);

  const phase =
    demo.progress < FOCUS_FROM
      ? "intro"
      : demo.progress >= WRAP_FROM
        ? "wrap"
        : "focus";
  const seconds = Math.ceil((1 - demo.progress) * 50 * 60);
  const number = new Intl.NumberFormat(locale, { minimumIntegerDigits: 2 });
  const remaining = `${number.format(Math.floor(seconds / 60))}:${number.format(seconds % 60)}`;
  const MicIcon = phase === "focus" ? MicOff : Mic;

  return (
    <section className={styles.demo} aria-label={copy.label}>
      <div className={styles.demoHeader}>
        <span className={styles.example}>{copy.example}</span>
        <span className={styles.preview}>{copy.preview}</span>
      </div>
      <div className={styles.pace}>
        <PaceClock
          progress={demo.progress}
          focusFrom={FOCUS_FROM}
          wrapFrom={WRAP_FROM}
          phase={phase}
          size={148}
          label={`${copy[phase]}, ${t("left", { count: Math.ceil(seconds / 60) })}`}
          className={styles.demoClock}
        />
        <div className={styles.paceReading}>
          <span className={styles.phase} data-phase={phase}>
            {copy[phase]}
          </span>
          <span className={styles.demoTime} aria-label={copy.timer}>
            {remaining}
          </span>
        </div>
      </div>
      <div className={styles.poolLanes}>
        {copy.people.map((person, index) => (
          <div className={styles.personLane} key={person.name}>
            <span className={styles.laneNumber} aria-hidden="true">
              {String(index + 1).padStart(2, "0")}
            </span>
            <div className={styles.person}>
              <span className={styles.personName}>{person.name}</span>
              <p>{person.goal}</p>
            </div>
            <div className={styles.mediaIcons} aria-hidden="true">
              <Video size={16} />
              <MicIcon size={16} />
            </div>
            {index === 0 && <LaneRope className={styles.partnerRope} />}
          </div>
        ))}
      </div>
      <div className={styles.demoFooter}>
        <p>{copy.note}</p>
        {demo.running && (
          <button
            type="button"
            className={styles.demoControl}
            aria-label={paused ? copy.resume : copy.pause}
            onClick={() => {
              pausedRef.current = !pausedRef.current;
              setPaused(pausedRef.current);
            }}
          >
            {paused ? <Play size={17} /> : <Pause size={17} />}
          </button>
        )}
      </div>
    </section>
  );
}
