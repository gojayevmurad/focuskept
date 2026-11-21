import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/src/lib/db";
import { appConfig } from "@/src/lib/db/schema";
import { getEnv } from "@/src/config/env";
import { notifyAdmins } from "@/src/lib/notifications";
import { logger } from "@/src/lib/logger";

/**
 * Reads this month's Cloudflare Realtime egress from the GraphQL Analytics API
 * and emails admins once per month when it crosses VIDEO_USAGE_ALERT_GB.
 */
export async function checkVideoUsage(now = new Date()) {
  const env = getEnv();
  if (
    env.VIDEO_PROVIDER !== "cloudflare" ||
    !env.CLOUDFLARE_ACCOUNT_ID ||
    !env.CLOUDFLARE_ANALYTICS_TOKEN
  )
    return null;
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const query = `query($account: String!, $from: Date!, $to: Date!) {
    viewer { accounts(filter: { accountTag: $account }) {
      callsUsageAdaptiveGroups(limit: 1, filter: { date_geq: $from, date_leq: $to }) { sum { egressBytes } }
    } }
  }`;
  try {
    const response = await fetch(
      "https://api.cloudflare.com/client/v4/graphql",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.CLOUDFLARE_ANALYTICS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query,
          variables: {
            account: env.CLOUDFLARE_ACCOUNT_ID,
            from: start.toISOString().slice(0, 10),
            to: now.toISOString().slice(0, 10),
          },
        }),
        signal: AbortSignal.timeout(15_000),
      },
    );
    const json = (await response.json()) as {
      data?: {
        viewer?: {
          accounts?: {
            callsUsageAdaptiveGroups?: { sum?: { egressBytes?: number } }[];
          }[];
        };
      };
    };
    const bytes =
      json.data?.viewer?.accounts?.[0]?.callsUsageAdaptiveGroups?.[0]?.sum
        ?.egressBytes ?? 0;
    const gb = bytes / 1e9;
    const month = start.toISOString().slice(0, 7);
    const key = `video_usage_alert_${month}`;
    await db()
      .insert(appConfig)
      .values({
        key: "video_usage",
        value: { month, gb: Math.round(gb * 10) / 10 },
      })
      .onConflictDoUpdate({
        target: appConfig.key,
        set: { value: { month, gb: Math.round(gb * 10) / 10 } },
      });
    if (gb >= env.VIDEO_USAGE_ALERT_GB) {
      const [sent] = await db()
        .select()
        .from(appConfig)
        .where(eq(appConfig.key, key));
      if (!sent) {
        await db().insert(appConfig).values({ key, value: true });
        await notifyAdmins(
          "video_usage",
          month,
          `Video usage is at ${gb.toFixed(0)} GB this month`,
          [
            `Cloudflare Realtime egress reached ${gb.toFixed(1)} GB for ${month}.`,
            "The free allowance is 1,000 GB per month; after that it's billed per GB.",
          ],
          "/admin",
        );
      }
    }
    return gb;
  } catch (error) {
    logger.warn({ err: error }, "Video usage check failed");
    return null;
  }
}
