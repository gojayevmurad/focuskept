// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useActionState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { adminAction, type ActionState } from "./actions";

export function ActionForm({
  fields,
  label,
  children,
  danger = false,
  disabled = false,
}: {
  fields: Record<string, string | number>;
  label: string;
  children?: ReactNode;
  danger?: boolean;
  disabled?: boolean;
}) {
  const t = useTranslations("admin");
  const [state, action, pending] = useActionState<ActionState, FormData>(
    adminAction,
    {},
  );
  return (
    <form action={action} className="stack-sm">
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {children}
      <button
        className={`button small ${danger ? "danger" : "secondary"}`}
        disabled={pending || disabled}
      >
        {pending ? t("saving") : label}
      </button>
      <span aria-live="polite">
        {state.error ? (
          <span className="notice error">{t(`errors.${state.error}`)}</span>
        ) : state.ok ? (
          t("saved")
        ) : null}
      </span>
    </form>
  );
}
