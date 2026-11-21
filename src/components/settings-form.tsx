"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/src/lib/auth/client";
export function SettingsForm({
  name,
  security = false,
}: {
  name?: string;
  security?: boolean;
}) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="form settings-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const data = new FormData(e.currentTarget);
        try {
          const result = security
            ? await authClient.changePassword({
                currentPassword: String(data.get("currentPassword")),
                newPassword: String(data.get("password")),
                revokeOtherSessions: true,
              })
            : await authClient.updateUser({ name: String(data.get("name")) });
          setMessage(result.error?.message || "Changes saved.");
        } catch {
          setMessage("Unable to save changes.");
        } finally {
          setBusy(false);
        }
      }}
    >
      {security ? (
        <>
          <label>
            Current password
            <input
              type="password"
              name="currentPassword"
              autoComplete="current-password"
              required
            />
          </label>
          <label>
            New password
            <input
              type="password"
              name="password"
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
              required
            />
          </label>
        </>
      ) : (
        <label>
          Display name
          <input name="name" defaultValue={name} maxLength={80} required />
        </label>
      )}
      <button className="button" disabled={busy}>
        {busy ? "Saving…" : "Save changes"}
      </button>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
    </form>
  );
}
export function DeleteAccount() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  return (
    <form
      className="form"
      onSubmit={async (e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        if (data.get("confirmation") !== "DELETE") return;
        try {
          const result = await authClient.deleteUser({
            password: String(data.get("password")),
            callbackURL: "/",
          });
          if (result.error)
            setMessage(result.error.message || "Unable to delete account.");
          else {
            router.push("/");
            router.refresh();
          }
        } catch {
          setMessage(
            "Unable to delete. Contact support if billing is connected.",
          );
        }
      }}
    >
      <label>
        Confirm your password
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </label>
      <label>
        Type DELETE to confirm
        <input name="confirmation" pattern="DELETE" required />
      </label>
      <button className="button danger">Permanently delete account</button>
      {message && <p role="status">{message}</p>}
    </form>
  );
}
export function Sessions() {
  const [message, setMessage] = useState("");
  return (
    <>
      <button
        className="button secondary"
        onClick={async () => {
          const result = await authClient.revokeOtherSessions();
          setMessage(result.error?.message || "Other sessions revoked.");
        }}
      >
        Sign out other sessions
      </button>
      {message && <p role="status">{message}</p>}
    </>
  );
}
