// SPDX-License-Identifier: AGPL-3.0-only
"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/src/i18n/navigation";
import { Avatar } from "@/src/components/avatar";
import styles from "./settings.module.css";
export function AvatarUpload({
  name,
  url,
}: {
  name: string;
  url: string | null;
}) {
  const t = useTranslations("settings");
  const router = useRouter();
  const canvas = useRef<HTMLCanvasElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [zoom, setZoom] = useState(1);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!file) return;
    let stopped = false;
    createImageBitmap(file)
      .then((image) => {
        if (stopped) {
          image.close();
          return;
        }
        const el = canvas.current;
        const ctx = el?.getContext("2d");
        if (ctx) {
          const edge = Math.min(image.width, image.height) / zoom;
          ctx.clearRect(0, 0, 256, 256);
          ctx.drawImage(
            image,
            (image.width - edge) / 2,
            (image.height - edge) / 2,
            edge,
            edge,
            0,
            0,
            256,
            256,
          );
          setReady(true);
        }
        image.close();
      })
      .catch(() => {
        if (!stopped) {
          setMessage(t("photoError"));
          setReady(false);
        }
      });
    return () => {
      stopped = true;
    };
  }, [file, zoom, t]);
  async function save(remove = false) {
    setBusy(true);
    setMessage("");
    try {
      let body: FormData | undefined;
      if (!remove) {
        const encode = (type: string) =>
          new Promise<Blob | null>((resolve) => {
            if (!canvas.current) return resolve(null);
            canvas.current.toBlob(resolve, type, 0.86);
          });
        let blob = await encode("image/webp");
        if (!blob || blob.type !== "image/webp")
          blob = await encode("image/jpeg");
        if (!blob || blob.size > 300 * 1024) throw Error();
        body = new FormData();
        body.set(
          "image",
          blob,
          blob.type === "image/webp" ? "avatar.webp" : "avatar.jpg",
        );
      }
      const result = await fetch("/api/avatars", {
        method: remove ? "DELETE" : "POST",
        body,
      });
      if (!result.ok) throw Error();
      setFile(null);
      setReady(false);
      if (input.current) input.current.value = "";
      setMessage(t("saved"));
      router.refresh();
    } catch {
      setMessage(t("photoError"));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="stack-sm">
      <label className="field">
        {t("photo")}
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={busy}
          onChange={(e) => {
            const selected = e.target.files?.[0];
            setReady(false);
            setMessage("");
            setZoom(1);
            if (selected && selected.size <= 10 * 1024 * 1024)
              setFile(selected);
            else {
              setFile(null);
              if (selected) setMessage(t("photoError"));
            }
          }}
        />
        <small>{t("photoHint")}</small>
      </label>
      <div className="row">
        {file ? (
          <canvas
            ref={canvas}
            width={256}
            height={256}
            className={styles.crop}
            aria-label={t("cropPreview")}
          />
        ) : (
          <Avatar name={name} src={url} size="lg" />
        )}
        {file && (
          <label className="field">
            {t("zoom")}
            <input
              type="range"
              min="1"
              max="3"
              step="0.05"
              value={zoom}
              disabled={busy}
              onChange={(e) => {
                setReady(false);
                setZoom(Number(e.target.value));
              }}
            />
          </label>
        )}
      </div>
      <div className="row">
        {file && (
          <>
            <button
              className="button"
              type="button"
              disabled={!ready || busy}
              onClick={() => void save()}
            >
              {t("savePhoto")}
            </button>
            <button
              type="button"
              className="button secondary"
              disabled={busy}
              onClick={() => {
                setFile(null);
                if (input.current) input.current.value = "";
              }}
            >
              {t("discardPhoto")}
            </button>
          </>
        )}
        {url && (
          <button
            className="button secondary"
            disabled={busy}
            type="button"
            onClick={() => void save(true)}
          >
            {t("removePhoto")}
          </button>
        )}
      </div>
      <p className="small muted" role="status">
        {message}
      </p>
    </div>
  );
}
