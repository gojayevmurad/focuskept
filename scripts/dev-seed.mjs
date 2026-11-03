// Development-only: creates a verified local test account through the real
// sign-up endpoint, so you can try the signed-in app without email delivery.
// Refuses to run against anything but a local database and preview email.
import { existsSync } from "node:fs";
import pg from "pg";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const appUrl =
  process.env.SEED_APP_URL || process.env.APP_URL || "http://localhost:3000";
const databaseUrl = process.env.DATABASE_URL;
// Local test credentials (not a secret; never used outside localhost).
const email = process.env.DEV_SEED_EMAIL || "dev@focuskept.test";
const password = process.env.DEV_SEED_PASSWORD || "focuskept-local-dev-only";

if (process.env.NODE_ENV === "production")
  throw new Error("Refusing to seed in production");
if (
  !databaseUrl ||
  !["localhost", "127.0.0.1"].includes(new URL(databaseUrl).hostname)
)
  throw new Error("Refusing to seed a non-local database");
if ((process.env.EMAIL_MODE || "preview") !== "preview")
  throw new Error("Seeding requires EMAIL_MODE=preview");
if (!["localhost", "127.0.0.1"].includes(new URL(appUrl).hostname))
  throw new Error("APP_URL must be local");

const response = await fetch(`${appUrl}/api/auth/sign-up/email`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Origin: new URL(appUrl).origin,
  },
  body: JSON.stringify({
    email,
    password,
    name: "Dev Tester",
    callbackURL: "/en/app",
  }),
});
if (!response.ok && response.status !== 422) {
  console.error(
    `Sign-up failed (${response.status}): ${await response.text()}`,
  );
}
const pool = new pg.Pool({ connectionString: databaseUrl });
const result = await pool.query(
  'update "user" set email_verified = true where email = $1 returning id',
  [email],
);
await pool.end();
if (!result.rowCount) throw new Error("Account was not created");
console.log(
  `Local test account ready: ${email} (password: see scripts/dev-seed.mjs or DEV_SEED_PASSWORD)`,
);
