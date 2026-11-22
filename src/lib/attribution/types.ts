// SPDX-License-Identifier: AGPL-3.0-only

export type Channel =
  | "organic_search"
  | "ai_search"
  | "social"
  | "referral"
  | "direct";

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
};
