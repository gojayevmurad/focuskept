// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { slugFromTitle } from "@/src/lib/admin/validation";
import { ActionForm } from "../action-form";

export type ChallengeFields = {
  id: string;
  title: string;
  slug: string;
  description: string;
  startsAt: string;
  endsAt: string;
  goalType: string;
  goalValue: number;
};
export function ChallengeForm({ initial }: { initial?: ChallengeFields }) {
  const t = useTranslations("admin");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [editedSlug, setEditedSlug] = useState(Boolean(initial));
  const [goalType, setGoalType] = useState(initial?.goalType ?? "sessions");
  return (
    <ActionForm
      fields={{ intent: "challengeSave", id: initial?.id ?? "" }}
      label={t(initial ? "save" : "createChallenge")}
    >
      <div className="grid-2">
        <label className="field">
          <span>{t("columns.title")}</span>
          <input
            name="title"
            value={title}
            required
            minLength={2}
            maxLength={160}
            onChange={(event) => {
              setTitle(event.target.value);
              if (!editedSlug) setSlug(slugFromTitle(event.target.value));
            }}
          />
        </label>
        <label className="field">
          <span>{t("slug")}</span>
          <input
            name="slug"
            value={slug}
            required
            minLength={2}
            maxLength={160}
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            onChange={(event) => {
              setEditedSlug(true);
              setSlug(event.target.value);
            }}
          />
        </label>
      </div>
      <label className="field">
        <span>{t("description")}</span>
        <textarea
          name="description"
          defaultValue={initial?.description}
          maxLength={4000}
        />
      </label>
      <div className="grid-2">
        <label className="field">
          <span>{t("startsAt")}</span>
          <input
            type="date"
            name="startsAt"
            defaultValue={initial?.startsAt}
            required
          />
        </label>
        <label className="field">
          <span>{t("endsAt")}</span>
          <input
            type="date"
            name="endsAt"
            defaultValue={initial?.endsAt}
            required
          />
        </label>
        <label className="field">
          <span>{t("goalType")}</span>
          <select
            name="goalType"
            value={goalType}
            onChange={(event) => setGoalType(event.target.value)}
          >
            <option value="sessions">{t("sessions")}</option>
            <option value="minutes">{t("hours")}</option>
          </select>
        </label>
        <label className="field">
          <span>
            {t(goalType === "minutes" ? "goalHours" : "goalSessions")}
          </span>
          <input
            key={goalType}
            name="goalValue"
            type="number"
            min={goalType === "minutes" ? 0.0001 : 1}
            max={1000000}
            step={goalType === "minutes" ? "any" : 1}
            defaultValue={initial?.goalValue ?? 1}
            required
          />
        </label>
      </div>
      <p className="small muted">{t("utcDates")}</p>
    </ActionForm>
  );
}
