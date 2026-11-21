// SPDX-License-Identifier: AGPL-3.0-only
// Pure profile rules, shared by forms and the server.

export const SEGMENTS = [
  "remote-work",
  "study",
  "adhd",
  "writing",
  "founder",
  "freelance",
  "research",
  "creative",
] as const;
export type Segment = (typeof SEGMENTS)[number];

export function isSegment(value: string): value is Segment {
  return (SEGMENTS as readonly string[]).includes(value);
}

const RESERVED = new Set([
  "admin",
  "api",
  "app",
  "help",
  "host",
  "hosts",
  "login",
  "me",
  "new",
  "root",
  "settings",
  "signup",
  "sign-in",
  "sign-up",
  "support",
  "system",
  "u",
]);

export const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9_-]{1,22}[a-z0-9])$/;

export function validateUsername(value: string) {
  const name = value.trim().toLowerCase();
  if (!USERNAME_PATTERN.test(name))
    return { ok: false as const, reason: "format" };
  if (RESERVED.has(name)) return { ok: false as const, reason: "reserved" };
  return { ok: true as const, username: name };
}

/** "Ada Lovelace" -> "ada-lovelace", padded and trimmed to a valid username. */
export function usernameFromName(name: string) {
  const base = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 18);
  return base.length >= 3 ? base : `focus-${base || "friend"}`.slice(0, 18);
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (
    (parts[0]?.[0] ?? "?") + (parts.length > 1 ? parts.at(-1)![0] : "")
  ).toUpperCase();
}

export function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || name;
}
