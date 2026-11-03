// Tiny job scheduler. Runs as its own container from the app
// image, calls the app's idempotent cron endpoints over the private network
// every 15 minutes and holds no database credentials of its own.
const target = (process.env.SCHEDULER_TARGET || "http://app:3000").replace(
  /\/$/,
  "",
);
const secret = process.env.CRON_SECRET;
const INTERVAL_MS = 15 * 60 * 1000;
const FREQUENT = ["review-digest", "weekly-report", "streak-nudge"];
let lastCleanupDay = "";
let stopping = false;

function log(level, message, extra = {}) {
  console.log(
    JSON.stringify({
      level,
      time: new Date().toISOString(),
      msg: message,
      ...extra,
    }),
  );
}

async function call(job) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(`${target}/api/cron/${job}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${secret}` },
        signal: AbortSignal.timeout(5 * 60 * 1000),
      });
      const body = await response.json().catch(() => ({}));
      log(response.ok ? "info" : "warn", "job finished", {
        job,
        status: response.status,
        result: body.result,
      });
      if (response.ok || response.status < 500) return;
    } catch (error) {
      log("warn", "job request failed", { job, attempt, error: error?.name });
    }
    await new Promise((r) => setTimeout(r, attempt * 10_000));
  }
}

async function tick() {
  for (const job of FREQUENT) if (!stopping) await call(job);
  const day = new Date().toISOString().slice(0, 10);
  if (!stopping && day !== lastCleanupDay) {
    await call("cleanup");
    lastCleanupDay = day;
  }
}

/** Waits until the next quarter hour so ticks line up with reminder times. */
function msToNextQuarter(now = Date.now()) {
  return INTERVAL_MS - (now % INTERVAL_MS) + 5_000;
}

async function main() {
  if (!secret) {
    log("warn", "CRON_SECRET is not set; scheduler is idle");
    await new Promise(() => {});
  }
  log("info", "scheduler started", { target });
  await tick();
  while (!stopping) {
    await new Promise((r) => setTimeout(r, msToNextQuarter()));
    if (!stopping) await tick();
  }
}

for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => {
    stopping = true;
    log("info", "scheduler stopping");
    process.exit(0);
  });

main();
