"use client";
import { useState } from "react";
import { useHydrated } from "@/src/lib/use-hydrated";
import { useTranslations } from "next-intl";
import { useRouter } from "@/src/i18n/navigation";
import { Dialog } from "@/src/components/ui/dialog";
import { toast } from "@/src/components/ui/toast";
import {
  emptyLocal,
  hasImportableData,
  readLocal,
  updateLocal,
  writeLocal,
  type LocalData,
} from "@/src/features/focus/local-store";

/** On first sign-in: offer to import sessions and tasks recorded on this device. */
export function ImportPrompt() {
  return useHydrated() ? <ImportDialog /> : null;
}

function ImportDialog() {
  const t = useTranslations("focus.import");
  const router = useRouter();
  const [data, setData] = useState<LocalData | null>(() => {
    const local = readLocal();
    return hasImportableData(local) ? local : null;
  });
  const [busy, setBusy] = useState(false);
  if (!data) return null;
  const counts = { sessions: data.sessions.length, tasks: data.tasks.length };
  const close = () => setData(null);
  // Remember the answer on this device until something new is recorded here.
  const decline = () => {
    updateLocal((d) => ({ ...d, importDeclinedAt: new Date().toISOString() }));
    close();
  };
  return (
    <Dialog open onClose={decline} title={t("title")} labelledBy="import-title">
      <p>{t("text", counts)}</p>
      <div className="dialog-actions">
        <button className="btn btn-ghost" onClick={decline}>
          {t("later")}
        </button>
        <button
          className="btn btn-primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const response = await fetch("/api/import/local", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  tasks: data.tasks,
                  sessions: data.sessions,
                }),
              });
              if (!response.ok) throw new Error();
              const result = (await response.json()) as {
                sessions: number;
                tasks: number;
              };
              // Imported data now lives in the account; keep only device settings.
              writeLocal({
                ...emptyLocal(),
                settings: data.settings,
                importedAt: new Date().toISOString(),
              });
              toast(t("done", result));
              close();
              router.refresh();
            } catch {
              toast(t("error"), "error");
            } finally {
              setBusy(false);
            }
          }}
        >
          {t("confirm")}
        </button>
      </div>
    </Dialog>
  );
}
