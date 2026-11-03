"use client";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Headphones, Volume2, VolumeX } from "lucide-react";
import type { SoundSettings } from "@/src/lib/db/json-types";
import { Dialog } from "@/src/components/ui/dialog";
import { Switch } from "@/src/components/ui/switch";
import { availableFileSounds, BackgroundSound, playChime } from "./audio";

type Kind = Exclude<SoundSettings["background"], "none">;

/** Grouped by what they are. */
const GROUPS: { key: "noise" | "nature" | "tones"; kinds: Kind[] }[] = [
  { key: "noise", kinds: ["white", "pink", "brown"] },
  {
    key: "nature",
    kinds: ["rain", "stream", "ocean", "wind", "fire", "night"],
  },
  { key: "tones", kinds: ["binaural"] },
];

export function SoundMenu({
  value,
  onChange,
  live = false,
}: {
  value: SoundSettings;
  onChange: (value: SoundSettings) => void;
  /** The background already plays (focus is running), so no preview is needed. */
  live?: boolean;
}) {
  const t = useTranslations("timer.sound");
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<"cafe"[]>([]);
  const preview = useRef<BackgroundSound | null>(null);
  const id = useId();
  useEffect(() => {
    if (open) void availableFileSounds().then(setFiles);
  }, [open]);

  // While the menu is open and focus isn't running, the chosen sound plays as a preview.
  useEffect(() => {
    preview.current ??= new BackgroundSound();
    if (open && !live)
      preview.current.play(value.background, value.backgroundVolume);
    else preview.current.stop();
  }, [open, live, value.background, value.backgroundVolume]);
  useEffect(() => () => preview.current?.stop(), []);

  const muted = !value.chime && value.background === "none";
  const groups = files.length
    ? [...GROUPS, { key: "places" as const, kinds: files as Kind[] }]
    : GROUPS;
  const pick = (background: SoundSettings["background"]) =>
    onChange({ ...value, background });
  return (
    <>
      <button className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>
        {muted ? (
          <VolumeX size={15} aria-hidden="true" />
        ) : (
          <Volume2 size={15} aria-hidden="true" />
        )}
        {t("title")}
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t("title")}
        labelledBy={`${id}-title`}
        wide
      >
        <fieldset className="field">
          <legend className="label mb-2">{t("background")}</legend>
          <button
            type="button"
            className="choice sound-none"
            aria-pressed={value.background === "none"}
            onClick={() => pick("none")}
          >
            <span className="choice-title">{t("kinds.none")}</span>
          </button>
          {groups.map((group) => (
            <div key={group.key} className="sound-group">
              <p className="sound-group-title">{t(`groups.${group.key}`)}</p>
              <div className="sound-grid">
                {group.kinds.map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    className="choice"
                    aria-pressed={value.background === kind}
                    onClick={() => pick(kind)}
                  >
                    <span className="choice-title">
                      {t(`kinds.${kind}`)}
                      {kind === "binaural" && (
                        <Headphones
                          size={14}
                          aria-hidden="true"
                          className="sound-headphones"
                        />
                      )}
                    </span>
                    <span className="choice-text">{t(`about.${kind}`)}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </fieldset>
        {value.background === "binaural" && (
          <p className="notice small">{t("headphones")}</p>
        )}
        <label className="field">
          <span className="label">{t("backgroundVolume")}</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={value.backgroundVolume}
            disabled={value.background === "none"}
            onChange={(e) =>
              onChange({ ...value, backgroundVolume: Number(e.target.value) })
            }
          />
        </label>
        <div className="flex items-center justify-between gap-3">
          <label htmlFor={`${id}-chime`} className="label">
            {t("chime")}
          </label>
          <Switch
            id={`${id}-chime`}
            label={t("chime")}
            checked={value.chime}
            onChange={(chime) => onChange({ ...value, chime })}
          />
        </div>
        <label className="field">
          <span className="label">{t("chimeVolume")}</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={value.chimeVolume}
            disabled={!value.chime}
            onChange={(e) =>
              onChange({ ...value, chimeVolume: Number(e.target.value) })
            }
            onPointerUp={() => playChime(value.chimeVolume)}
            onKeyUp={() => playChime(value.chimeVolume)}
          />
        </label>
        <p className="hint">{live ? t("hint") : t("previewHint")}</p>
        <p className="hint">{t("tip")}</p>
        <div className="dialog-actions">
          <button className="btn btn-primary" onClick={() => setOpen(false)}>
            {t("done")}
          </button>
        </div>
      </Dialog>
    </>
  );
}
