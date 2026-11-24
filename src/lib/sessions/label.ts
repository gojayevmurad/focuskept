// SPDX-License-Identifier: AGPL-3.0-only
type Person = { name: string; joined: boolean };

/** Call with the other participants only; fallback rooms never use a group label. */
export function sessionLabel(
  session: { isFallbackRoom: boolean; type: string; title: string | null },
  others: Person[],
  t: (
    key: "openRoom" | "withPartner" | "group" | "pair",
    values?: { name: string },
  ) => string,
) {
  if (session.isFallbackRoom) {
    const joined = others.filter((p) => p.joined);
    return joined.length === 1
      ? t("withPartner", { name: joined[0].name })
      : t("openRoom");
  }
  if (session.title) return session.title;
  if (session.type === "pair" && others.length === 1)
    return t("withPartner", { name: others[0].name });
  return t(session.type === "group" ? "group" : "pair");
}

export function partnerPresenceMessage(
  person: { displayName: string; joined: boolean } | undefined,
  joined: unknown,
  t: (key: "partnerLeft" | "partnerBack", values: { name: string }) => string,
) {
  if (!person || typeof joined !== "boolean") return null;
  if (!joined) return t("partnerLeft", { name: person.displayName });
  return person.joined ? t("partnerBack", { name: person.displayName }) : null;
}
