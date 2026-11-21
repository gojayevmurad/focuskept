// SPDX-License-Identifier: AGPL-3.0-only
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

const WARM = [
  "/",
  "/sign-in",
  "/sign-up",
  "/verify-email",
  "/onboarding",
  "/dashboard",
  "/book",
  "/session/00000000-0000-4000-8000-000000000000",
  "/pricing",
  "/blog",
  "/how-it-works",
  "/faq",
  "/body-doubling-for/adhd",
  "/sitemap.xml",
  "/api/health",
];

/**
 * Applies migrations to the isolated test database, then requests every page
 * once so the dev server compiles them before tests start clicking.
 */
export default async function globalSetup() {
  const url = process.env.TEST_DATABASE_URL;
  if (url) {
    if (!new URL(url).pathname.endsWith("_test"))
      throw new Error("Use an isolated _test database");
    const pool = new Pool({ connectionString: url });
    try {
      await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
    } finally {
      await pool.end();
    }
  }
  const base = process.env.E2E_BASE_URL || "http://localhost:3000";
  for (const path of WARM)
    await fetch(base + path, { redirect: "manual" }).catch(() => {});
}
