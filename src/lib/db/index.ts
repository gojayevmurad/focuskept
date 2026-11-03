import "server-only";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";
import { getEnv } from "@/src/config/env";
let connection: ReturnType<typeof drizzle<typeof schema>> | undefined;
export function db() {
  if (connection) return connection;
  const { DATABASE_URL } = getEnv();
  if (!DATABASE_URL)
    throw new Error(
      "Database is not configured. Set DATABASE_URL and apply migrations.",
    );
  const pool = new Pool({
    connectionString: DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
  connection = drizzle(pool, { schema });
  return connection;
}
