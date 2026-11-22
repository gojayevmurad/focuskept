// SPDX-License-Identifier: AGPL-3.0-only
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import {
  Mic,
  MicOff,
  PhoneOff,
  Flag,
  Star,
  Video as VideoIcon,
  CheckCircle2,
  CircleDashed,
  XCircle,
  LoaderCircle,
} from "lucide-react";
import { Link, useRouter } from "@/src/i18n/navigation";
import { useRealtime } from "@/src/lib/realtime/client";
import type { RoomState } from "@/src/lib/sessions/lifecycle";
import type {
  QualityStats,
  VideoClient,
  VideoProviderName,
} from "@/src/lib/video/types";
import { createVideoClient } from "@/src/lib/video/client";
import { getLocalMedia, LocalMediaError } from "@/src/lib/video/client/media";
import { Avatar } from "@/src/components/avatar";
import { LogoMark } from "@/src/components/logo";
import { PaceClock, LaneRope } from "@/src/components/lanes";
import styles from "./room.module.css";
import { toggleFavorite } from "../../(app)/people/actions";

type Phase = "waiting" | "intro" | "focus" | "wrap" | "ended";
type Outcome = "done" | "partial" | "not_done";

function phaseLengths(duration: number) {
  return duration <= 25 ? { intro: 2, wrap: 2 } : { intro: 3, wrap: 3 };
}

function computePhase(
  startMs: number,
  duration: number,
  now: number,
  overrides: { focusAt?: string | null; wrapAt?: string | null } = {},
): {
  phase: Phase;
  remainingMs: number;
  progress: number;
  focusFrom: number;
  wrapFrom: number;
} {
  const end = startMs + duration * 60_000;
  const { intro, wrap } = phaseLengths(duration);
  // A host can start focus or wrap-up early.
  const focusFrom = overrides.focusAt
    ? new Date(overrides.focusAt).getTime()
    : startMs + intro * 60_000;
  const wrapFrom = overrides.wrapAt
    ? new Date(overrides.wrapAt).getTime()
    : end - wrap * 60_000;
  const shares = {
    focusFrom: Math.max(
      0,
      Math.min(1, (focusFrom - startMs) / (end - startMs)),
    ),
    wrapFrom: Math.max(0, Math.min(1, (wrapFrom - startMs) / (end - startMs))),
  };
  if (now < startMs)
    return {
      ...shares,
      phase: "waiting",
      remainingMs: startMs - now,
      progress: 0,
    };
  if (now >= end)
    return { ...shares, phase: "ended", remainingMs: 0, progress: 1 };
  const progress = (now - startMs) / (duration * 60_000);
  if (now >= wrapFrom)
    return { ...shares, phase: "wrap", remainingMs: end - now, progress };
  if (now < focusFrom)
    return { ...shares, phase: "intro", remainingMs: end - now, progress };
  return { ...shares, phase: "focus", remainingMs: end - now, progress };
}

function clock(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h ? `${h}:` : ""}${String(m).padStart(h ? 2 : 1, "0")}:${String(s).padStart(2, "0")}`;
}

/** Short generated tones; no audio files to license or download. */
function chime(kind: "start" | "end") {
  try {
    const ctx = new AudioContext();
    const notes = kind === "start" ? [523.25, 659.25] : [659.25, 523.25, 392];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const t0 = ctx.currentTime + i * 0.22;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.18, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.6);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.65);
    });
    setTimeout(() => ctx.close(), 2000);
  } catch {}
}

async function post(path: string, body?: unknown) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  if (!response.ok) throw new Error(String(response.status));
  return response.json().catch(() => ({}));
}

export function Room(props: {
  initial: RoomState;
  appName: string;
  provider: VideoProviderName;
  microphoneDefault: boolean;
  timeZone: string;
  canFavorite: boolean;
  favorites: string[];
}) {
  const t = useTranslations("room");
  const c = useTranslations("common");
  const format = useFormatter();
  const router = useRouter();
  const [state, setState] = useState(props.initial);
  const [offset, setOffset] = useState(
    () => new Date(props.initial.serverTime).getTime() - Date.now(),
  );
  const [now, setNow] = useState(() => Date.now());
  const [joined, setJoined] = useState(false);
  const [joining, setJoining] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [mediaReady, setMediaReady] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [micOn, setMicOn] = useState(props.microphoneDefault);
  const [goal, setGoal] = useState(
    props.initial.participants.find((p) => p.userId === props.initial.me)
      ?.goalText ?? "",
  );
  const [goalSaved, setGoalSaved] = useState(Boolean(goal));
  const [outcome, setOutcome] = useState<Outcome | null>(
    (props.initial.participants.find((p) => p.userId === props.initial.me)
      ?.outcome as Outcome | null) ?? null,
  );
  const [remote, setRemote] = useState<Record<string, MediaStream>>({});
  const [quality, setQuality] = useState<"good" | "reduced">("good");
  const [reportFor, setReportFor] = useState<string | null>(null);
  const [favorites, setFavorites] = useState(props.favorites);
  const [left, setLeft] = useState(false);
  const [blockedNotice, setBlockedNotice] = useState(false);

  const client = useRef<VideoClient | null>(null);
  const localStream = useRef<MediaStream | null>(null);
  const localVideo = useRef<HTMLVideoElement>(null);
  const subscribed = useRef(new Map<string, string>());
  const lastStats = useRef<QualityStats>({});
  const lastPhase = useRef<Phase | null>(null);
  const manualMic = useRef(false);
  const reportDialog = useRef<HTMLDialogElement>(null);
  const rejoins = useRef(0);
  const joinedRef = useRef(false);

  const startMs = new Date(state.session.startAt).getTime();
  const serverNow = now + offset;
  const { phase, remainingMs, progress, focusFrom, wrapFrom } = computePhase(
    startMs,
    state.session.durationMin,
    serverNow,
    { focusAt: state.session.focusAt, wrapAt: state.session.wrapAt },
  );
  const isHost = state.session.hostId === state.me;
  const me = state.participants.find((p) => p.userId === state.me);
  const others = state.participants.filter((p) => p.userId !== state.me);
  const group = state.session.type === "group";

  const refresh = useCallback(async () => {
    const response = await fetch(`/api/sessions/${state.session.id}/state`, {
      cache: "no-store",
    });
    if (!response.ok) return;
    const next = (await response.json()) as RoomState;
    setOffset(new Date(next.serverTime).getTime() - Date.now());
    setState(next);
  }, [state.session.id]);

  useRealtime(
    (message) => {
      if (message.topic !== `session:${state.session.id}`) return;
      void refresh();
    },
    { sessionId: state.session.id, onReconnect: () => void refresh() },
  );

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, []);

  // Local preview before joining. Runs once: the timer re-renders twice a second.
  const mediaMessages = useRef({
    denied: t("media.denied"),
    not_found: t("media.not_found"),
    in_use: t("media.in_use"),
    unknown: t("media.unknown"),
  });
  useEffect(() => {
    let cancelled = false;
    getLocalMedia({ audio: true })
      .then((stream) => {
        if (cancelled) return stream.getTracks().forEach((tr) => tr.stop());
        localStream.current = stream;
        if (localVideo.current) localVideo.current.srcObject = stream;
        setMediaReady(true);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const messages = mediaMessages.current;
        setMediaError(
          error instanceof LocalMediaError
            ? messages[error.code]
            : messages.unknown,
        );
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (localVideo.current && localStream.current)
      localVideo.current.srcObject = localStream.current;
  }, [joined]);

  const applyMic = useCallback(async (on: boolean) => {
    setMicOn(on);
    await client.current?.setMicrophone(on).catch(() => {});
  }, []);

  const finish = useCallback(async () => {
    joinedRef.current = false;
    const stats = lastStats.current;
    const summary = Object.fromEntries(
      Object.entries(stats).filter(
        ([, v]) => typeof v === "number" || typeof v === "boolean",
      ),
    ) as Record<string, number | boolean>;
    summary.quality_reduced = quality === "reduced";
    if (client.current)
      void post(`/api/sessions/${state.session.id}/quality`, summary).catch(
        () => {},
      );
    await client.current?.leave().catch(() => {});
    client.current = null;
    localStream.current?.getTracks().forEach((tr) => tr.stop());
    void post(`/api/sessions/${state.session.id}/leave`).catch(() => {});
  }, [quality, state.session.id]);

  // Phase changes: chimes, and the mic follows the session rhythm unless the person set it themselves.
  useEffect(() => {
    if (!joined || lastPhase.current === phase) return;
    const previous = lastPhase.current;
    lastPhase.current = phase;
    if (previous === null) return;
    if (phase === "focus") {
      chime("start");
      if (!manualMic.current) void applyMic(false);
    }
    if (phase === "wrap") chime("end");
    if (phase === "ended") {
      chime("end");
      void finish();
    }
    // applyMic/finish are stable enough for this transition-only effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, joined]);

  async function join() {
    if (!localStream.current) return;
    setJoining(true);
    setVideoError(null);
    try {
      await post(`/api/sessions/${state.session.id}/join`);
      const credentials = await post(`/api/video/join/${state.session.id}`);
      const video = await createVideoClient(credentials);
      client.current = video;
      video.on("remote", (userId, stream) =>
        setRemote((prev) => {
          const next = { ...prev };
          if (stream) next[userId] = stream;
          else delete next[userId];
          return next;
        }),
      );
      video.on("quality", setQuality);
      video.on("connection", async (connState) => {
        if (connState !== "failed" || !joinedRef.current) return;
        joinedRef.current = false;
        setJoined(false);
        subscribed.current.clear();
        setRemote({});
        await video.leave().catch(() => {});
        if (client.current === video) client.current = null;
        if (rejoins.current < 2) {
          rejoins.current += 1;
          await join();
        } else {
          setVideoError(t("videoFailed"));
        }
      });
      await video.publishTracks(localStream.current, {
        audio: true,
        video: true,
        simulcast: group,
      });
      const startOn = phase === "focus" ? false : props.microphoneDefault;
      await applyMic(startOn);
      lastPhase.current = phase;
      joinedRef.current = true;
      setJoined(true);
      await refresh();
    } catch {
      joinedRef.current = false;
      setJoined(false);
      setVideoError(t("videoFailed"));
    } finally {
      setJoining(false);
    }
  }

  // Pull partner media as their tracks appear.
  useEffect(() => {
    const video = client.current;
    if (!joined || !video) return;
    for (const p of others) {
      const key = JSON.stringify(p.tracks ?? {});
      const has = p.tracks && (p.tracks.audio || p.tracks.video);
      if (!p.present || !has) {
        if (subscribed.current.has(p.userId)) {
          subscribed.current.delete(p.userId);
          void video.unsubscribe(p.userId).catch(() => {});
        }
        continue;
      }
      if (subscribed.current.get(p.userId) === key) continue;
      subscribed.current.set(p.userId, key);
      void video
        .subscribe(
          { userId: p.userId, displayName: p.displayName, tracks: p.tracks },
          { lowQuality: group && others.length > 2 },
        )
        .catch(() => subscribed.current.delete(p.userId));
    }
  }, [joined, others, group]);

  // Save bandwidth while the tab is hidden.
  useEffect(() => {
    const onVisibility = () =>
      void client.current
        ?.setRemoteVideo(document.visibilityState === "visible")
        .catch(() => {});
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    if (!joined) return;
    const timer = setInterval(async () => {
      const stats = await client.current?.getStats().catch(() => null);
      if (stats && Object.keys(stats).length) lastStats.current = stats;
    }, 15_000);
    return () => clearInterval(timer);
  }, [joined]);

  useEffect(() => {
    const onUnload = () =>
      navigator.sendBeacon?.(`/api/sessions/${state.session.id}/leave`);
    window.addEventListener("pagehide", onUnload);
    return () => {
      window.removeEventListener("pagehide", onUnload);
      void client.current?.leave().catch(() => {});
      localStream.current?.getTracks().forEach((tr) => tr.stop());
    };
  }, [state.session.id]);

  async function saveGoal() {
    if (!goal.trim()) return;
    await post(`/api/sessions/${state.session.id}/goal`, { text: goal }).catch(
      () => {},
    );
    setGoalSaved(true);
  }
  async function chooseOutcome(value: Outcome) {
    setOutcome(value);
    await post(`/api/sessions/${state.session.id}/outcome`, {
      outcome: value,
    }).catch(() => {});
  }
  async function leave() {
    joinedRef.current = false;
    await finish();
    setLeft(true);
  }

  useEffect(() => {
    if (reportFor) reportDialog.current?.showModal();
    else reportDialog.current?.close();
  }, [reportFor]);

  const phaseLabel = t(`phase.${phase}`);

  if (phase === "ended" || left || state.window === "over") {
    return (
      <Summary
        focusFrom={focusFrom}
        wrapFrom={wrapFrom}
        blocked={blockedNotice}
        state={state}
        outcome={outcome}
        onOutcome={chooseOutcome}
        canFavorite={props.canFavorite}
        favorites={favorites}
        onFavorite={async (userId) => {
          const result = await toggleFavorite(userId);
          if (result.ok)
            setFavorites(
              result.favorite
                ? [...favorites, userId]
                : favorites.filter((f) => f !== userId),
            );
        }}
        onReport={setReportFor}
        reportDialog={
          <ReportDialog
            dialogRef={reportDialog}
            targetId={reportFor}
            sessionId={state.session.id}
            onClose={() => setReportFor(null)}
          />
        }
      />
    );
  }

  return (
    <div className={styles.room}>
      <header className={styles.top}>
        <div className={styles.sessionTitle}>
          <LogoMark size={22} />
          <div className={styles.stackSmall}>
            <strong>
              {state.session.title ??
                (group ? t("groupTitle") : t("pairTitle"))}
            </strong>
            <span className={styles.meta}>
              {format.dateTime(new Date(state.session.startAt), {
                timeZone: props.timeZone,
                hour: "numeric",
                minute: "2-digit",
              })}{" "}
              · {c("minutes", { count: state.session.durationMin })}
            </span>
          </div>
          {quality === "reduced" && (
            <span className={styles.badge} role="status">
              {t("lowBandwidth")}
            </span>
          )}
        </div>
        <div className={styles.pace}>
          <PaceClock
            progress={progress}
            focusFrom={focusFrom}
            wrapFrom={wrapFrom}
            phase={phase}
            size={100}
            label={`${phaseLabel}, ${clock(remainingMs)}`}
            className={styles.clock}
          />
          <div className={styles.phaseCopy}>
            <span
              className={styles.phase}
              data-phase={phase}
              aria-live="polite"
            >
              {phaseLabel}
            </span>
            <span className={styles.timer} aria-live="off">
              {clock(remainingMs)}
            </span>
          </div>
          <div className={styles.guidance}>
            <strong>{t(`tips.${phase}`)}</strong>
            <p>{t(`tipsBody.${phase}`)}</p>
          </div>
        </div>
      </header>

      <main className={styles.stage}>
        <div className={`${styles.tiles} ${group ? styles.group : ""}`}>
          <div className={styles.lane}>
            <LaneRope vertical className={styles.ropeDesktop} />
            <LaneRope className={styles.ropeMobile} />
            <div className={styles.media}>
              <video
                ref={localVideo}
                autoPlay
                playsInline
                muted
                className={styles.mirror}
              />
              {mediaError && <div className={styles.empty}>{mediaError}</div>}
            </div>
            <div className={styles.tileLabel}>
              <span className={styles.tileName}>
                {c("you")} {!micOn && <MicOff size={12} />}
              </span>
              {me?.goalText && (
                <span className={`tile-goal ${styles.goal}`}>
                  {me.goalText}
                </span>
              )}
            </div>
          </div>
          {others.length === 0 && (
            <div className={styles.lane}>
              <LaneRope vertical className={styles.ropeDesktop} />
              <LaneRope className={styles.ropeMobile} />
              <div className={styles.media}>
                <div className={styles.empty}>{t("aloneInRoom")}</div>
              </div>
            </div>
          )}
          {others.map((p) => (
            <RemoteTile
              key={p.userId}
              name={p.displayName}
              avatarUrl={p.avatarUrl}
              goal={p.goalText}
              present={p.present}
              stream={remote[p.userId]}
              hint={
                !joined
                  ? t("joinToSee")
                  : props.provider === "none"
                    ? t("noVideoProvider")
                    : p.present
                      ? t("connecting")
                      : t("notHereYet")
              }
              isHost={p.userId === state.session.hostId}
              hostLabel={t("host")}
            />
          ))}
        </div>
      </main>

      <aside className={styles.controls}>
        <div className={styles.controlDetails}>
          {!joined ? (
            <div className={styles.section}>
              <h2>{phase === "waiting" ? t("readyTitle") : t("joinTitle")}</h2>
              <p className={styles.meta}>{t("cameraRequired")}</p>
              {videoError && (
                <p className={`${styles.notice} ${styles.error}`} role="status">
                  {videoError}
                </p>
              )}
              <button
                className={styles.button}
                disabled={joining || !mediaReady || Boolean(mediaError)}
                onClick={join}
              >
                {joining ? <LoaderCircle size={16} /> : <VideoIcon size={16} />}
                {t("join")}
              </button>
              <p className={styles.meta}>{t("neverRecorded")}</p>
            </div>
          ) : null}

          {(phase === "waiting" || phase === "intro" || !goalSaved) && (
            <div className={styles.section}>
              <label className={styles.field}>
                {t("goalLabel")}
                <textarea
                  value={goal}
                  maxLength={280}
                  rows={3}
                  placeholder={t("goalPlaceholder")}
                  onChange={(e) => {
                    setGoal(e.target.value);
                    setGoalSaved(false);
                  }}
                />
              </label>
              <button
                className={styles.buttonSecondary}
                onClick={saveGoal}
                disabled={!goal.trim() || goalSaved}
              >
                {goalSaved ? c("saved") : t("shareGoal")}
              </button>
            </div>
          )}

          {isHost && joined && (phase === "intro" || phase === "focus") && (
            <div className={styles.section}>
              <strong>{t("hostControls")}</strong>
              <p className={styles.meta}>{t("hostControlsLead")}</p>
              <div className={styles.row}>
                {phase === "intro" && (
                  <button
                    className={styles.button}
                    onClick={() =>
                      void post(`/api/sessions/${state.session.id}/phase`, {
                        phase: "focus",
                      }).then(refresh)
                    }
                  >
                    {t("startFocus")}
                  </button>
                )}
                <button
                  className={styles.buttonSecondary}
                  onClick={() =>
                    void post(`/api/sessions/${state.session.id}/phase`, {
                      phase: "wrap",
                    }).then(refresh)
                  }
                >
                  {t("startWrap")}
                </button>
              </div>
            </div>
          )}

          {isHost && others.some((p) => p.goalText) && (
            <div className={styles.section}>
              <strong>{t("goalsInRoom")}</strong>
              <ul className={styles.goalList}>
                {others
                  .filter((p) => p.goalText)
                  .map((p) => (
                    <li key={p.userId}>
                      <strong>{p.displayName}:</strong> {p.goalText}
                    </li>
                  ))}
              </ul>
            </div>
          )}

          {(phase === "wrap" || phase === "focus") && joined && (
            <div className={styles.section}>
              <strong>{t("howDidItGo")}</strong>
              <Outcomes value={outcome} onChange={chooseOutcome} />
            </div>
          )}
        </div>
      </aside>
      <footer className={styles.bar}>
        <button
          className={styles.buttonSecondary}
          disabled={!joined}
          onClick={() => {
            manualMic.current = true;
            void applyMic(!micOn);
          }}
          aria-pressed={micOn}
        >
          {micOn ? <Mic size={17} /> : <MicOff size={17} />}
          {micOn ? t("mute") : t("unmute")}
        </button>
        {others.length > 0 && (
          <button
            className={styles.buttonSecondary}
            onClick={() =>
              setReportFor(
                others.length === 1 ? others[0].userId : others[0].userId,
              )
            }
          >
            <Flag size={16} /> {t("report")}
          </button>
        )}
        <button className={styles.buttonDanger} onClick={leave}>
          <PhoneOff size={16} /> {t("leave")}
        </button>
      </footer>
      <ReportDialog
        dialogRef={reportDialog}
        targetId={reportFor}
        sessionId={state.session.id}
        people={others.map((o) => ({ id: o.userId, name: o.displayName }))}
        onChangeTarget={setReportFor}
        onClose={() => setReportFor(null)}
        onBlocked={async () => {
          setBlockedNotice(true);
          await leave();
          router.refresh();
        }}
      />
    </div>
  );
}

function RemoteTile(props: {
  name: string;
  avatarUrl: string | null;
  goal: string | null;
  present: boolean;
  stream?: MediaStream;
  hint: string;
  isHost: boolean;
  hostLabel: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = props.stream ?? null;
  }, [props.stream]);
  return (
    <div className={styles.lane}>
      <LaneRope vertical className={styles.ropeDesktop} />
      <LaneRope className={styles.ropeMobile} />
      <div className={styles.media}>
        {props.stream ? (
          <video ref={ref} autoPlay playsInline />
        ) : (
          <div className={styles.empty}>
            <Avatar name={props.name} src={props.avatarUrl} size="lg" />
            <span>{props.hint}</span>
          </div>
        )}
      </div>
      <div className={styles.tileLabel}>
        <span className={styles.tileName}>
          {props.name}{" "}
          {props.isHost && (
            <span className={styles.badge}>{props.hostLabel}</span>
          )}
        </span>
        {props.goal && (
          <span className={`tile-goal ${styles.goal}`}>{props.goal}</span>
        )}
      </div>
    </div>
  );
}

function Outcomes({
  value,
  onChange,
}: {
  value: Outcome | null;
  onChange: (v: Outcome) => void;
}) {
  const t = useTranslations("room");
  const options: { v: Outcome; icon: React.ReactNode }[] = [
    { v: "done", icon: <CheckCircle2 size={20} /> },
    { v: "partial", icon: <CircleDashed size={20} /> },
    { v: "not_done", icon: <XCircle size={20} /> },
  ];
  return (
    <div className={styles.outcomes} role="group">
      {options.map((o) => (
        <button
          key={o.v}
          aria-pressed={value === o.v}
          onClick={() => onChange(o.v)}
        >
          {o.icon}
          {t(`outcome.${o.v}`)}
        </button>
      ))}
    </div>
  );
}

function Summary(props: {
  focusFrom: number;
  wrapFrom: number;
  blocked: boolean;
  state: RoomState;
  outcome: Outcome | null;
  onOutcome: (v: Outcome) => void;
  canFavorite: boolean;
  favorites: string[];
  onFavorite: (userId: string) => void;
  onReport: (userId: string) => void;
  reportDialog: React.ReactNode;
}) {
  const t = useTranslations("room");
  const me = props.state.participants.find((p) => p.userId === props.state.me);
  const others = props.state.participants.filter(
    (p) => p.userId !== props.state.me,
  );
  return (
    <main className={styles.summary}>
      <header className={styles.summaryTitle}>
        <PaceClock
          progress={1}
          focusFrom={props.focusFrom}
          wrapFrom={props.wrapFrom}
          phase="ended"
          size={112}
          label={t("summaryOverline")}
          className={styles.clock}
        />
        <div className={styles.stackSmall}>
          <h1>{t("summaryTitle")}</h1>
          <p className={styles.muted}>{t("summaryOverline")}</p>
        </div>
      </header>
      {me?.goalText && (
        <section className={styles.section}>
          <strong>{t("goalLabel")}</strong>
          <p className={`tile-goal ${styles.goal}`}>{me.goalText}</p>
        </section>
      )}
      {props.blocked && (
        <p className={styles.notice} role="status">
          {t("reportSentBody")}
        </p>
      )}
      <section className={styles.section}>
        <strong>{t("howDidItGo")}</strong>
        <Outcomes value={props.outcome} onChange={props.onOutcome} />
      </section>
      {props.state.session.hostId &&
        props.state.session.hostId !== props.state.me && (
          <RateHost sessionId={props.state.session.id} />
        )}
      {others.length > 0 && (
        <section className={styles.section}>
          <h2>{t("yourPartners", { count: others.length })}</h2>
          <div className={styles.list}>
            {others.map((p) => (
              <div key={p.userId} className={styles.listItem}>
                <Avatar name={p.displayName} src={p.avatarUrl} />
                <div className={styles.partnerCopy}>
                  <strong>{p.displayName}</strong>
                  {p.goalText && (
                    <span className={`tile-goal ${styles.goal}`}>
                      {p.goalText}
                    </span>
                  )}
                  {p.outcome && (
                    <span className={styles.meta}>
                      {t(`outcome.${p.outcome}`)}
                    </span>
                  )}
                </div>
                {props.canFavorite ? (
                  <button
                    className={
                      props.favorites.includes(p.userId)
                        ? styles.buttonSelected
                        : styles.buttonSecondary
                    }
                    onClick={() => props.onFavorite(p.userId)}
                  >
                    <Star size={14} />{" "}
                    {props.favorites.includes(p.userId)
                      ? t("favorited")
                      : t("favorite")}
                  </button>
                ) : (
                  <Link
                    href={`/u/${p.username}`}
                    className={styles.buttonGhost}
                  >
                    {t("profile")}
                  </Link>
                )}
                <button
                  className={styles.iconButton}
                  aria-label={t("report")}
                  onClick={() => props.onReport(p.userId)}
                >
                  <Flag size={14} />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
      <div className={styles.row}>
        <Link href="/book" className={styles.button}>
          {t("bookNext")}
        </Link>
        <Link href="/dashboard" className={styles.buttonSecondary}>
          {t("backHome")}
        </Link>
      </div>
      {props.reportDialog}
    </main>
  );
}

function RateHost({ sessionId }: { sessionId: string }) {
  const t = useTranslations("room");
  const [score, setScore] = useState(0);
  const [sent, setSent] = useState(false);
  return (
    <section className={styles.section}>
      <strong>{t("rateHost")}</strong>
      <div className={styles.row} role="radiogroup" aria-label={t("rateHost")}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            role="radio"
            aria-checked={score === n}
            aria-label={String(n)}
            className={score >= n ? styles.ratingSelected : styles.rating}
            onClick={async () => {
              setScore(n);
              await post(`/api/sessions/${sessionId}/rate`, { score: n }).catch(
                () => {},
              );
              setSent(true);
            }}
          >
            <Star size={16} />
          </button>
        ))}
      </div>
      {sent && (
        <span className={styles.meta} role="status">
          {t("thanks")}
        </span>
      )}
    </section>
  );
}

const REASONS = [
  "inappropriate",
  "harassment",
  "no_camera",
  "spam",
  "underage",
  "other",
] as const;

function ReportDialog({
  dialogRef,
  targetId,
  sessionId,
  people,
  onChangeTarget,
  onClose,
  onBlocked,
}: {
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  targetId: string | null;
  sessionId: string;
  people?: { id: string; name: string }[];
  onChangeTarget?: (id: string) => void;
  onClose: () => void;
  onBlocked?: () => void;
}) {
  const t = useTranslations("room");
  const c = useTranslations("common");
  const [reason, setReason] =
    useState<(typeof REASONS)[number]>("inappropriate");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<"report" | "block" | null>(null);
  async function send(kind: "report" | "block") {
    if (!targetId) return;
    setBusy(true);
    try {
      await post(
        `/api/safety/${kind}`,
        kind === "report"
          ? {
              targetId: targetId,
              sessionId: sessionId,
              reason,
              details,
            }
          : { targetId: targetId, sessionId: sessionId },
      );
      setDone(kind);
      onBlocked?.();
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog ref={dialogRef} className={styles.dialog} onClose={onClose}>
      <div className={styles.dialogBody}>
        {done ? (
          <>
            <h2>{done === "report" ? t("reportSent") : t("blocked")}</h2>
            <p className={styles.muted}>{t("reportSentBody")}</p>
            <div className={styles.dialogActions}>
              <button className={styles.button} onClick={onClose}>
                {c("close")}
              </button>
            </div>
          </>
        ) : (
          <>
            <h2>{t("reportTitle")}</h2>
            <p className={styles.meta}>{t("reportLead")}</p>
            {people && people.length > 1 && (
              <label className={styles.field}>
                {t("who")}
                <select
                  value={targetId ?? ""}
                  onChange={(e) => onChangeTarget?.(e.target.value)}
                >
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className={styles.field}>
              {t("reason")}
              <select
                value={reason}
                onChange={(e) =>
                  setReason(e.target.value as (typeof REASONS)[number])
                }
              >
                {REASONS.map((r) => (
                  <option key={r} value={r}>
                    {t(`reasons.${r}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              {t("details")}
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                maxLength={2000}
                rows={3}
              />
            </label>
            <div className={styles.dialogActions}>
              <button className={styles.buttonGhost} onClick={onClose}>
                {c("cancel")}
              </button>
              <button
                className={styles.buttonSecondary}
                disabled={busy}
                onClick={() => send("block")}
              >
                {t("blockOnly")}
              </button>
              <button
                className={styles.buttonDanger}
                disabled={busy}
                onClick={() => send("report")}
              >
                {t("reportAndBlock")}
              </button>
            </div>
          </>
        )}
      </div>
    </dialog>
  );
}
