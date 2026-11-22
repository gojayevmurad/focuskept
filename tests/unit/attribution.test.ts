// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import {
  channelFor,
  parseAttributionCookie,
  serializeAttributionCookie,
  sanitizeAttribution,
  type Attribution,
} from "@/src/lib/attribution";

describe("channelFor", () => {
  it("maps organic search engines", () => {
    expect(channelFor({ referrer: "www.google.com" })).toBe("organic_search");
    expect(channelFor({ referrer: "google.co.uk" })).toBe("organic_search");
    expect(channelFor({ referrer: "bing.com" })).toBe("organic_search");
    expect(channelFor({ referrer: "duckduckgo.com" })).toBe("organic_search");
    expect(channelFor({ referrer: "www.ecosia.org" })).toBe("organic_search");
    expect(channelFor({ referrer: "search.yahoo.com" })).toBe("organic_search");
    expect(channelFor({ medium: "organic" })).toBe("organic_search");
  });

  it("maps AI search engines", () => {
    expect(channelFor({ referrer: "chatgpt.com" })).toBe("ai_search");
    expect(channelFor({ referrer: "chat.openai.com" })).toBe("ai_search");
    expect(channelFor({ referrer: "perplexity.ai" })).toBe("ai_search");
    expect(channelFor({ referrer: "claude.ai" })).toBe("ai_search");
    expect(channelFor({ referrer: "gemini.google.com" })).toBe("ai_search");
    expect(channelFor({ referrer: "copilot.microsoft.com" })).toBe("ai_search");
    expect(channelFor({ source: "perplexity" })).toBe("ai_search");
  });

  it("maps social networks", () => {
    expect(channelFor({ referrer: "reddit.com" })).toBe("social");
    expect(channelFor({ referrer: "x.com" })).toBe("social");
    expect(channelFor({ referrer: "t.co" })).toBe("social");
    expect(channelFor({ referrer: "twitter.com" })).toBe("social");
    expect(channelFor({ referrer: "linkedin.com" })).toBe("social");
    expect(channelFor({ referrer: "facebook.com" })).toBe("social");
    expect(channelFor({ referrer: "instagram.com" })).toBe("social");
    expect(channelFor({ referrer: "youtube.com" })).toBe("social");
    expect(channelFor({ referrer: "tiktok.com" })).toBe("social");
    expect(channelFor({ medium: "social" })).toBe("social");
  });

  it("maps other referrers and referral codes to referral", () => {
    expect(channelFor({ referrer: "news.ycombinator.com" })).toBe("referral");
    expect(channelFor({ referrer: "producthunt.com" })).toBe("referral");
    expect(channelFor({ ref: "focus_friend" })).toBe("referral");
    expect(channelFor({ medium: "referral" })).toBe("referral");
    expect(channelFor({ source: "partner_blog" })).toBe("referral");
  });

  it("maps direct visits when no referrer or parameters exist", () => {
    expect(channelFor()).toBe("direct");
    expect(channelFor(null)).toBe("direct");
    expect(channelFor({})).toBe("direct");
    expect(channelFor({ landingPath: "/dashboard" })).toBe("direct");
    expect(channelFor({ source: "direct" })).toBe("direct");
  });
});

describe("attribution cookie handling & sanitization", () => {
  it("sanitizes and truncates fields to 200 characters", () => {
    const longString = "a".repeat(300);
    const raw: Partial<Attribution> = {
      source: longString,
      medium: "social",
      campaign: longString,
      content: "banner",
      term: "focus",
      referrer: "x.com",
      landingPath: "/join",
      ref: "alex",
      firstSeenAt: "2026-03-02T12:00:00Z",
    };

    const sanitized = sanitizeAttribution(raw);
    expect(sanitized.source).toHaveLength(200);
    expect(sanitized.source).toBe("a".repeat(200));
    expect(sanitized.campaign).toHaveLength(200);
    expect(sanitized.medium).toBe("social");
    expect(sanitized.content).toBe("banner");
  });

  it("serializes and parses valid attribution JSON", () => {
    const attr: Attribution = {
      source: "newsletter",
      medium: "email",
      campaign: "spring_launch",
      referrer: "mail.google.com",
      landingPath: "/book",
      ref: "partner123",
      firstSeenAt: "2026-03-02T12:00:00.000Z",
    };

    const serialized = serializeAttributionCookie(attr);
    expect(typeof serialized).toBe("string");

    const parsed = parseAttributionCookie(serialized);
    expect(parsed).toEqual(attr);
  });

  it("safely handles corrupted or empty cookie values", () => {
    expect(parseAttributionCookie("")).toBeNull();
    expect(parseAttributionCookie(null)).toBeNull();
    expect(parseAttributionCookie(undefined)).toBeNull();
    expect(parseAttributionCookie("not-json{")).toBeNull();
    expect(parseAttributionCookie("{}")).toBeNull();
  });
});
