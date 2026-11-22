// SPDX-License-Identifier: AGPL-3.0-only
"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Copy,
  Check,
  Share2,
  Mail,
  MessageCircle,
} from "lucide-react";
import { track } from "@/src/lib/analytics/client";
import styles from "./invite.module.css";

type Props = {
  baseUrl: string;
  referralCode: string;
};

export function InviteShare({ baseUrl, referralCode }: Props) {
  const t = useTranslations("invite");
  const common = useTranslations("common");
  const [copied, setCopied] = useState(false);

  const buildUrl = (source: string) => {
    const url = new URL(`/r/${referralCode}`, baseUrl);
    url.searchParams.set("utm_source", source);
    url.searchParams.set("utm_medium", "referral");
    url.searchParams.set("utm_campaign", "invite");
    return url.toString();
  };

  const copyUrl = buildUrl("copy_link");
  const shareText = t("shareMessage");
  const shareTitle = "FocusKept";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(copyUrl);
      setCopied(true);
      track("referral_sent");
      setTimeout(() => setCopied(false), 2500);
    } catch {}
  };

  const handleNativeShare = async () => {
    const nativeUrl = buildUrl("native_share");
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: nativeUrl,
        });
        track("referral_sent");
      } catch {}
    }
  };

  const hasNativeShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  const xUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    shareText,
  )}&url=${encodeURIComponent(buildUrl("twitter"))}`;

  const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
    buildUrl("linkedin"),
  )}`;

  const whatsAppUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(
    `${shareText} ${buildUrl("whatsapp")}`,
  )}`;

  const emailSubject = t("emailSubject");
  const emailBody = `${t("emailBody")} ${buildUrl("email")}`;
  const emailMailto = `mailto:?subject=${encodeURIComponent(
    emailSubject,
  )}&body=${encodeURIComponent(emailBody)}`;

  return (
    <div className={styles.shareBlock}>
      <div className={styles.copyRow}>
        <input
          className="input grow mono small"
          readOnly
          value={copyUrl}
          onFocus={(e) => e.currentTarget.select()}
          aria-label={t("yourLink")}
        />
        <button
          className={`button ${copied ? "ok" : "secondary"}`}
          onClick={handleCopy}
          type="button"
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
          <span>{copied ? common("copied") : common("copy")}</span>
        </button>
      </div>

      {copied && (
        <p className={styles.copiedFeedback} role="status">
          {t("copiedFeedback")}
        </p>
      )}

      <div className={styles.shareButtons}>
        {hasNativeShare && (
          <button
            className="button secondary"
            onClick={handleNativeShare}
            type="button"
          >
            <Share2 size={16} />
            <span>{t("shareNative")}</span>
          </button>
        )}
        <a
          href={whatsAppUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="button secondary"
          onClick={() => track("referral_sent")}
        >
          <MessageCircle size={16} />
          <span>{t("shareWhatsApp")}</span>
        </a>
        <a
          href={xUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="button secondary"
          onClick={() => track("referral_sent")}
        >
          <span className={styles.brandIcon}>𝕏</span>
          <span>{t("shareX")}</span>
        </a>
        <a
          href={linkedInUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="button secondary"
          onClick={() => track("referral_sent")}
        >
          <span className={styles.brandIcon}>in</span>
          <span>{t("shareLinkedIn")}</span>
        </a>
        <a
          href={emailMailto}
          className="button secondary"
          onClick={() => track("referral_sent")}
        >
          <Mail size={16} />
          <span>{t("shareEmail")}</span>
        </a>
      </div>
    </div>
  );
}
