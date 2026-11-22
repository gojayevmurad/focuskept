// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/src/i18n/navigation";
import { track } from "@/src/lib/analytics/client";
import {
  SUPPORT_CATEGORIES,
  type SupportCategory,
} from "@/src/lib/support/validation";
import styles from "./contact.module.css";

export function ContactForm({
  initialName,
  initialEmail,
  locale,
}: {
  initialName: string;
  initialEmail: string;
  locale: string;
}) {
  const t = useTranslations("contact");
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [category, setCategory] = useState<SupportCategory>("question");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [hp, setHp] = useState("");
  const [consent, setConsent] = useState(false);
  const [pending, setPending] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consent) {
      setErrorKey("invalid");
      return;
    }

    setPending(true);
    setErrorKey(null);

    try {
      const pageUrl = typeof window !== "undefined" ? window.location.href : "";
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          category,
          subject,
          message,
          locale,
          pageUrl,
          hp,
        }),
      });

      if (res.status === 429) {
        setErrorKey("rateLimit");
        setPending(false);
        return;
      }

      if (!res.ok) {
        setErrorKey("failed");
        setPending(false);
        return;
      }

      // Track analytics event (category only, privacy by default)
      try {
        track("support_ticket_created" as unknown as never, { category });
      } catch {
        // Analytics tracking is optional.
      }

      setSubmittedEmail(email);
      setPending(false);
    } catch {
      setErrorKey("failed");
      setPending(false);
    }
  };

  if (submittedEmail) {
    return (
      <div className={styles.successCard}>
        <div className={styles.successIcon} aria-hidden="true">
          ✓
        </div>
        <h2>{t("successHeading")}</h2>
        <p>{t("successMessage", { email: submittedEmail })}</p>
        <div className={styles.responseNotice}>{t("expectedResponse")}</div>
        <div className="row" style={{ marginTop: 12 }}>
          <button
            type="button"
            className="button secondary"
            onClick={() => {
              setSubmittedEmail("");
              setSubject("");
              setMessage("");
              setConsent(false);
            }}
          >
            {t("sendAnother")}
          </button>
          <Link href="/help" className="button">
            Help center
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.formCard}>
      <form onSubmit={handleSubmit} className={styles.form}>
        {errorKey ? (
          <div className={styles.errorBanner} role="alert">
            {t(`errors.${errorKey}`)}
          </div>
        ) : null}

        {/* Honeypot field for bot prevention (hidden from view) */}
        <div className={styles.honeypot} aria-hidden="true">
          <label htmlFor="website-hp">Website</label>
          <input
            id="website-hp"
            type="text"
            name="hp"
            tabIndex={-1}
            autoComplete="off"
            value={hp}
            onChange={(e) => setHp(e.target.value)}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="contact-name">{t("name")}</label>
          <input
            id="contact-name"
            type="text"
            required
            className={styles.input}
            placeholder={t("namePlaceholder")}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="contact-email">{t("email")}</label>
          <input
            id="contact-email"
            type="email"
            required
            className={styles.input}
            placeholder={t("emailPlaceholder")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="contact-category">{t("category")}</label>
          <select
            id="contact-category"
            className={styles.select}
            value={category}
            onChange={(e) => setCategory(e.target.value as SupportCategory)}
          >
            {SUPPORT_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {t(`categories.${cat}`)}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label htmlFor="contact-subject">{t("subject")}</label>
          <input
            id="contact-subject"
            type="text"
            required
            minLength={3}
            maxLength={200}
            className={styles.input}
            placeholder={t("subjectPlaceholder")}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="contact-message">{t("message")}</label>
          <textarea
            id="contact-message"
            required
            minLength={10}
            maxLength={5000}
            className={styles.textarea}
            placeholder={t("messagePlaceholder")}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </div>

        <div className={styles.consentRow}>
          <input
            id="contact-consent"
            type="checkbox"
            required
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
          />
          <label htmlFor="contact-consent">
            {t.rich("consent", {
              privacy: (chunks) => <Link href="/privacy">{chunks}</Link>,
            })}
          </label>
        </div>

        <button
          type="submit"
          className={`button ${styles.submitBtn}`}
          disabled={pending}
        >
          {pending ? t("submitting") : t("submit")}
        </button>
      </form>
    </div>
  );
}
