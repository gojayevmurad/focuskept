"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/src/i18n/navigation";
import { toast } from "@/src/components/ui/toast";

/** Rename or archive the subject shown on the cards page. */
export function SubjectActions({ id, name }: { id: string; name: string }) {
  const t = useTranslations("cards.subjects");
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [busy, setBusy] = useState(false);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const response = await fetch(`/api/subjects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (response.status === 409) {
        toast(t("nameTaken"), "error");
        return false;
      }
      if (!response.ok) throw new Error();
      return true;
    } catch {
      toast(t("error"), "error");
      return false;
    } finally {
      setBusy(false);
    }
  }

  if (editing)
    return (
      <form
        className="mb-3 flex flex-wrap gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          const next = value.trim();
          if (!next || next === name) return setEditing(false);
          if (await patch({ name: next })) {
            setEditing(false);
            router.refresh();
          }
        }}
      >
        <input
          className="input"
          value={value}
          maxLength={60}
          autoFocus
          onChange={(e) => setValue(e.target.value)}
          aria-label={t("renameLabel")}
          dir="auto"
        />
        <button className="btn btn-primary btn-sm" disabled={busy}>
          {t("save")}
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => setEditing(false)}
        >
          {t("cancel")}
        </button>
      </form>
    );
  return (
    <div className="mb-3 flex flex-wrap gap-2">
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={() => setEditing(true)}
      >
        {t("rename")}
      </button>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        disabled={busy}
        onClick={async () => {
          if (await patch({ archived: true })) {
            toast(t("archived", { name }));
            router.push("/app/cards");
            router.refresh();
          }
        }}
      >
        {t("archive")}
      </button>
    </div>
  );
}
