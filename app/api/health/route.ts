import { eq, sql } from "drizzle-orm";
import { db } from "@/src/lib/db";
import { getEnv } from "@/src/config/env";
import { appConfig } from "@/src/lib/db/schema";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    getEnv();
    if (process.env.DATABASE_URL) await db().execute(sql`select 1`);
    let worker: "ok" | "stale" | "unknown" = "unknown";
    if (process.env.DATABASE_URL) {
      try {
        const [heartbeat] = await db()
          .select({ value: appConfig.value })
          .from(appConfig)
          .where(eq(appConfig.key, "worker_heartbeat"))
          .limit(1);
        const timestamp =
          typeof heartbeat?.value === "string"
            ? Date.parse(heartbeat.value)
            : NaN;
        if (Number.isFinite(timestamp))
          worker = Date.now() - timestamp > 3 * 60_000 ? "stale" : "ok";
      } catch {
        // Heartbeat availability must not block web deployments.
      }
    }
    return Response.json({
      status: "ok",
      worker,
      database: process.env.DATABASE_URL ? "connected" : "unconfigured",
    });
  } catch {
    return Response.json({ status: "unhealthy" }, { status: 503 });
  }
}
