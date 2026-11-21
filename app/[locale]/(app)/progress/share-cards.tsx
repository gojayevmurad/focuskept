"use client";
import { useTranslations } from "next-intl";
import { Download, Share2 } from "lucide-react";
import { track } from "@/src/lib/analytics/client";

export function ShareCards({ username }: { username: string }) {
  const t = useTranslations("progress");
  const cards = [
    { format: "story", label: t("story") },
    { format: "square", label: t("square") },
  ];
  async function share(format: string) {
    const url = `${location.origin}/api/share/${username}/${format}`;
    track("share_card_created", { format });
    try {
      const blob = await (await fetch(url)).blob();
      const file = new File([blob], `focus-${format}.png`, {
        type: "image/png",
      });
      if (navigator.canShare?.({ files: [file] }))
        return await navigator.share({ files: [file] });
    } catch {}
    window.open(url, "_blank", "noopener");
  }
  return (
    <div className="share-preview">
      {cards.map((c) => (
        <figure key={c.format} className="stack-sm" style={{ margin: 0 }}>
          {/* Generated on the server per request; next/image adds nothing here. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/share/${username}/${c.format}`}
            alt={c.label}
            loading="lazy"
          />
          <figcaption className="row">
            <button className="button small" onClick={() => share(c.format)}>
              <Share2 size={14} /> {t("shareButton")}
            </button>
            <a
              className="button secondary small"
              href={`/api/share/${username}/${c.format}`}
              download={`focus-${c.format}.png`}
              onClick={() => track("share_card_created", { format: c.format })}
            >
              <Download size={14} /> {c.label}
            </a>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
