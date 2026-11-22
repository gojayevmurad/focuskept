// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// Mock posthog-js
const mockPosthog = {
  init: vi.fn(),
  opt_in_capturing: vi.fn(),
  opt_out_capturing: vi.fn(),
  set_config: vi.fn(),
  capture: vi.fn(),
  identify: vi.fn(),
  reset: vi.fn(),
};

vi.mock("posthog-js", () => ({
  default: mockPosthog,
}));

// Local storage mock
const localStorageStore: Record<string, string> = {};
const mockLocalStorage = {
  getItem: vi.fn((key: string) => localStorageStore[key] ?? null),
  setItem: vi.fn((key: string, val: string) => {
    localStorageStore[key] = val;
  }),
  removeItem: vi.fn((key: string) => {
    delete localStorageStore[key];
  }),
  clear: vi.fn(() => {
    for (const key in localStorageStore) delete localStorageStore[key];
  }),
};

describe("analytics consent & two-level tracking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.clear();
    vi.stubGlobal("localStorage", mockLocalStorage);
    vi.stubGlobal("window", {
      location: { pathname: "/test" },
      dispatchEvent: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("initializes in cookieless opt-out mode before consent is granted", async () => {
    const { initAnalytics } = await import("@/src/lib/analytics/client");

    initAnalytics({
      enabled: true,
      key: "phc_test_key_123",
      host: "https://us.i.posthog.com",
      apiHost: "/ingest",
      uiHost: "https://us.i.posthog.com",
    });

    expect(mockPosthog.init).toHaveBeenCalledWith(
      "phc_test_key_123",
      expect.objectContaining({
        cookieless_mode: "on_reject",
        opt_out_capturing_by_default: true,
        person_profiles: "identified_only",
        capture_pageview: "history_change",
        capture_pageleave: true,
        disable_session_recording: true,
        api_host: "/ingest",
      }),
    );

    // Without consent, opt_out_capturing is active (cookieless mode)
    expect(mockPosthog.opt_out_capturing).toHaveBeenCalled();
    expect(mockPosthog.set_config).toHaveBeenCalledWith({
      capture_exceptions: false,
      capture_performance: false,
    });
  });

  it("does not identify user when consent is not granted", async () => {
    const { identify } = await import("@/src/lib/analytics/client");
    identify("user_abc_123");
    expect(mockPosthog.identify).not.toHaveBeenCalled();
  });

  it("activates persistence, web vitals, exceptions and allows identify after consent", async () => {
    const { enableAnalytics, identify } = await import(
      "@/src/lib/analytics/client"
    );

    mockLocalStorage.setItem("analytics-consent", "yes");
    enableAnalytics();

    expect(mockPosthog.opt_in_capturing).toHaveBeenCalled();
    expect(mockPosthog.set_config).toHaveBeenCalledWith({
      capture_exceptions: true,
      capture_performance: { web_vitals: true },
    });

    identify("user_abc_123");
    expect(mockPosthog.identify).toHaveBeenCalledWith("user_abc_123");
  });

  it("resets persistence and reverts to cookieless mode on disable", async () => {
    const { disableAnalytics } = await import("@/src/lib/analytics/client");

    mockLocalStorage.setItem("analytics-consent", "no");
    disableAnalytics();

    expect(mockPosthog.reset).toHaveBeenCalled();
    expect(mockPosthog.opt_out_capturing).toHaveBeenCalled();
    expect(mockPosthog.set_config).toHaveBeenCalledWith({
      capture_exceptions: false,
      capture_performance: false,
    });
  });
});
