"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";

export function UnsubscribeButton({ token }: { token: string }) {
  const t = useTranslations("notifications.unsubscribe");
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">(
    "idle",
  );
  if (state === "done")
    return (
      <p className="notice notice-success" role="status">
        {t("done")}
      </p>
    );
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div>
        <button
          className="btn btn-primary"
          disabled={state === "busy"}
          onClick={async () => {
            setState("busy");
            const response = await fetch(
              `/api/unsubscribe?token=${encodeURIComponent(token)}`,
              { method: "POST" },
            ).catch(() => null);
            setState(response?.ok ? "done" : "error");
          }}
        >
          {t("confirm")}
        </button>
      </div>
      {state === "error" && (
        <p className="error-text" role="alert">
          {t("error")}
        </p>
      )}
    </div>
  );
}
