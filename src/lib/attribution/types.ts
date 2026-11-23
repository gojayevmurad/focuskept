// SPDX-License-Identifier: AGPL-3.0-only

export const HEARD_FROM_OPTIONS = [
  "tiktok",
  "instagram",
  "youtube",
  "reddit",
  "google",
  "friend",
  "podcast",
  "other",
] as const;

export type HeardFrom = (typeof HEARD_FROM_OPTIONS)[number];

export type Channel =
  "organic_search" | "ai_search" | "social" | "referral" | "direct";

export type Attribution = {
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  term?: string;
  referrer?: string;
  landingPath?: string;
  ref?: string;
  firstSeenAt?: string;
  heardFrom?: HeardFrom;
  heardFromOther?: string;
};
