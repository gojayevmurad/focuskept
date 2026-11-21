"use server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getLocale } from "next-intl/server";
import { db } from "@/src/lib/db";
import { profile } from "@/src/lib/db/schema";
import { requireAppUser } from "@/src/lib/app-user";
import { isUsernameTaken } from "@/src/lib/profiles";
import { isSegment, validateUsername } from "@/src/lib/profiles/rules";
import { isValidTimeZone } from "@/src/lib/scheduling/slots";
import { BookingFailure, createBooking } from "@/src/lib/bookings/service";
import { trackForUser } from "@/src/lib/analytics/product";
import { redirect } from "@/src/i18n/navigation";

const schema = z.object({
  displayName: z.string().trim().min(1).max(60),
  username: z.string().trim().max(24),
  timezone: z.string().refine(isValidTimeZone),
  goal: z.string().trim().max(200),
  segments: z.array(z.string().refine(isSegment)).max(8),
  age: z.literal("on"),
  startAt: z.string().datetime().optional().or(z.literal("")),
  duration: z.coerce.number().optional(),
});

export type OnboardingState = {
  error?:
    | "username_taken"
    | "username_format"
    | "username_reserved"
    | "age"
    | "invalid"
    | "booking";
};

export async function completeOnboarding(
  _prev: OnboardingState,
  form: FormData,
): Promise<OnboardingState> {
  const { user } = await requireAppUser(true);
  const parsed = schema.safeParse({
    displayName: form.get("displayName"),
    username: form.get("username"),
    timezone: form.get("timezone"),
    goal: form.get("goal") ?? "",
    segments: form.getAll("segments"),
    age: form.get("age"),
    startAt: form.get("startAt") ?? "",
    duration: form.get("duration") ?? undefined,
  });
  if (!parsed.success)
    return {
      error: parsed.error.issues.some((i) => i.path[0] === "age")
        ? "age"
        : "invalid",
    };
  const name = validateUsername(parsed.data.username);
  if (!name.ok)
    return {
      error:
        name.reason === "reserved" ? "username_reserved" : "username_format",
    };
  if (await isUsernameTaken(name.username, user.id))
    return { error: "username_taken" };

  await db()
    .update(profile)
    .set({
      displayName: parsed.data.displayName,
      username: name.username,
      timezone: parsed.data.timezone,
      goal: parsed.data.goal,
      segments: parsed.data.segments,
      birthdateConfirmed: true,
      ageConfirmedAt: new Date(),
      onboardedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(profile.userId, user.id));
  void trackForUser(user.id, "onboarding_completed", {
    segments: parsed.data.segments.length,
  });

  if (parsed.data.startAt) {
    try {
      await createBooking({
        userId: user.id,
        timeZone: parsed.data.timezone,
        startAt: new Date(parsed.data.startAt),
        durationMin: parsed.data.duration ?? 50,
      });
    } catch (error) {
      if (!(error instanceof BookingFailure)) throw error;
      redirect({ href: "/book?onboarded=1", locale: await getLocale() });
    }
  }
  redirect({ href: "/dashboard?welcome=1", locale: await getLocale() });
  return {};
}
