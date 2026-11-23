// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from "vitest";
import { envSchema } from "@/src/config/env";

const base = {
  NODE_ENV: "production",
  DATABASE_URL: "postgres://u:p@db:5432/app",
  BETTER_AUTH_SECRET: "a".repeat(40),
};

describe("founding-member dates", () => {
  it("allows unset and empty dates", () => {
    expect(envSchema.parse({}).FOUNDING_SIGNUP_BEFORE).toBeUndefined();
    expect(
      envSchema.parse({ FOUNDING_PLUS_UNTIL: "" }).FOUNDING_PLUS_UNTIL,
    ).toBeUndefined();
  });

  it.each(["2027-02-01", "2027-02-01T00:00:00Z", "2027-02-01T04:00:00+04:00"])(
    "accepts ISO date %s",
    (date) => {
      expect(
        envSchema.safeParse({
          FOUNDING_SIGNUP_BEFORE: date,
          FOUNDING_PLUS_UNTIL: date,
        }).success,
      ).toBe(true);
    },
  );

  it.each(["not-a-date", "2027-02-30", "02/01/2027", "2027-02-01T00:00:00"])(
    "rejects invalid or ambiguous date %s for either setting",
    (date) => {
      for (const key of ["FOUNDING_SIGNUP_BEFORE", "FOUNDING_PLUS_UNTIL"])
        expect(envSchema.safeParse({ [key]: date }).success).toBe(false);
    },
  );
});

describe("production env", () => {
  it("requires https, real email and a video transport on public hosts", () => {
    const r = envSchema.safeParse({
      ...base,
      APP_URL: "http://app.example.com",
      EMAIL_MODE: "preview",
      VIDEO_PROVIDER: "none",
    });
    expect(r.success).toBe(false);
    const messages = r.error!.issues.map((i) => i.message).join(" ");
    expect(messages).toContain("HTTPS");
    expect(messages).toContain("EMAIL_MODE=send");
    expect(messages).toContain("VIDEO_PROVIDER=none");
  });

  it("allows a local production run for browser tests", () => {
    const r = envSchema.safeParse({
      ...base,
      APP_URL: "http://localhost:3000",
      EMAIL_MODE: "preview",
      VIDEO_PROVIDER: "none",
    });
    expect(r.success).toBe(true);
  });

  it("still needs a strong auth secret locally", () => {
    const r = envSchema.safeParse({
      ...base,
      APP_URL: "http://localhost:3000",
      BETTER_AUTH_SECRET: "short",
    });
    expect(r.success).toBe(false);
  });
});
