// SPDX-License-Identifier: AGPL-3.0-only
import type { Attribution, Channel } from "./types";

// Hosts are matched exactly or as a parent domain (www.reddit.com → reddit.com).
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
  "lnkd.in",
  "facebook.com",
  "instagram.com",
  "youtube.com",
  "tiktok.com",
  "threads.net",
  "bsky.app",
];
// Search engines across their country domains (google.de, google.co.uk...).
const SEARCH_ENGINES = ["google", "bing", "duckduckgo", "ecosia", "yahoo"];

// utm_source values people commonly use for the same places.
const AI_SOURCES = [
  "chatgpt",
  "openai",
  "perplexity",
  "claude",
  "gemini",
  "copilot",
];
const SOCIAL_SOURCES = [
  "reddit",
  "x",
  "twitter",
  "linkedin",
  "facebook",
  "fb",
  "instagram",
  "ig",
  "youtube",
  "tiktok",
  "threads",
  "bluesky",
];

function onHost(host: string, domain: string) {
  return host === domain || host.endsWith(`.${domain}`);
}

function isSearchEngine(host: string) {
  return host
    .split(".")
    .some(
      (label, index, labels) =>
        SEARCH_ENGINES.includes(label) && index < labels.length - 1,
    );
}

export function channelFor(attribution?: Attribution | null): Channel {
  if (!attribution) return "direct";
  const host = (attribution.referrer || "").trim().toLowerCase();
  const source = (attribution.source || "").trim().toLowerCase();
  const medium = (attribution.medium || "").trim().toLowerCase();

  if (
    AI_HOSTS.some((domain) => onHost(host, domain)) ||
    AI_SOURCES.includes(source)
  )
    return "ai_search";
  if (medium === "organic" || (host && isSearchEngine(host)))
    return "organic_search";
  if (
    medium === "social" ||
    medium === "paid_social" ||
    SOCIAL_HOSTS.some((domain) => onHost(host, domain)) ||
    SOCIAL_SOURCES.includes(source)
  )
    return "social";
  if (
    host ||
    attribution.ref?.trim() ||
    medium === "referral" ||
    (source && source !== "direct")
  )
    return "referral";
  return "direct";
}
