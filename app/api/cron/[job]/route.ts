import { getEnv } from "@/src/config/env";
import { withRequestLogging } from "@/src/lib/security/request";
import { rateLimit } from "@/src/lib/security/rate-limit";
import { bearerMatches } from "@/src/features/notifications/tokens";
import {
  runCleanup,
  runReviewDigest,
  runStreakNudge,
  runWeeklyReport,
} from "@/src/features/notifications/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const jobs = {
  "review-digest": () => runReviewDigest(),
  "weekly-report": () => runWeeklyReport(),
  "streak-nudge": () => runStreakNudge(),
  cleanup: () => runCleanup(),
} as const;

/** Idempotent background jobs, called every 15 minutes by the scheduler service. */
export async function POST(
  request: Request,
  ctx: { params: Promise<{ job: string }> },
) {
  return withRequestLogging(async (req) => {
    const secret = getEnv().CRON_SECRET;
    if (!secret)
      return Response.json({ error: "cron_disabled" }, { status: 503 });
    if (!bearerMatches(req.headers.get("authorization"), secret))
      return new Response(null, { status: 401 });
    const { job } = await ctx.params;
    if (!(job in jobs)) return new Response(null, { status: 404 });
    const limited = await rateLimit(`cron:${job}`, 12, 60);
    if (!limited.allowed) return new Response(null, { status: 429 });
    return Response.json({
      job,
      result: await jobs[job as keyof typeof jobs](),
    });
  }, "cron")(request);
}
