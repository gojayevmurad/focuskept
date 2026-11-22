// SPDX-License-Identifier: AGPL-3.0-only
import styles from "./lanes.module.css";

export type PacePhase = "waiting" | "intro" | "focus" | "wrap" | "ended";

const R = 42;
const C = 2 * Math.PI * R;
const GAP = 0.012; // share of the ring left open between phases

/**
 * A swimming pace clock for one session: three arcs for intro, focus and
 * wrap-up, and a hand that sweeps once around for the whole session.
 * `focusFrom` and `wrapFrom` are shares of the session (0..1).
 */
export function PaceClock({
  progress,
  focusFrom,
  wrapFrom,
  phase,
  size = 56,
  label,
  className,
}: {
  progress: number;
  focusFrom: number;
  wrapFrom: number;
  phase: PacePhase;
  size?: number;
  /** Accessible description, e.g. "Focus, 18 minutes left". */
  label?: string;
  className?: string;
}) {
  const p = Math.min(1, Math.max(0, progress));
  const arcs: { key: PacePhase; from: number; to: number }[] = [
    { key: "intro", from: 0, to: focusFrom },
    { key: "focus", from: focusFrom, to: wrapFrom },
    { key: "wrap", from: wrapFrom, to: 1 },
  ];
  const angle = p * 360;
  return (
    <svg
      className={[styles.clock, className].filter(Boolean).join(" ")}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      data-phase={phase}
    >
      <circle className={styles.face} cx="50" cy="50" r={R} />
      {arcs.map((a) => {
        const start = a.from + (a.from > 0 ? GAP / 2 : 0);
        const end = a.to - (a.to < 1 ? GAP / 2 : 0);
        const len = Math.max(0, end - start) * C;
        const done = Math.max(0, Math.min(end, p) - start) * C;
        return (
          <g key={a.key} transform={`rotate(${start * 360 - 90} 50 50)`}>
            <circle
              className={styles.track}
              data-active={phase === a.key || undefined}
              cx="50"
              cy="50"
              r={R}
              strokeDasharray={`${len} ${C}`}
            />
            {done > 0 && (
              <circle
                className={styles.fill}
                data-part={a.key}
                cx="50"
                cy="50"
                r={R}
                strokeDasharray={`${done} ${C}`}
              />
            )}
          </g>
        );
      })}
      {[0, 0.25, 0.5, 0.75].map((t) => (
        <line
          key={t}
          className={styles.tick}
          x1="50"
          y1="14"
          x2="50"
          y2="19"
          transform={`rotate(${t * 360} 50 50)`}
        />
      ))}
      <g className={styles.hand} style={{ transform: `rotate(${angle}deg)` }}>
        <line x1="50" y1="50" x2="50" y2="16" />
        <circle cx="50" cy="50" r="4" />
      </g>
    </svg>
  );
}
