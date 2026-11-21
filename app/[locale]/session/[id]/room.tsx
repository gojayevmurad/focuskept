"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
): { phase: Phase; remainingMs: number; progress: number } {
  const end = startMs + duration * 60_000;
  const { intro, wrap } = phaseLengths(duration);
  // A host can start focus or wrap-up early.
  const focusFrom = overrides.focusAt
    ? new Date(overrides.focusAt).getTime()
    : startMs + intro * 60_000;
  const wrapFrom = overrides.wrapAt
    ? new Date(overrides.wrapAt).getTime()
    : end - wrap * 60_000;
  if (now < startMs)
    return { phase: "waiting", remainingMs: startMs - now, progress: 0 };
  if (now >= end) return { phase: "ended", remainingMs: 0, progress: 1 };
  const progress = (now - startMs) / (duration * 60_000);
  if (now >= wrapFrom)
    return { phase: "wrap", remainingMs: end - now, progress };
  if (now < focusFrom)
    return { phase: "intro", remainingMs: end - now, progress };
  return { phase: "focus", remainingMs: end - now, progress };
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

  const client = useRef<VideoClient | null>(null);
  const localStream = useRef<MediaStream | null>(null);
  const localVideo = useRef<HTMLVideoElement>(null);
  const subscribed = useRef(new Map<string, string>());
  const lastStats = useRef<QualityStats>({});
  const lastPhase = useRef<Phase | null>(null);
  const manualMic = useRef(false);
  const reportDialog = useRef<HTMLDialogElement>(null);

  const startMs = new Date(state.session.startAt).getTime();
  const serverNow = now + offset;
  const { phase, remainingMs, progress } = computePhase(
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

  // Local preview before joining.
  useEffect(() => {
    let cancelled = false;
    getLocalMedia({ audio: true })
      .then((stream) => {
        if (cancelled) return stream.getTracks().forEach((tr) => tr.stop());
        localStream.current = stream;
        if (localVideo.current) localVideo.current.srcObject = stream;
      })
      .catch((error: unknown) =>
        setMediaError(
          error instanceof LocalMediaError
            ? t(`media.${error.code}`)
            : t("media.unknown"),
        ),
      );
    return () => {
      cancelled = true;
    };
  }, [t]);

  useEffect(() => {
    if (localVideo.current && localStream.current)
      localVideo.current.srcObject = localStream.current;
  }, [joined]);

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

  const applyMic = useCallback(async (on: boolean) => {
    setMicOn(on);
    await client.current?.setMicrophone(on).catch(() => {});
  }, []);

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
      await video.publishTracks(localStream.current, {
        audio: true,
        video: true,
        simulcast: group,
      });
      const startOn = phase === "focus" ? false : props.microphoneDefault;
      await applyMic(startOn);
      lastPhase.current = phase;
      setJoined(true);
      await refresh();
    } catch {
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

  const finish = useCallback(async () => {
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
    await finish();
    setLeft(true);
  }

  useEffect(() => {
    if (reportFor) reportDialog.current?.showModal();
    else reportDialog.current?.close();
  }, [reportFor]);

  const phaseLabel = useMemo(
    () =>
      ({
        waiting: t("phase.waiting"),
        intro: t("phase.intro"),
        focus: t("phase.focus"),
        wrap: t("phase.wrap"),
        ended: t("phase.ended"),
      })[phase],
    [phase, t],
  );

  if (phase === "ended" || left || state.window === "over") {
    return (
      <Summary
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
    <div className="room">
      <header className="room-top">
        <LogoMark size={22} />
        <div className="grow stack-sm" style={{ gap: 0 }}>
          <strong>
            {state.session.title ?? (group ? t("groupTitle") : t("pairTitle"))}
          </strong>
          <span className="room-phase">
            {phaseLabel} ·{" "}
            {format.dateTime(new Date(state.session.startAt), {
              timeZone: props.timeZone,
              hour: "numeric",
              minute: "2-digit",
            })}{" "}
            · {c("minutes", { count: state.session.durationMin })}
          </span>
        </div>
        {quality === "reduced" && (
          <span className="badge warm">{t("lowBandwidth")}</span>
        )}
        <span className="timer" aria-live="off">
          {phase === "waiting" ? clock(remainingMs) : clock(remainingMs)}
        </span>
      </header>
      <div style={{ padding: "0 20px 12px" }}>
        <div className="progress">
          <span style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      </div>

      <div className="room-stage">
        <div className={`tiles ${group ? "group" : ""}`}>
          <div className="tile">
            <video
              ref={localVideo}
              autoPlay
              playsInline
              muted
              className="mirror"
            />
            <div className="tile-label">
              <span className="tile-name">
                {c("you")} {!micOn && <MicOff size={12} />}
              </span>
              {me?.goalText && <span className="tile-goal">{me.goalText}</span>}
            </div>
            {mediaError && <div className="tile-empty">{mediaError}</div>}
          </div>
          {others.length === 0 && (
            <div className="tile">
              <div className="tile-empty">{t("aloneInRoom")}</div>
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

        <aside className="room-side">
          {!joined ? (
            <div className="card stack">
              <h2>{phase === "waiting" ? t("readyTitle") : t("joinTitle")}</h2>
              <p className="muted small">{t("cameraRequired")}</p>
              {videoError && <p className="notice error">{videoError}</p>}
              <button
                className="button full"
                disabled={joining || Boolean(mediaError)}
                onClick={join}
              >
                {joining ? (
                  <LoaderCircle size={16} className="spin" />
                ) : (
                  <VideoIcon size={16} />
                )}
                {t("join")}
              </button>
              <p className="small faint">{t("neverRecorded")}</p>
            </div>
          ) : null}

          {(phase === "waiting" || phase === "intro" || !goalSaved) && (
            <div className="card stack-sm">
              <label className="field">
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
                className="button secondary small"
                onClick={saveGoal}
                disabled={!goal.trim() || goalSaved}
              >
                {goalSaved ? c("saved") : t("shareGoal")}
              </button>
            </div>
          )}

          {isHost && joined && (phase === "intro" || phase === "focus") && (
            <div className="card stack-sm">
              <strong>{t("hostControls")}</strong>
              <p className="small muted">{t("hostControlsLead")}</p>
              <div className="row">
                {phase === "intro" && (
                  <button
                    className="button small"
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
                  className="button secondary small"
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
            <div className="card stack-sm">
              <strong>{t("goalsInRoom")}</strong>
              <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
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

          <div className="card stack-sm">
            <strong>{t(`tips.${phase}`)}</strong>
            <p className="small muted">{t(`tipsBody.${phase}`)}</p>
          </div>

          {(phase === "wrap" || phase === "focus") && joined && (
            <div className="card stack-sm">
              <strong>{t("howDidItGo")}</strong>
              <Outcomes value={outcome} onChange={chooseOutcome} />
            </div>
          )}
        </aside>
      </div>

      <footer className="room-bar">
        <button
          className={`button ${micOn ? "secondary" : "danger"}`}
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
            className="button secondary"
            onClick={() =>
              setReportFor(
                others.length === 1 ? others[0].userId : others[0].userId,
              )
            }
          >
            <Flag size={16} /> {t("report")}
          </button>
        )}
        <button className="button danger secondary" onClick={leave}>
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
    <div className="tile">
      {props.stream ? (
        <video ref={ref} autoPlay playsInline />
      ) : (
        <div className="tile-empty stack-sm" style={{ justifyItems: "center" }}>
          <Avatar name={props.name} src={props.avatarUrl} size="lg" />
          <span>{props.hint}</span>
        </div>
      )}
      <div className="tile-label">
        <span className="tile-name">
          {props.name}{" "}
          {props.isHost && (
            <span className="badge warm">{props.hostLabel}</span>
          )}
        </span>
        {props.goal && <span className="tile-goal">{props.goal}</span>}
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
    <div className="outcomes" role="group">
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
  const others = props.state.participants.filter(
    (p) => p.userId !== props.state.me,
  );
  return (
    <main className="content content-narrow" style={{ paddingTop: 48 }}>
      <div className="page-title">
        <span className="overline">{t("summaryOverline")}</span>
        <h1>{t("summaryTitle")}</h1>
      </div>
      <section className="card stack">
        <strong>{t("howDidItGo")}</strong>
        <Outcomes value={props.outcome} onChange={props.onOutcome} />
      </section>
      {props.state.session.hostId &&
        props.state.session.hostId !== props.state.me && (
          <RateHost sessionId={props.state.session.id} />
        )}
      {others.length > 0 && (
        <section className="card stack">
          <h2>{t("yourPartners", { count: others.length })}</h2>
          <div className="list">
            {others.map((p) => (
              <div key={p.userId} className="list-item">
                <Avatar name={p.displayName} src={p.avatarUrl} />
                <div className="grow stack-sm" style={{ gap: 2 }}>
                  <strong>{p.displayName}</strong>
                  {p.goalText && (
                    <span className="small muted">{p.goalText}</span>
                  )}
                  {p.outcome && (
                    <span className="small faint">
                      {t(`outcome.${p.outcome}`)}
                    </span>
                  )}
                </div>
                {props.canFavorite ? (
                  <button
                    className={`button small ${props.favorites.includes(p.userId) ? "on" : "secondary"}`}
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
                    className="button ghost small"
                  >
                    {t("profile")}
                  </Link>
                )}
                <button
                  className="button ghost small icon"
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
      <div className="row">
        <Link href="/book" className="button">
          {t("bookNext")}
        </Link>
        <Link href="/dashboard" className="button secondary">
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
    <section className="card stack-sm">
      <strong>{t("rateHost")}</strong>
      <div className="row" role="radiogroup" aria-label={t("rateHost")}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            role="radio"
            aria-checked={score === n}
            aria-label={String(n)}
            className={`button small icon ${score >= n ? "on" : "ghost"}`}
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
      {sent && <span className="small muted">{t("thanks")}</span>}
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

function ReportDialog(props: {
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
    if (!props.targetId) return;
    setBusy(true);
    try {
      await post(
        `/api/safety/${kind}`,
        kind === "report"
          ? {
              targetId: props.targetId,
              sessionId: props.sessionId,
              reason,
              details,
            }
          : { targetId: props.targetId, sessionId: props.sessionId },
      );
      setDone(kind);
      props.onBlocked?.();
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={props.dialogRef}
      className="dialog"
      onClose={props.onClose}
      style={{ color: "var(--text)" }}
    >
      <div className="dialog-body">
        {done ? (
          <>
            <h2>{done === "report" ? t("reportSent") : t("blocked")}</h2>
            <p className="muted">{t("reportSentBody")}</p>
            <div className="dialog-actions">
              <button className="button" onClick={props.onClose}>
                {c("close")}
              </button>
            </div>
          </>
        ) : (
          <>
            <h2>{t("reportTitle")}</h2>
            <p className="muted small">{t("reportLead")}</p>
            {props.people && props.people.length > 1 && (
              <label className="field">
                {t("who")}
                <select
                  value={props.targetId ?? ""}
                  onChange={(e) => props.onChangeTarget?.(e.target.value)}
                >
                  {props.people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="field">
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
            <label className="field">
              {t("details")}
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                maxLength={2000}
                rows={3}
              />
            </label>
            <div className="dialog-actions">
              <button className="button ghost" onClick={props.onClose}>
                {c("cancel")}
              </button>
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => send("block")}
              >
                {t("blockOnly")}
              </button>
              <button
                className="button danger"
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
