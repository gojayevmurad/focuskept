// Creates verified local test accounts through the real auth API (development only).
// Usage: node --env-file=.env.local scripts/dev-users.mjs alice@example.test bob@example.test
import pg from "pg";
if (process.env.NODE_ENV === "production") throw new Error("Development only");
const base = process.env.APP_URL || "http://localhost:3000";
const password = process.env.DEV_PASSWORD || "local-dev-password-123";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  for (const email of process.argv.slice(2)) {
    const name = email.split("@")[0].replace(/^./, (c) => c.toUpperCase());
    const res = await fetch(`${base}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: base },
      body: JSON.stringify({
        email,
        password,
        name,
        callbackURL: "/dashboard",
      }),
    });
    if (!res.ok && res.status !== 422)
      console.warn(email, res.status, (await res.text()).slice(0, 300));
    const { rows } = await pool.query(
      "select url from email_preview where recipient = $1 and kind = 'verification' order by created_at desc limit 1",
      [email],
    );
    if (rows[0]) await fetch(rows[0].url, { redirect: "manual" });
    console.log(`${email} ready`);
  }
} finally {
  await pool.end();
}
