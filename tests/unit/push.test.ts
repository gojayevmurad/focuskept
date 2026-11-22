// SPDX-License-Identifier: AGPL-3.0-only
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  db: vi.fn(),
  rateLimit: vi.fn(),
  getEnv: vi.fn(),
}));

vi.mock("@/src/lib/auth/session", () => ({
  getSession: mocks.getSession,
}));
vi.mock("@/src/lib/db", () => ({
  db: mocks.db,
}));
vi.mock("@/src/lib/security/rate-limit", () => ({
  rateLimit: mocks.rateLimit,
}));
vi.mock("@/src/config/env", () => ({
  getEnv: mocks.getEnv,
}));

import { DELETE, POST } from "@/app/api/push/route";
import { isSafePushEndpoint } from "@/src/lib/security/validation";

describe("Push endpoint SSRF validation", () => {
  it("permits public HTTPS push service endpoints", () => {
    expect(
      isSafePushEndpoint(
        "https://fcm.googleapis.com/fcm/send/sample-subscription-token",
      ),
    ).toBe(true);
    expect(
      isSafePushEndpoint(
        "https://updates.push.services.mozilla.com/wpush/v2/abc123token",
      ),
    ).toBe(true);
    expect(
      isSafePushEndpoint("https://web.push.apple.com/QN891234sampletoken"),
    ).toBe(true);
  });

  it("rejects non-https URLs", () => {
    expect(isSafePushEndpoint("http://fcm.googleapis.com/fcm/send/token")).toBe(
      false,
    );
  });

  it("rejects loopback and localhost hostnames", () => {
    expect(isSafePushEndpoint("https://localhost/push")).toBe(false);
    expect(isSafePushEndpoint("https://sub.localhost/push")).toBe(false);
    expect(isSafePushEndpoint("https://service.local/push")).toBe(false);
    expect(isSafePushEndpoint("https://internal.internal/push")).toBe(false);
    expect(isSafePushEndpoint("https://127.0.0.1/push")).toBe(false);
    expect(isSafePushEndpoint("https://[::1]/push")).toBe(false);
  });

  it("rejects cloud metadata and private network IP ranges", () => {
    expect(isSafePushEndpoint("https://169.254.169.254/latest/meta-data")).toBe(
      false,
    );
    expect(isSafePushEndpoint("https://10.0.0.1/notify")).toBe(false);
    expect(isSafePushEndpoint("https://172.16.1.1/notify")).toBe(false);
    expect(isSafePushEndpoint("https://192.168.1.1/notify")).toBe(false);
    expect(isSafePushEndpoint("https://0.0.0.0/notify")).toBe(false);
  });
});

describe("Push API route handler", () => {
  const appUrl = "https://focuskept.test";
  const testUser = {
    id: "usr-123",
    email: "user@test.com",
    emailVerified: true,
  };

  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getEnv.mockReturnValue({ APP_URL: appUrl });
    mocks.getSession.mockResolvedValue({ user: testUser });
    mocks.rateLimit.mockResolvedValue(true);

    const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
    const values = vi.fn().mockReturnValue({ onConflictDoUpdate });
    const insert = vi.fn().mockReturnValue({ values });
    const where = vi.fn().mockResolvedValue(undefined);
    const del = vi.fn().mockReturnValue({ where });

    mocks.db.mockReturnValue({ insert, delete: del });
  });

  it("rejects unauthenticated requests with 401", async () => {
    mocks.getSession.mockResolvedValue(null);

    const request = new Request(`${appUrl}/api/push`, {
      method: "POST",
      headers: {
        origin: appUrl,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        endpoint: "https://fcm.googleapis.com/fcm/send/abc",
        keys: { p256dh: "key1", auth: "key2" },
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it("enforces rate limits on POST with 429", async () => {
    mocks.rateLimit.mockResolvedValue(false);

    const request = new Request(`${appUrl}/api/push`, {
      method: "POST",
      headers: {
        origin: appUrl,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        endpoint: "https://fcm.googleapis.com/fcm/send/abc",
        keys: { p256dh: "key1", auth: "key2" },
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(429);
    expect(mocks.rateLimit).toHaveBeenCalledWith("push:usr-123", 20, 60);
  });

  it("rejects unsafe push endpoint with 400 on POST", async () => {
    const request = new Request(`${appUrl}/api/push`, {
      method: "POST",
      headers: {
        origin: appUrl,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        endpoint: "https://169.254.169.254/latest/meta-data",
        keys: { p256dh: "key1", auth: "key2" },
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("successfully stores valid push subscription", async () => {
    const request = new Request(`${appUrl}/api/push`, {
      method: "POST",
      headers: {
        origin: appUrl,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        endpoint: "https://fcm.googleapis.com/fcm/send/token123",
        keys: { p256dh: "key1", auth: "key2" },
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ ok: true });
    expect(mocks.rateLimit).toHaveBeenCalledWith("push:usr-123", 20, 60);
  });

  it("enforces rate limits on DELETE with 429", async () => {
    mocks.rateLimit.mockResolvedValue(false);

    const request = new Request(`${appUrl}/api/push`, {
      method: "DELETE",
      headers: {
        origin: appUrl,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        endpoint: "https://fcm.googleapis.com/fcm/send/token123",
      }),
    });

    const response = await DELETE(request);
    expect(response.status).toBe(429);
    expect(mocks.rateLimit).toHaveBeenCalledWith("push:usr-123", 20, 60);
  });

  it("rejects unsafe push endpoint on DELETE with 400", async () => {
    const request = new Request(`${appUrl}/api/push`, {
      method: "DELETE",
      headers: {
        origin: appUrl,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        endpoint: "https://localhost:8080/hook",
      }),
    });

    const response = await DELETE(request);
    expect(response.status).toBe(400);
  });

  it("successfully deletes subscription with valid safe endpoint", async () => {
    const request = new Request(`${appUrl}/api/push`, {
      method: "DELETE",
      headers: {
        origin: appUrl,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        endpoint: "https://fcm.googleapis.com/fcm/send/token123",
      }),
    });

    const response = await DELETE(request);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ ok: true });
    expect(mocks.rateLimit).toHaveBeenCalledWith("push:usr-123", 20, 60);
  });
});
