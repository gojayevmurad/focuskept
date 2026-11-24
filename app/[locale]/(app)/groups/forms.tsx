// SPDX-License-Identifier: AGPL-3.0-only
"use client";
import { useActionState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  createGroup,
  joinCircle,
  joinGroupByCode,
  leaveGroup,
  newInviteCode,
  removeFromGroup,
} from "./actions";

export function CreateGroupForm() {
  const t = useTranslations("groups");
  const [state, action, pending] = useActionState(createGroup, {});
  return (
    <form action={action} className="form">
      <label className="field">
        {t("name")}
        <input
          name="name"
          required
          minLength={2}
          maxLength={80}
          placeholder={t("namePlaceholder")}
        />
      </label>
      <label className="field">
        {t("kind")}
        <select name="kind" defaultValue="other">
          {(["university", "bootcamp", "company", "other"] as const).map(
            (k) => (
              <option key={k} value={k}>
                {t(`kinds.${k}`)}
              </option>
            ),
          )}
        </select>
      </label>
      <label className="field">
        {t("description")}
        <textarea
          name="description"
          maxLength={400}
          rows={2}
          placeholder={t("descriptionPlaceholder")}
        />
      </label>
      <div className="row">
        <button className="button" disabled={pending}>
          {t("create")}
        </button>
      </div>
      {state.error && <p className="notice error">{t("invalid")}</p>}
    </form>
  );
}

export function JoinByCodeForm() {
  const t = useTranslations("groups");
  const [state, action, pending] = useActionState(joinGroupByCode, {});
  return (
    <form action={action} className="form">
      <label className="field">
        {t("code")}
        <input
          className="input grow"
          name="code"
          required
          placeholder={t("codePlaceholder")}
          aria-label={t("code")}
        />
      </label>
      <button className="button secondary" disabled={pending}>
        {t("joinWithCode")}
      </button>
      {state.error && (
        <p className="notice error" style={{ width: "100%" }}>
          {t("codeNotFound")}
        </p>
      )}
    </form>
  );
}

export function MemberActions({
  communityId,
  userId,
  kind,
}: {
  communityId: string;
  userId?: string;
  kind: "leave" | "remove" | "rotate" | "join";
}) {
  const t = useTranslations("groups");
  const [pending, start] = useTransition();
  const run = () =>
    start(async () => {
      if (kind === "join") await joinCircle(communityId);
      if (kind === "leave") await leaveGroup(communityId);
      if (kind === "remove" && userId)
        await removeFromGroup(communityId, userId);
      if (kind === "rotate") await newInviteCode(communityId);
    });
  return (
    <button
      className={`button small ${kind === "rotate" ? "secondary" : "ghost"}`}
      disabled={pending}
      onClick={run}
    >
      {t(kind)}
    </button>
  );
}
