"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/src/i18n/navigation";
import { computeState, type TimerState } from "@/src/features/timer/engine";
import { timerConfigFor } from "@/src/features/timer/configs";
import type {
  PlanningTechnique,
  TimeTechnique,
} from "@/src/features/techniques/slugs";
import type { RecommendationSession } from "@/src/features/techniques/recommend";
import {
  defaultSoundSettings,
  type CustomPreset,
  type SoundSettings,
  type TechniqueSettings,
} from "@/src/lib/db/json-types";
import { toast } from "@/src/components/ui/toast";
import { track } from "@/src/lib/analytics/client";
import {
  clearActive,
  loadActive,
  newClientId,
  saveActive,
  type ActiveSession,
} from "./active-session";
import { FocusScreen, type BoxDecision } from "./focus-screen";
import { TimerSetup, type Mode, type SetupResult } from "./timer-setup";
import { SessionEnd, type EndInput } from "./session-end";
import { LearnSignUp, LearnTopic } from "./learn-end";
import { formatMinutes } from "./format";
import { localStore, flushOutbox, remoteStore, type StoreTask } from "./stores";
import { readLocal, updateLocal } from "./local-store";
import { unlockAudio } from "./audio";
import { requestNotificationPermission } from "./notify";
import type { TechniqueLabels } from "./labels";
import { useHydrated } from "@/src/lib/use-hydrated";

type View =
  | { name: "setup" }
  | { name: "focus" }
  | { name: "end"; state: TimerState; decision?: BoxDecision };

export type FocusPreferences = {
  soundSettings: SoundSettings;
  techniqueSettings: TechniqueSettings;
  customPresets: CustomPreset[];
};

type FocusAppProps = {
  signedIn: boolean;
  initialTasks?: StoreTask[];
  recommendation?: RecommendationSession[];
  labels: TechniqueLabels;
  planningLabels: Record<string, string>;
  preferences?: FocusPreferences;
  initialTechnique?: TimeTechnique;
  initialPlanning?: PlanningTechnique;
  initialTaskId?: string;
  /** The user's preferred technique, used when there is no data-driven recommendation. */
  defaultTechnique?: TimeTechnique;
  initialMode?: Mode;
  initialSubject?: string;
  /** Shown above / below the timer card on the setup view only. */
  above?: React.ReactNode;
  below?: React.ReactNode;
  /** Reviews are due: Start becomes the secondary action. */
  secondaryStart?: boolean;
};

/** Restores browser-only state (running session, device settings) after hydration. */
export function FocusApp(props: FocusAppProps) {
  return useHydrated() ? (
    <FocusAppClient {...props} />
  ) : (
    <div className="skeleton mx-auto" style={{ height: 420, maxWidth: 760 }} />
  );
}

function FocusAppClient({
  signedIn,
  initialTasks = [],
  recommendation = [],
  labels,
  preferences,
  initialTechnique,
  initialTaskId,
  defaultTechnique,
  initialMode,
  initialSubject,
  above,
  below,
  secondaryStart,
}: FocusAppProps) {
  const t = useTranslations("common");
  const home = useTranslations("home");
  const locale = useLocale();
  const router = useRouter();
  const store = useMemo(
    () => (signedIn ? remoteStore(initialTasks, recommendation) : localStore),
    [signedIn, initialTasks, recommendation],
  );
  // Lazy initial state: a running/finished session on this device wins.
  const [initial] = useState(() => {
    const existing = loadActive();
    const local = signedIn ? undefined : readLocal().settings;
    let first: View = { name: "setup" };
    if (existing) {
      // "finished" never depends on the current time, so the last event suffices.
      const at = existing.events.at(-1)?.at ?? existing.createdAt;
      const state = computeState(existing.config, existing.events, at);
      first =
        state.phase === "finished" ? { name: "end", state } : { name: "focus" };
    }
    return { existing, local, first };
  });
  const [view, setView] = useState<View>(initial.first);
  const [active, setActive] = useState<ActiveSession | null>(initial.existing);
  const [tasks, setTasks] = useState<StoreTask[]>(initialTasks);
  const [sessions, setSessions] =
    useState<RecommendationSession[]>(recommendation);
  const [saving, setSaving] = useState(false);
  const [sound, setSound] = useState<SoundSettings>(
    preferences?.soundSettings ?? defaultSoundSettings,
  );
  const [techniqueSettings, setTechniqueSettings] = useState<TechniqueSettings>(
    preferences?.techniqueSettings ?? {},
  );
  // Refresh tasks and history from the store; flush queued sessions.
  useEffect(() => {
    void store.listTasks().then(setTasks);
    void store.recommendationSessions().then(setSessions);
    if (signedIn) void flushOutbox();
  }, [signedIn, store]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [view.name]);

  // Persist settings: on the device for visitors, in the account otherwise.
  const pending = useRef<ReturnType<typeof setTimeout>>(undefined);
  const persist = useCallback(
    (
      patch: Partial<{
        soundSettings: SoundSettings;
        techniqueSettings: TechniqueSettings;
        customPresets: CustomPreset[];
      }>,
    ) => {
      if (!signedIn) {
        updateLocal((d) => ({
          ...d,
          settings: {
            ...d.settings,
            ...(patch.soundSettings ? { sound: patch.soundSettings } : {}),
            ...(patch.techniqueSettings
              ? { techniqueSettings: patch.techniqueSettings }
              : {}),
            ...(patch.customPresets
              ? { customPresets: patch.customPresets }
              : {}),
          },
        }));
        return;
      }
      clearTimeout(pending.current);
      pending.current = setTimeout(() => {
        void fetch("/api/preferences", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        }).catch(() => {});
      }, 600);
    },
    [signedIn],
  );

  async function start(result: SetupResult) {
    unlockAudio();
    void requestNotificationPermission();
    let task: ActiveSession["task"];
    if (result.mode === "learning") task = undefined;
    else if (result.task && "isNew" in result.task) {
      try {
        const created = await store.addTask(result.task.title);
        task = { id: created.id, title: created.title };
      } catch {
        task = { title: result.task.title };
      }
    } else if (result.task)
      task = { id: result.task.id, title: result.task.title };
    const config = timerConfigFor(result.technique, {
      settings: techniqueSettings,
      boxMinutes: result.boxMinutes,
    });
    const at = Date.now();
    const session: ActiveSession = {
      v: 1,
      clientId: newClientId(),
      mode: result.mode,
      technique: result.technique,
      config,
      events: [{ type: "start", at }],
      goal: result.subject,
      task,
      // One explanation step ends every Learning session.
      learning:
        result.mode === "learning"
          ? { method: "feynman", topic: result.subject, notes: {} }
          : undefined,
      createdAt: at,
    };
    if (!signedIn)
      updateLocal((d) => ({
        ...d,
        settings: { ...d.settings, lastTechnique: result.technique },
      }));
    saveActive(session);
    setActive(session);
    setView({ name: "focus" });
  }

  async function save(input: EndInput, override?: ActiveSession) {
    const live = override ?? active;
    if (!live || view.name !== "end") return;
    const state = view.state;
    setSaving(true);
    const startedAt = new Date(state.startedAt ?? live.createdAt).toISOString();
    const endedAt = new Date(state.endedAt ?? Date.now()).toISOString();
    const result = await store.saveSession({
      clientId: live.clientId,
      mode: live.mode,
      timeTechnique: live.technique,
      learningMethod: live.learning?.method,
      planningTechnique: live.planning,
      taskId: live.task?.id,
      taskDone: Boolean(live.task?.id) && input.taskDone,
      moveTaskToLater: view.decision === "later",
      goal: live.goal,
      startedAt,
      endedAt,
      focusedSeconds: Math.round(state.focusedMs / 1000),
      breakSeconds: Math.round(state.breakMs / 1000),
      cyclesCompleted: state.cyclesCompleted,
      interruptions: state.interruptions,
      overrunSeconds: Math.round(state.overrunMs / 1000),
      focusRating: input.rating,
      note: input.note || null,
      learning: live.learning
        ? {
            topic: live.learning.topic,
            sourceUrl: live.learning.sourceUrl,
            notes: live.learning.notes,
          }
        : undefined,
    });
    setSaving(false);
    if (!signedIn && state.focusedMs >= 60_000) {
      track("core_action_completed", { feature: "focus_session" });
      if (readLocal().sessions.length === 1) track("onboarding_completed");
    }
    if (live.mode === "learning") {
      if (result.sessionId) {
        clearActive();
        router.push(`/app/learn/${result.sessionId}/explain`);
        return;
      }
      toast(t("status.offline"), "error");
      return;
    }
    clearActive();
    setActive(null);
    if (result.queued) toast(t("status.offline"));
    else if (result.summary)
      toast(
        home("todayTotal", {
          duration: formatMinutes(result.summary.focusedSeconds / 60, locale),
        }),
      );
    void store.listTasks().then(setTasks);
    void store.recommendationSessions().then(setSessions);
    setView({ name: "setup" });
    router.refresh();
  }

  // Signed-in Learning sessions with a topic go straight to the explanation.
  const autoSave =
    view.name === "end" &&
    active?.mode === "learning" &&
    signedIn &&
    Boolean(active.learning?.topic);
  const started = useRef(false);
  useEffect(() => {
    if (!autoSave || started.current) return;
    started.current = true;
    void save({ rating: null, note: "", taskDone: false });
  });

  if (view.name === "setup")
    return (
      <div className="timer-home">
        {above}
        <TimerSetup
          tasks={tasks}
          labels={labels}
          sessions={sessions}
          settings={techniqueSettings}
          initialTechnique={
            initialTechnique ??
            (signedIn ? undefined : readLocal().settings.lastTechnique)
          }
          initialTaskId={initialTaskId}
          initialMode={initialMode}
          initialSubject={initialSubject}
          defaultTechnique={defaultTechnique}
          signedIn={signedIn}
          secondaryStart={secondaryStart}
          onSettingsChange={(next) => {
            setTechniqueSettings(next);
            persist({ techniqueSettings: next });
          }}
          onStart={(result) => void start(result)}
        />
        {below}
      </div>
    );

  if (view.name === "focus" && active)
    return (
      <FocusScreen
        session={active}
        onSessionChange={(next) => {
          saveActive(next);
          setActive(next);
        }}
        onFinished={(state, decision) =>
          setView({ name: "end", state, decision })
        }
        sound={sound}
        onSoundChange={(next) => {
          setSound(next);
          persist({ soundSettings: next });
        }}
        techniqueName={labels[active.technique]?.name ?? active.technique}
      />
    );

  if (view.name === "end" && active) {
    const focusedSeconds = Math.round(view.state.focusedMs / 1000);
    const discard = () => {
      clearActive();
      setActive(null);
      setView({ name: "setup" });
    };
    if (active.mode === "learning") {
      if (!signedIn)
        return (
          <LearnSignUp
            focusedSeconds={focusedSeconds}
            topic={active.learning?.topic ?? ""}
            onSkip={discard}
          />
        );
      if (!active.learning?.topic)
        return (
          <LearnTopic
            focusedSeconds={focusedSeconds}
            saving={saving}
            onContinue={(topic) => {
              const next: ActiveSession = {
                ...active,
                goal: topic,
                learning: { ...active.learning!, topic },
              };
              saveActive(next);
              setActive(next);
              started.current = true;
              void save({ rating: null, note: "", taskDone: false }, next);
            }}
          />
        );
      return (
        <div
          className="skeleton mx-auto"
          style={{ height: 360, maxWidth: 640 }}
        />
      );
    }
    return (
      <SessionEnd
        focusedSeconds={focusedSeconds}
        task={active.task?.id ? active.task.title : undefined}
        defaultTaskDone={view.decision === "done"}
        saving={saving}
        onSave={(input) => void save(input)}
        onDiscard={discard}
      />
    );
  }

  return null;
}
