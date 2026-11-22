// SPDX-License-Identifier: AGPL-3.0-only
import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/src/lib/db";
import { booking, notificationLog, profile, user } from "@/src/lib/db/schema";
import { getAppConfig } from "@/src/config/app";
import { sendEmail } from "@/src/lib/email/send";
import { logger } from "@/src/lib/logger";
import { EmailLayout } from "./email-layout";
import { sendPush } from "./push";

type Channel = "email" | "push";

/** Runs `send` once per (user, kind, ref, channel). Failed sends can be retried. */
export async function once(
  userId: string,
  kind: string,
  refId: string,
  channel: Channel,
  send: () => Promise<unknown>,
) {
  const id = crypto.randomUUID();
  const inserted = await db()
    .insert(notificationLog)
    .values({ id, userId, kind, refId, channel })
    .onConflictDoNothing()
    .returning({ id: notificationLog.id });
  if (!inserted.length) return false;
  try {
    await send();
    return true;
  } catch (error) {
    await db().delete(notificationLog).where(eq(notificationLog.id, id));
    logger.warn({ kind, channel, err: error }, "Notification failed");
    return false;
  }
}

async function recipient(userId: string) {
  const [row] = await db()
    .select({
      email: user.email,
      name: profile.displayName,
      timezone: profile.timezone,
      locale: profile.locale,
      emailReminders: profile.emailReminders,
      pushReminders: profile.pushReminders,
    })
    .from(user)
    .innerJoin(profile, eq(profile.userId, user.id))
    .where(eq(user.id, userId));
  return row;
}

export function formatWhen(date: Date, timeZone: string, locale = "en") {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

function footer(app: ReturnType<typeof getAppConfig>) {
  return `You get this because you have an account on ${app.name}. Change email settings any time in Settings.`;
}

async function email(
  userId: string,
  kind: string,
  refId: string,
  build: (r: NonNullable<Awaited<ReturnType<typeof recipient>>>) => {
    subject: string;
    heading: string;
    lines: string[];
    cta: { label: string; url: string };
  },
  options: { respectReminderSetting?: boolean } = {},
) {
  const r = await recipient(userId);
  if (!r) return;
  if (options.respectReminderSetting && !r.emailReminders) return;
  const app = getAppConfig();
  const content = build(r);
  await once(userId, kind, refId, "email", () =>
    sendEmail({
      to: r.email,
      subject: content.subject,
      kind,
      url: content.cta.url,
      text: [
        content.heading,
        ...content.lines,
        `${content.cta.label}: ${content.cta.url}`,
      ].join("\n\n"),
      react: EmailLayout({
        appName: app.name,
        preview: content.lines[0] ?? content.heading,
        heading: content.heading,
        lines: content.lines,
        cta: content.cta,
        footer: footer(app),
      }),
    }),
  );
}

async function push(
  userId: string,
  kind: string,
  refId: string,
  message: { title: string; body: string; url: string },
) {
  const r = await recipient(userId);
  if (!r?.pushReminders) return;
  await once(userId, kind, refId, "push", () =>
    sendPush(userId, { ...message, tag: kind }),
  );
}

async function bookingRow(bookingId: string) {
  const [row] = await db()
    .select()
    .from(booking)
    .where(eq(booking.id, bookingId));
  return row;
}

export async function bookingConfirmed(bookingId: string) {
  const b = await bookingRow(bookingId);
  if (!b) return;
  const app = getAppConfig();
  await email(b.userId, "booking_confirmed", b.id, (r) => ({
    subject: `Booked: ${formatWhen(b.startAt, r.timezone, r.locale)}`,
    heading: "Your session is booked",
    lines: [
      `${b.durationMin} minutes, ${formatWhen(b.startAt, r.timezone, r.locale)}.`,
      "We pair you with a partner five minutes before the start. Have one clear task ready to share.",
      "You can cancel for free up to an hour before.",
    ],
    cta: { label: "See your calendar", url: `${app.url}/book` },
  }));
}

export async function sessionReminder(bookingId: string) {
  const b = await bookingRow(bookingId);
  if (!b || !["booked", "matched"].includes(b.status)) return;
  const app = getAppConfig();
  const url = b.sessionId
    ? `${app.url}/session/${b.sessionId}`
    : `${app.url}/dashboard`;
  await email(
    b.userId,
    "reminder",
    b.id,
    (r) => ({
      subject: `Starting in 10 minutes`,
      heading: "Your session starts soon",
      lines: [
        `${b.durationMin} minutes at ${formatWhen(b.startAt, r.timezone, r.locale)}.`,
        "Grab water, close what you don't need, and pick the one thing you'll work on.",
      ],
      cta: { label: "Open the session", url },
    }),
    { respectReminderSetting: true },
  );
  await push(b.userId, "reminder", b.id, {
    title: "Session in 10 minutes",
    body: "Pick the one thing you'll work on.",
    url,
  });
}

export async function partnerChanged(bookingId: string) {
  const b = await bookingRow(bookingId);
  if (!b) return;
  const app = getAppConfig();
  const ref = `${b.id}:${Date.now()}`;
  await push(b.userId, "partner_changed", ref, {
    title: "Your partner cancelled",
    body: "We're finding you someone new for the same time.",
    url: `${app.url}/dashboard`,
  });
  await email(b.userId, "partner_changed", ref, (r) => ({
    subject: "Your partner cancelled",
    heading: "We're finding you a new partner",
    lines: [
      `Your partner for ${formatWhen(b.startAt, r.timezone, r.locale)} cancelled.`,
      "Your booking stays in place and we'll pair you with someone else before the start.",
    ],
    cta: { label: "Open your dashboard", url: `${app.url}/dashboard` },
  }));
}

export async function fallbackOffered(bookingId: string) {
  const b = await bookingRow(bookingId);
  if (!b) return;
  const app = getAppConfig();
  await push(b.userId, "fallback", b.id, {
    title: "No partner yet",
    body: "Join the open room or move to the next slot.",
    url: `${app.url}/dashboard`,
  });
}

export async function directInvitation(input: {
  toUserId: string;
  fromName: string;
  fromUsername: string;
  startAt: Date;
  durationMin: number;
  bookingId: string;
}) {
  const app = getAppConfig();
  const url = `${app.url}/u/${input.fromUsername}?start=${input.startAt.toISOString()}&duration=${input.durationMin}`;
  await email(input.toUserId, "invitation", input.bookingId, (r) => ({
    subject: `${input.fromName} wants to focus with you`,
    heading: `${input.fromName} booked a session with you`,
    lines: [
      `${input.durationMin} minutes, ${formatWhen(input.startAt, r.timezone, r.locale)}.`,
      "Accept to be paired together. If you can't make it, they'll be paired with someone else.",
    ],
    cta: { label: "Accept", url },
  }));
}

export async function referralRewarded(
  userId: string,
  refId: string,
  code: string | null,
) {
  const app = getAppConfig();
  await email(userId, "referral_reward", refId, () => ({
    subject: `A free month of ${app.name} Plus`,
    heading: "Thanks for bringing a friend",
    lines: code
      ? [
          `Your friend finished their first session, so you both get a month of Plus.`,
          `Your code: ${code}. It's applied automatically at checkout.`,
        ]
      : [
          "Your friend finished their first session, so you both get a month of Plus. It's been applied to your subscription.",
        ],
    cta: { label: "See your plan", url: `${app.url}/billing` },
  }));
}

export async function notifyAdmins(
  kind: string,
  refId: string,
  heading: string,
  lines: string[],
  path: string,
) {
  const app = getAppConfig();
  const admins = await db()
    .select({ id: profile.userId })
    .from(profile)
    .where(and(eq(profile.role, "admin")));
  for (const a of admins)
    await email(a.id, kind, refId, () => ({
      subject: heading,
      heading,
      lines,
      cta: { label: "Open admin", url: `${app.url}${path}` },
    }));
}

export {
  sendWelcomeEmail,
  sendNudgeFirstBooking,
  sendFirstSessionTips,
  sendAfterFirstSession,
  sendWinBack,
  sendWeeklySummary,
  processLifecycleEmails,
} from "@/src/lib/lifecycle/scheduler";
