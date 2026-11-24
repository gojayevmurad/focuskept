// SPDX-License-Identifier: AGPL-3.0-only
import { matchDueSlots, offerFallbacks } from "@/src/lib/matching/run";
import { expireMatchRequests } from "@/src/lib/matching/instant";
import {
  bookingsNeedingReminder,
  completeEndedSessions,
  endAbandonedSessions,
} from "@/src/lib/sessions/lifecycle";
import { sessionReminder } from "@/src/lib/notifications";
import { retryReferralRewards } from "@/src/lib/growth/referrals";
import { REMINDER_LEAD_MIN } from "@/src/lib/scheduling/slots";
import { updateHostPerks } from "@/src/lib/hosts/perks";
import { checkVideoUsage } from "@/src/lib/video/usage";
import { cleanup, heartbeat } from "./maintenance";
import { logger } from "@/src/lib/logger";
import { processLifecycleEmails } from "@/src/lib/lifecycle/scheduler";

/** Everything time-based that must happen within the minute. Each step is idempotent. */
export async function minuteTick(now = new Date()) {
  const expiredMatches = await expireMatchRequests(now);
  const matched = await matchDueSlots(now);
  const fallbacks = await offerFallbacks(now);
  let reminders = 0;
  for (const b of await bookingsNeedingReminder(now, REMINDER_LEAD_MIN)) {
    await sessionReminder(b.id);
    reminders++;
  }
  const completed = await completeEndedSessions(now);
  const abandoned = await endAbandonedSessions(now);
  const lifecycle = await processLifecycleEmails(now);
  await heartbeat(now);
  const summary = {
    expiredMatches,
    matched,
    fallbacks,
    reminders,
    lifecycle,
    ...completed,
    abandoned: abandoned.ended,
  };
  if (
    matched ||
    fallbacks ||
    completed.ended ||
    abandoned.ended ||
    lifecycle > 0
  )
    logger.info(summary, "Tick");
  return summary;
}

export async function dailyTick(now = new Date()) {
  await retryReferralRewards();
  await updateHostPerks(now);
  await checkVideoUsage(now);
  await cleanup(now);
}
