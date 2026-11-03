"use client";
import { useTranslations } from "next-intl";
import type { TimerDurations } from "@/src/lib/db/json-types";
import type { DurationLimits } from "@/src/features/timer/limits";

export function DurationFields({
  value,
  limits,
  onChange,
}: {
  value: TimerDurations;
  limits: DurationLimits;
  onChange: (value: TimerDurations) => void;
}) {
  const t = useTranslations("focus.setup.durations");
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {(["work", "shortBreak", "longBreak", "cycles"] as const).map((key) => (
        <label key={key} className="field">
          <span className="label tiny">{t(key)}</span>
          <input
            className="input tabular"
            type="number"
            inputMode="numeric"
            min={limits[key].min}
            max={limits[key].max}
            value={value[key]}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n)) onChange({ ...value, [key]: n });
            }}
            onBlur={(e) => {
              const n = Math.min(
                limits[key].max,
                Math.max(
                  limits[key].min,
                  Math.round(Number(e.target.value) || limits[key].min),
                ),
              );
              onChange({ ...value, [key]: n });
            }}
          />
        </label>
      ))}
    </div>
  );
}
