// SPDX-License-Identifier: AGPL-3.0-only
"use client";
import { useActionState, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Flag, Heart, Trash2 } from "lucide-react";
import {
  flagPost,
  publishPost,
  reactToPost,
  removePost,
  saveAutomaticWins,
} from "./actions";
import styles from "./community.module.css";

type State = { error?: string; ok?: boolean };
function Feedback({ state }: { state: State }) {
  const t = useTranslations("communityFeed");
  return (
    <p aria-live="polite" className="small">
      {state.error ? t(`errors.${state.error}`) : state.ok ? t("saved") : ""}
    </p>
  );
}
export function Composer({
  automatic,
  groupId = "",
  sessions = [],
}: {
  automatic: boolean;
  groupId?: string;
  sessions?: { id: string; label: string }[];
}) {
  const t = useTranslations("communityFeed");
  const [body, setBody] = useState("");
  const [state, action, pending] = useActionState<State, FormData>(
    async (previous: State, data: FormData) => {
      const result = await publishPost(previous, data);
      if (result.ok) setBody("");
      return result;
    },
    {},
  );
  const [preference, save, saving] = useActionState<State, FormData>(
    saveAutomaticWins,
    {},
  );
  return (
    <section className={styles.composer}>
      <h2>{t("composerTitle")}</h2>
      <form action={action} className="form">
        <input type="hidden" name="groupId" value={groupId} />
        <label className="field">
          {t("updateType")}
          <select name="kind">
            <option value="working">{t("working")}</option>
            <option value="done">{t("done")}</option>
          </select>
        </label>
        <label className="field">
          {t("update")}
          <textarea
            name="body"
            required
            maxLength={280}
            rows={3}
            placeholder={t("placeholder")}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            aria-describedby="post-count"
          />
        </label>
        <div className={styles.examples}>
          {["exampleWork", "exampleWin"].map((key) => (
            <button
              className="button ghost small"
              type="button"
              key={key}
              onClick={() => setBody(t(key))}
            >
              {t(key)}
            </button>
          ))}
        </div>
        <details>
          <summary>{t("linkSession")}</summary>
          <label className="field">
            {t("sessionId")}
            <select name="sessionId">
              <option value="">{t("noSession")}</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            <small>{t("sessionHelp")}</small>
          </label>
        </details>
        <div className="row-between">
          <span id="post-count" className="small muted">
            {body.length}/280
          </span>
          <button className="button" disabled={pending}>
            {t("publish")}
          </button>
        </div>
        <Feedback state={state} />
      </form>
      <form action={save} className={styles.preference}>
        <label>
          <input type="checkbox" name="enabled" defaultChecked={automatic} />{" "}
          {t("automatic")}
        </label>
        <small className="muted">{t("automaticHelp")}</small>
        <button className="button secondary small" disabled={saving}>
          {t("savePreference")}
        </button>
        <Feedback state={preference} />
      </form>
    </section>
  );
}
export function PostControls({
  id,
  own,
  cheers,
  cheered,
}: {
  id: string;
  own: boolean;
  cheers: number;
  cheered: boolean;
}) {
  const t = useTranslations("communityFeed");
  const [pending, start] = useTransition();
  const [state, report, reporting] = useActionState<State, FormData>(
    flagPost,
    {},
  );
  return (
    <div className={styles.controls}>
      <button
        className="button secondary small"
        aria-pressed={cheered}
        disabled={pending}
        onClick={() => start(() => reactToPost(id, !cheered))}
      >
        <Heart
          size={16}
          aria-hidden="true"
          fill={cheered ? "currentColor" : "none"}
        />
        {t("cheer", { count: cheers })}
      </button>
      {own ? (
        <button
          className="button ghost small"
          disabled={pending}
          onClick={() => start(() => removePost(id))}
        >
          <Trash2 size={16} aria-hidden="true" />
          {t("delete")}
        </button>
      ) : (
        <details className={styles.report}>
          <summary>
            <Flag size={14} aria-hidden="true" /> {t("report")}
          </summary>
          <form action={report} className="form">
            <input type="hidden" name="postId" value={id} />
            <p className="small muted">{t("reportHelp")}</p>
            <label className="field">
              {t("reason")}
              <select name="reason">
                {[
                  "spam",
                  "harassment",
                  "inappropriate",
                  "underage",
                  "other",
                ].map((r) => (
                  <option key={r} value={r}>
                    {t(`reasons.${r}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              {t("details")}
              <textarea
                name="details"
                rows={2}
                maxLength={1500}
                placeholder={t("detailsPlaceholder")}
              />
            </label>
            <button className="button secondary" disabled={reporting}>
              {t("sendReport")}
            </button>
            <Feedback state={state} />
          </form>
        </details>
      )}
    </div>
  );
}
