// SPDX-License-Identifier: AGPL-3.0-only
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { LoaderCircle, Zap } from "lucide-react";
import { Link, useRouter } from "@/src/i18n/navigation";
import { useRealtime } from "@/src/lib/realtime/client";
import styles from "./match-now.module.css";

type Match = { id: string; status: "waiting" | "matched" | "cancelled" | "expired"; durationMin: number; sessionId: string | null; createdAt: string };
const ERRORS = ["limit", "overlap", "suspended", "rate_limited", "unauthorized", "duration", "unavailable", "self"] as const;

/** Drop into any signed-in page; owns its dialog, realtime subscription and polling. */
export function MatchNow({ className }: { className?: string }) {
  const t = useTranslations("matchNow");
  const c = useTranslations("common");
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [duration, setDuration] = useState<25 | 50>(25);
  const [request, setRequest] = useState<Match | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(0);
  const accept = useCallback((match: Match | null) => {
    setRequest(match);
    if (match?.status === "matched" && match.sessionId) router.push(`/session/${match.sessionId}`);
  }, [router]);
  const perform = useCallback(async (method: "GET" | "POST" | "DELETE", durationMin?: number) => {
    const response = await fetch("/api/match-now", {
      method, cache: "no-store",
      ...(method === "POST" ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ durationMin }) } : {}),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "unknown");
    accept(data.request);
  }, [accept]);
  const showError = (e: unknown) => {
    const code = e instanceof Error ? e.message : "unknown";
    setError(ERRORS.find((value) => value === code) ?? "unknown");
  };
  const refresh = useCallback(() => { void perform("GET").catch(showError); }, [perform]);
  useEffect(() => {
    if (request?.status !== "waiting") return;
    const poll = setInterval(refresh, 5000);
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearInterval(poll); clearInterval(clock); };
  }, [request?.status, refresh]);
  async function cancel() {
    if (busy) return;
    setBusy(true); setError("");
    try {
      if (request?.status === "waiting") await perform("DELETE");
      dialog.current?.close();
    } catch (e) { showError(e); }
    finally { setBusy(false); }
  }
  const waiting = request?.status === "waiting";
  const expired = request?.status === "expired";
  const elapsed = Math.max(0, Math.floor((now - new Date(request?.createdAt ?? now).getTime()) / 1000));
  return <>
    <button className={className ?? "button"} onClick={() => {
      dialog.current?.showModal(); setBusy(true); setError(""); setNow(Date.now());
      void perform("GET").catch(showError).finally(() => setBusy(false));
    }}><Zap size={17} aria-hidden="true" />{t("button")}</button>
    <dialog ref={dialog} className={styles.dialog} aria-labelledby="match-now-title" aria-describedby="match-now-description"
      onCancel={(e) => { e.preventDefault(); void cancel(); }}>
      <div className={styles.body}>
        <h2 id="match-now-title">{t(waiting ? "looking" : expired ? "expiredTitle" : "title")}</h2>
        <p id="match-now-description" className={styles.muted}>{t(waiting ? "waitingBody" : expired ? "expiredBody" : "lead")}</p>
        {waiting && <Waiting refresh={refresh} />}
        {waiting ? <div className={styles.elapsed}><LoaderCircle size={22} aria-hidden="true" /><span aria-label={t("elapsed")}>{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}</span><span className={styles.muted}>{c("minutes", { count: request.durationMin })}</span></div>
          : expired ? <Link href="/book" className="button" onClick={() => dialog.current?.close()}>{t("bookNext")}</Link>
          : <fieldset className={styles.duration}><legend>{t("duration")}</legend>{([25, 50] as const).map((value) => <label key={value}>
            <input type="radio" name="match-duration" value={value} checked={duration === value} onChange={() => setDuration(value)} disabled={busy} />{c("minutes", { count: value })}
          </label>)}</fieldset>}
        {error && <p className={styles.error} role="alert">{t(`errors.${error}`)}</p>}
        <div className={styles.actions}>
          <button className="button secondary" disabled={busy} onClick={() => void cancel()}>{c("cancel")}</button>
          {!waiting && <button className={expired ? "button secondary" : "button"} disabled={busy} onClick={async () => {
            setBusy(true); setError(""); setNow(Date.now());
            try { await perform("POST", duration); } catch (e) { showError(e); } finally { setBusy(false); }
          }}>{busy && <LoaderCircle size={16} aria-hidden="true" />}{t(expired ? "tryAgain" : "start")}</button>}
        </div>
      </div>
    </dialog>
  </>;
}
function Waiting({ refresh }: { refresh: () => void }) {
  useRealtime((message) => {
    // Always refetch our authenticated state; a delayed event can belong to a previous search.
    if (message.event === "match.found") refresh();
  }, { onReconnect: refresh });
  return null;
}
