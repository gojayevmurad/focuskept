// SPDX-License-Identifier: AGPL-3.0-only
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getEnv: vi.fn(),
  captureImmediate: vi.fn(),
  shutdown: vi.fn(),
}));
vi.mock("@/src/config/env", () => ({ getEnv: mocks.getEnv }));
vi.mock("posthog-node", () => ({
  PostHog: class {
    captureImmediate = mocks.captureImmediate;
    shutdown = mocks.shutdown;
  },
}));
import { trackServer } from "@/src/lib/analytics/server";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getEnv.mockReturnValue({
    APP_URL: "https://focuskept.com/some/path",
    POSTHOG_KEY: "test-key",
    ANALYTICS_ENABLED: true,
  });
});

describe("server analytics host", () => {
  it("adds the APP_URL host and keeps the caller's properties and UUID", async () => {
    const properties = { location: "signup" };
    await trackServer("member", "signup", properties, true, "event-id");
    expect(mocks.captureImmediate).toHaveBeenCalledWith({
      distinctId: "member",
      event: "signup",
      properties: { $host: "focuskept.com", location: "signup" },
      uuid: "event-id",
    });
    expect(properties).toEqual({ location: "signup" });
    expect(mocks.shutdown).toHaveBeenCalledOnce();
  });

  it("preserves an explicitly supplied host", async () => {
    await trackServer("member", "signup", { $host: "other.example" }, true);
    expect(mocks.captureImmediate).toHaveBeenCalledWith(
      expect.objectContaining({ properties: { $host: "other.example" } }),
    );
  });

  it("still requires analytics consent", async () => {
    await trackServer("member", "signup", {}, false);
    expect(mocks.captureImmediate).not.toHaveBeenCalled();
  });
});
