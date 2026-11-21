import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/src/lib/db";
import type { RealtimeMessage, Topic } from "./types";

/** Publish to every web process. Works from route handlers, transactions and the worker. */
export async function publish(
  topic: Topic,
  event: RealtimeMessage["event"],
  data: Record<string, unknown> = {},
  executor: { execute: ReturnType<typeof db>["execute"] } = db(),
) {
  const payload = JSON.stringify({ topic, event, data, at: Date.now() });
  if (payload.length > 7500) throw new Error("Realtime payload too large");
  await executor.execute(sql`select pg_notify('realtime', ${payload})`);
}
