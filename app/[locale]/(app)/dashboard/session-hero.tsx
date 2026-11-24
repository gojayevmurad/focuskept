// SPDX-License-Identifier: AGPL-3.0-only
"use client";
import { useEffect, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { useRouter, Link } from "@/src/i18n/navigation";
import { Avatar } from "@/src/components/avatar";
import { MatchNow } from "@/src/components/match-now";
import { dashboardState, type HeroBooking } from "./state";
import styles from "./dashboard.module.css";
export function SessionHero({
  bookings,
  now: initial,
  tz,
}: {
  bookings: HeroBooking[];
  now: number;
  tz: string;
}) {
  const [now, setNow] = useState(initial);
  const t = useTranslations("dashboard");
  const c = useTranslations("common");
  const format = useFormatter();
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    const refresh = setInterval(() => router.refresh(), 30000);
    return () => {
      clearInterval(timer);
      clearInterval(refresh);
    };
  }, [router]);
  const { booking: b, mode } = dashboardState(bookings, 0, now);
  const seconds = b
    ? Math.max(0, Math.ceil((Date.parse(b.startAt) - now) / 1000))
    : 0;
  return (
    <section className={styles.hero} data-tour="upcoming">
      <div className={styles.heroContent}>
        <h2 className={mode === "soon" ? styles.countdown : undefined}>
          {mode === "none"
            ? t("noBooking")
            : mode === "live"
              ? t("liveNow")
              : mode === "soon"
                ? t("startsIn", {
                    time: `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`,
                  })
                : t("nextSession")}
        </h2>
        {b ? (
          <>
            <p className={styles.when}>
              {format.dateTime(new Date(b.startAt), {
                timeZone: tz,
                weekday: "long",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}{" "}
              · {c("minutes", { count: b.durationMin })}
            </p>
            <div className="row">
              {b.partner ? (
                <>
                  <Avatar
                    name={b.partner.name}
                    src={b.partner.avatar}
                    size="lg"
                  />
                  <div>
                    <strong>{b.partner.name}</strong>
                    {b.partner.goal && (
                      <p className="muted small">{b.partner.goal}</p>
                    )}
                  </div>
                </>
              ) : (
                <p className="muted">{t("pairing")}</p>
              )}
            </div>
          </>
        ) : (
          <p className="muted">{t("noBookingLead")}</p>
        )}
      </div>
      <div className={styles.actions}>
        {b ? (
          <>
            {(mode === "live" || mode === "soon") &&
              (b.sessionId ? (
                <Link className="button" href={`/session/${b.sessionId}`}>
                  {t("joinNow")}
                </Link>
              ) : (
                <div className={styles.preparing}>
                  <button className="button" disabled>
                    {t("joinNow")}
                  </button>
                  <p className="small muted" role="status">
                    {t("roomPreparing")}
                  </p>
                </div>
              ))}
            <Link
              className={mode === "upcoming" ? "button" : "button secondary"}
              href={`/book?start=${encodeURIComponent(b.startAt)}`}
            >
              {t("manage")}
            </Link>
          </>
        ) : (
          <>
            <Link className="button" href="/book">
              {t("bookSession")}
            </Link>
            <MatchNow className="button secondary" />
          </>
        )}
      </div>
    </section>
  );
}
