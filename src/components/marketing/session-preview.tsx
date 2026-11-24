// SPDX-License-Identifier: AGPL-3.0-only
import { Check, MicOff, Video } from "lucide-react";
import { Avatar } from "@/src/components/avatar";
import { LaneRope, PaceClock } from "@/src/components/lanes";
import styles from "./session-preview.module.css";

export function SessionPreview({
  copy,
}: {
  copy: {
    label: string;
    example: string;
    focus: string;
    timer: string;
    note: string;
    partner: string;
    you: string;
    goals: string;
    partnerGoal: string;
    yourGoal: string;
    duration: string;
  };
}) {
  return (
    <section className={styles.preview} aria-label={copy.label}>
      <div className={styles.header}>
        <span>{copy.example}</span>
        <span className={styles.duration}>{copy.duration}</span>
      </div>
      <div className={styles.stage}>
        <div className={styles.partner}>
          <div className={styles.partnerAvatar}>
            <Avatar name={copy.partner} size="lg" />
          </div>
          <strong>{copy.partner}</strong>
          <span>
            <Video size={14} aria-hidden="true" />
            {copy.focus}
          </span>
        </div>
        <div className={styles.self}>
          <Avatar name={copy.you} />
          <span>{copy.you}</span>
          <MicOff size={14} aria-hidden="true" />
        </div>
      </div>
      <LaneRope className={styles.rope} />
      <div className={styles.pace}>
        <PaceClock
          progress={0.154}
          focusFrom={3 / 50}
          wrapFrom={47 / 50}
          phase="focus"
          size={72}
        />
        <div>
          <span>{copy.timer}</span>
          <strong className={styles.timer}>42:18</strong>
        </div>
        <span className={styles.focus}>
          <Check size={14} aria-hidden="true" />
          {copy.focus}
        </span>
      </div>
      <div className={styles.goals}>
        <h3>{copy.goals}</h3>
        <div>
          <span>{copy.partner}</span>
          <p>{copy.partnerGoal}</p>
        </div>
        <div>
          <span>{copy.you}</span>
          <p>{copy.yourGoal}</p>
        </div>
      </div>
      <p className={styles.note}>{copy.note}</p>
    </section>
  );
}
