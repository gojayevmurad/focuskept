// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it, expect } from "vitest";
import {
  safeRedirect,
  credentialsSchema,
  sameOrigin,
  isSafePushEndpoint,
} from "@/src/lib/security/validation";
import {
  SECURITY_HEADERS,
  CONTENT_SECURITY_POLICY,
  CSP_DIRECTIVES,
  buildContentSecurityPolicy,
} from "@/src/lib/security/headers";
import {
  generateSecurityTxt,
  formatSecurityContact,
} from "@/src/lib/security/security-txt";
import { envSchema } from "@/src/config/env";
import { activeSubscription, canUsePro } from "@/src/lib/billing/policy";

describe("redirect validation", () => {
  it.each([
    "//evil.test",
    "https://evil.test",
    "/\\evil",
    "/foo\r\nbar",
    "/foo\tbar",
    "/foo\0bar",
    "/foo\x1fbar",
    "",
    null,
    undefined,
  ])("rejects %s", (value) =>
    expect(safeRedirect(value as string)).toBe("/dashboard"),
  );

  it("allows valid local paths", () => {
    expect(safeRedirect("/settings?tab=profile")).toBe("/settings?tab=profile");
    expect(safeRedirect("/dashboard")).toBe("/dashboard");
    expect(safeRedirect("/session/123#lane-1")).toBe("/session/123#lane-1");
  });
});

describe("origin validation", () => {
  it("rejects cross-origin mutations", () => {
    expect(
      sameOrigin(
        new Request("https://app.test/api", {
          headers: { origin: "https://evil.test" },
        }),
        "https://app.test",
      ),
    ).toBe(false);

    expect(
      sameOrigin(
        new Request("https://app.test/api", {
          headers: { origin: "https://app.test" },
        }),
        "https://app.test",
      ),
    ).toBe(true);
  });

  it("rejects missing or malformed origin headers", () => {
    expect(
      sameOrigin(new Request("https://app.test/api"), "https://app.test"),
    ).toBe(false);

    expect(
      sameOrigin(
        new Request("https://app.test/api", {
          headers: { origin: "null" },
        }),
        "https://app.test",
      ),
    ).toBe(false);

    expect(
      sameOrigin(
        new Request("https://app.test/api", {
          headers: { origin: "https://app.test:8080" },
        }),
        "https://app.test",
      ),
    ).toBe(false);
  });
});

describe("SSRF push endpoint validation", () => {
  it("accepts valid HTTPS push services", () => {
    expect(
      isSafePushEndpoint(
        "https://fcm.googleapis.com/fcm/send/sample-token-12345",
      ),
    ).toBe(true);
    expect(
      isSafePushEndpoint(
        "https://updates.push.services.mozilla.com/wpush/v2/token",
      ),
    ).toBe(true);
    expect(
      isSafePushEndpoint("https://web.push.apple.com/QN891234sample"),
    ).toBe(true);
  });

  it("rejects non-HTTPS, internal IPs, and localhost endpoints", () => {
    expect(isSafePushEndpoint("http://fcm.googleapis.com/fcm/send/token")).toBe(
      false,
    );
    expect(isSafePushEndpoint("http://localhost:3000/api/hook")).toBe(false);
    expect(isSafePushEndpoint("https://localhost:8443/evil")).toBe(false);
    expect(isSafePushEndpoint("https://127.0.0.1:5432")).toBe(false);
    expect(isSafePushEndpoint("https://169.254.169.254/latest/meta-data")).toBe(
      false,
    );
    expect(isSafePushEndpoint("https://10.0.0.1/private")).toBe(false);
    expect(isSafePushEndpoint("https://192.168.1.100/internal")).toBe(false);
    expect(isSafePushEndpoint("https://172.16.0.5/api")).toBe(false);
    expect(isSafePushEndpoint("https://[::1]:3000")).toBe(false);
    expect(isSafePushEndpoint("not-a-url")).toBe(false);
  });
});

describe("security.txt (RFC 9116)", () => {
  it("formats explicit contact with mailto if bare email", () => {
    expect(formatSecurityContact("security@example.com")).toBe(
      "mailto:security@example.com",
    );
    expect(formatSecurityContact("https://example.com/security")).toBe(
      "https://example.com/security",
    );
    expect(formatSecurityContact("mailto:ops@example.com")).toBe(
      "mailto:ops@example.com",
    );
  });

  it("falls back to first admin email when contact is unset", () => {
    expect(
      formatSecurityContact(undefined, ["admin@example.com", "two@example.com"]),
    ).toBe("mailto:admin@example.com");
  });

  it("falls back to default contact when both are empty", () => {
    expect(formatSecurityContact(undefined, [])).toBe(
      "mailto:security@focuskept.com",
    );
  });

  it("generates full RFC 9116 compliant body with 1 year expiration", () => {
    const fixedNow = new Date("2026-11-22T12:00:00.000Z");
    const output = generateSecurityTxt({
      contact: "security@focuskept.com",
      appUrl: "https://focuskept.com",
      now: fixedNow,
    });

    expect(output).toContain("Contact: mailto:security@focuskept.com");
    expect(output).toContain("Expires: 2027-11-22T12:00:00.000Z");
    expect(output).toContain("Preferred-Languages: en");
    expect(output).toContain(
      "Policy: https://github.com/gojayevmurad/focuskept/blob/main/SECURITY.md",
    );
    expect(output).toContain(
      "Canonical: https://focuskept.com/.well-known/security.txt",
    );
  });
});

describe("security headers and CSP", () => {
  it("includes all required security headers", () => {
    const map = new Map(SECURITY_HEADERS.map((h) => [h.key, h.value]));
    expect(map.get("X-Content-Type-Options")).toBe("nosniff");
    expect(map.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(map.get("X-Frame-Options")).toBe("DENY");
    expect(map.get("Permissions-Policy")).toBe(
      "camera=(self), microphone=(self), geolocation=()",
    );
    expect(map.get("Strict-Transport-Security")).toBe(
      "max-age=31536000; includeSubDomains",
    );
    expect(map.get("Cross-Origin-Opener-Policy")).toBe("same-origin");
    expect(map.has("Content-Security-Policy")).toBe(true);
  });

  it("enforces complete CSP directives matching application architecture", () => {
    const csp = CONTENT_SECURITY_POLICY;
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self' 'unsafe-inline'");
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    expect(csp).toContain("img-src 'self' data: blob: https:");
    expect(csp).toContain("media-src 'self' blob:");
    expect(csp).toContain(
      "connect-src 'self' https://rtc.live.cloudflare.com wss:",
    );
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain(
      "form-action 'self' https://accounts.google.com https://*.polar.sh https://polar.sh",
    );
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("upgrade-insecure-requests");
  });

  it("allows custom CSP building via helper", () => {
    const custom = buildContentSecurityPolicy({
      ...CSP_DIRECTIVES,
      "report-uri": ["/api/csp-report"],
    });
    expect(custom).toContain("report-uri /api/csp-report");
  });
});

describe("credentials validation", () => {
  it("requires a strong password and valid email", () => {
    expect(
      credentialsSchema.safeParse({ email: "a@b.com", password: "short" })
        .success,
    ).toBe(false);
    expect(
      credentialsSchema.safeParse({
        email: "bad",
        password: "longpassword12345",
      }).success,
    ).toBe(false);
  });
});

describe("environment and billing policy", () => {
  it("runs without providers in development", () =>
    expect(envSchema.parse({}).POLAR_ENVIRONMENT).toBe("sandbox"));
  it("fails closed on incomplete production config", () =>
    expect(envSchema.safeParse({ NODE_ENV: "production" }).success).toBe(
      false,
    ));
  it("requires the benefit and webhook when enabling Polar", () =>
    expect(envSchema.safeParse({ POLAR_ACCESS_TOKEN: "token" }).success).toBe(
      false,
    ));
  it("never grants access with an expired lease", () => {
    expect(canUsePro({ pro: true, validUntil: new Date(0) })).toBe(false);
    expect(canUsePro(undefined)).toBe(false);
    expect(
      canUsePro({ pro: false, validUntil: new Date(Date.now() + 60000) }),
    ).toBe(false);
    expect(
      canUsePro({ pro: true, validUntil: new Date(Date.now() + 60000) }),
    ).toBe(true);
  });
  it.each(["past_due", "unpaid", "canceled", "incomplete", "trialing"])(
    "denies %s subscriptions",
    (status) =>
      expect(
        activeSubscription(
          [{ status, current_period_end: "2099-01-01", product_id: "pro" }],
          ["pro"],
        ),
      ).toBe(false),
  );
  it("rejects unrecognized products and expired subscriptions", () => {
    expect(
      activeSubscription(
        [
          {
            status: "active",
            current_period_end: "2099-01-01",
            product_id: "other",
          },
        ],
        ["pro"],
      ),
    ).toBe(false);
    expect(
      activeSubscription(
        [
          {
            status: "active",
            current_period_end: "2000-01-01",
            product_id: "pro",
          },
        ],
        ["pro"],
      ),
    ).toBe(false);
  });
});
