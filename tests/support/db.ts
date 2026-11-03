import { vi } from "vitest";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { inArray } from "drizzle-orm";

export const testDatabaseUrl = process.env.TEST_DATABASE_URL;

/** Applies migrations to the isolated `_test` database and points the app at it. */
export async function setupTestDatabase() {
  const url = testDatabaseUrl;
  if (!url) return false;
  if (!new URL(url).pathname.endsWith("_test"))
    throw new Error("TEST_DATABASE_URL must name a database ending in _test");
  vi.stubEnv("DATABASE_URL", url);
  const pool = new Pool({ connectionString: url });
  try {
    await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
  } finally {
    await pool.end();
  }
  return true;
}

export async function createTestUsers(...ids: string[]) {
  const { db } = await import("@/src/lib/db");
  const { user } = await import("@/src/lib/db/schema");
  await db().delete(user).where(inArray(user.id, ids));
  await db()
    .insert(user)
    .values(
      ids.map((id) => ({
        id,
        name: id,
        email: `${id}@example.test`,
        emailVerified: true,
      })),
    );
}

export async function deleteTestUsers(...ids: string[]) {
  const { db } = await import("@/src/lib/db");
  const { user } = await import("@/src/lib/db/schema");
  await db().delete(user).where(inArray(user.id, ids));
}
