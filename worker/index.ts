// SPDX-License-Identifier: AGPL-3.0-only
import { PgBoss } from "pg-boss";
import { getEnv } from "@/src/config/env";
import { logger } from "@/src/lib/logger";
import { dailyTick, minuteTick } from "./jobs";

const MINUTE = "minute-tick";
const DAILY = "daily-tick";

async function main() {
  const env = getEnv();
  if (!env.DATABASE_URL) throw new Error("DATABASE_URL is required");

  // `--once` runs one tick and exits; used by tests and for manual runs.
  if (process.argv.includes("--once")) {
    const summary = await minuteTick();
    console.log(JSON.stringify(summary));
    process.exit(0);
  }

  const boss = new PgBoss({
    connectionString: env.DATABASE_URL,
    schema: "pgboss",
    max: 4,
  });
  boss.on("error", (error) => logger.error({ err: error }, "pg-boss error"));
  await boss.start();
  await boss.createQueue(MINUTE, {
    policy: "singleton",
    retryLimit: 0,
    expireInSeconds: 300,
  });
  await boss.createQueue(DAILY, {
    policy: "singleton",
    retryLimit: 3,
    expireInSeconds: 1800,
  });
  await boss.schedule(MINUTE, "* * * * *");
  await boss.schedule(DAILY, "15 4 * * *", null, { tz: "UTC" });
  await boss.work(MINUTE, async () => {
    await minuteTick();
  });
  await boss.work(DAILY, async () => {
    await dailyTick();
  });
  logger.info("Worker started");

  const stop = async () => {
    logger.info("Worker stopping");
    await boss.stop({ graceful: true, timeout: 20_000 });
    process.exit(0);
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
}

main().catch((error) => {
  logger.error({ err: error }, "Worker crashed");
  process.exit(1);
});
