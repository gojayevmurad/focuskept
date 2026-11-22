// SPDX-License-Identifier: AGPL-3.0-only
import type { Attribution, Channel } from "./types";

const ORGANIC_HOSTS = [
  "google.",
  "bing.",
  "duckduckgo.",
  "ecosia.",
  "yahoo.",
];

const AI_HOSTS = [
  "chatgpt.com",
  "chat.openai.com",
  "perplexity.ai",
  "claude.ai",
  "gemini.google.com",
  "copilot.microsoft.com",
];

const SOCIAL_HOSTS = [
  "reddit.com",
  "x.com",
  "t.co",
  "twitter.com",
  "linkedin.com",
  "facebook.com",
  "instagram.com",
  "youtube.com",
  "tiktok.com",
];

export function channelFor(attribution?: Attribution | null): Channel {
  if (!attribution) return "direct";

  const referrer = (attribution.referrer || "").toLowerCase();
  const source = (attribution.source || "").toLowerCase();
  const medium = (attribution.medium || "").toLowerCase();

  // AI search
  if (
    AI_HOSTS.some(
      (h) => referrer === h || referrer.endsWith("." + h) || referrer.includes(h),
    ) ||
    AI_HOSTS.some(
      (h) => source === h || source.includes(h) || (h.startsWith(source) && source.length > 3),
    )
  ) {
    return "ai_search";
  }

  // Organic search
  if (
    ORGANIC_HOSTS.some((h) => referrer.includes(h)) ||
    ORGANIC_HOSTS.some((h) => source.includes(h.replace(".", ""))) ||
    medium === "organic"
  ) {
    return "organic_search";
  }

  // Social
  if (
    SOCIAL_HOSTS.some(
      (h) => referrer === h || referrer.endsWith("." + h) || referrer.includes(h),
    ) ||
    SOCIAL_HOSTS.some((h) => source.includes(h.replace(".com", ""))) ||
    medium === "social"
  ) {
    return "social";
  }

  // Referral
  if (
    Boolean(attribution.referrer && attribution.referrer.trim() !== "") ||
    Boolean(attribution.ref && attribution.ref.trim() !== "") ||
    medium === "referral" ||
    (Boolean(source) && source !== "direct")
  ) {
    return "referral";
  }

  return "direct";
}
