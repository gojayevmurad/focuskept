// SPDX-License-Identifier: AGPL-3.0-only
"use server";

import { z } from "zod";
import { and, eq, gt, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/src/lib/app-user";
import { db } from "@/src/lib/db";
import {
  booking,
  challenge,
  community,
  host,
  profile,
  report,
} from "@/src/lib/db/schema";
import { createBooking } from "@/src/lib/bookings/service";
import { challengeInput, licenseInput } from "@/src/lib/admin/validation";
import { suspendUser } from "@/src/lib/admin/mutations";

export type ActionState = {
  error?: "invalid" | "failed" | "selfRole" | "notFound" | "houseRequired";
  ok?: boolean;
};
const id = z.string().trim().min(1).max(200);
const command = z.discriminatedUnion("intent", [
  z.object({
    intent: z.literal("user"),
    id,
    operation: z.enum([
      "suspend",
      "unsuspend",
      "makeAdmin",
      "removeAdmin",
      "houseOn",
      "houseOff",
    ]),
  }),
  z.object({
    intent: z.literal("report"),
    id: z.uuid(),
    operation: z.enum(["dismiss", "action"]),
  }),
  z.object({
    intent: z.literal("host"),
    id,
    operation: z.enum(["approve", "reject", "suspend", "unsuspend"]),
  }),
  z.object({ intent: z.literal("challengeSave"), ...challengeInput.shape }),
  z.object({ intent: z.literal("challengeDelete"), id: z.uuid() }),
  z.object({ intent: z.literal("groupSave"), ...licenseInput.shape }),
  z.object({
    intent: z.literal("groupDelete"),
    id: z.uuid(),
    confirm: z.literal("DELETE"),
  }),
  z.object({
    intent: z.literal("house"),
    startAt: z.iso.datetime(),
    durationMin: z.coerce
      .number()
      .pipe(z.union([z.literal(25), z.literal(50), z.literal(75)])),
  }),
]);

export async function adminAction(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  const current = await requireAdmin();
  const parsed = command.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "invalid" };
  const input = parsed.data;
  try {
    switch (input.intent) {
      case "user": {
        if (input.operation === "removeAdmin" && input.id === current.user.id)
          return { error: "selfRole" };
        if (input.operation === "suspend") await suspendUser(input.id);
        else {
          const changes =
            input.operation === "unsuspend"
              ? { suspendedAt: null }
              : input.operation === "makeAdmin"
                ? { role: "admin" }
                : input.operation === "removeAdmin"
                  ? { role: "user" }
                  : { isHouse: input.operation === "houseOn" };
          await db()
            .update(profile)
            .set({ ...changes, updatedAt: new Date() })
            .where(eq(profile.userId, input.id));
        }
        break;
      }
      case "report": {
        const [resolved] = await db().transaction(async (tx) => {
          const [row] = await tx
            .select()
            .from(report)
            .where(and(eq(report.id, input.id), eq(report.status, "open")))
            .for("update");
          if (!row) return [];
          if (input.operation === "action")
            await tx
              .update(profile)
              .set({ suspendedAt: new Date(), updatedAt: new Date() })
              .where(eq(profile.userId, row.targetId));
          return tx
            .update(report)
            .set({
              status: input.operation === "dismiss" ? "dismissed" : "actioned",
              resolvedBy: current.user.id,
              resolvedAt: new Date(),
            })
            .where(eq(report.id, row.id))
            .returning({ targetId: report.targetId });
        });
        if (!resolved) return { error: "notFound" };
        if (input.operation === "action") await suspendUser(resolved.targetId);
        break;
      }
      case "host": {
        const expected =
          input.operation === "approve" || input.operation === "reject"
            ? "applied"
            : input.operation === "suspend"
              ? "approved"
              : "suspended";
        const status =
          input.operation === "reject"
            ? "rejected"
            : input.operation === "suspend"
              ? "suspended"
              : "approved";
        const rows = await db()
          .update(host)
          .set({
            status,
            ...(expected === "applied" ? { decidedAt: new Date() } : {}),
          })
          .where(and(eq(host.userId, input.id), eq(host.status, expected)))
          .returning({ id: host.userId });
        if (!rows.length) return { error: "notFound" };
        break;
      }
      case "challengeSave": {
        // Reparse the full schema to apply its date and goal refinements.
        const validated = challengeInput.safeParse(Object.fromEntries(form));
        if (!validated.success) return { error: "invalid" };
        const { id: challengeId, goalValue, ...fields } = validated.data;
        const values = {
          ...fields,
          goalValue:
            fields.goalType === "minutes"
              ? Math.round(goalValue * 60)
              : goalValue,
        };
        if (challengeId) {
          const rows = await db()
            .update(challenge)
            .set(values)
            .where(eq(challenge.id, challengeId))
            .returning({ id: challenge.id });
          if (!rows.length) return { error: "notFound" };
        } else
          await db()
            .insert(challenge)
            .values({
              ...values,
              id: crypto.randomUUID(),
              createdBy: current.user.id,
            });
        break;
      }
      case "challengeDelete": {
        const rows = await db()
          .delete(challenge)
          .where(
            and(eq(challenge.id, input.id), gt(challenge.startsAt, sql`now()`)),
          )
          .returning({ id: challenge.id });
        if (!rows.length) return { error: "notFound" };
        break;
      }
      case "groupSave": {
        const rows = await db()
          .update(community)
          .set({ plusSeats: input.plusSeats, licenseUntil: input.licenseUntil })
          .where(eq(community.id, input.id))
          .returning({ id: community.id });
        if (!rows.length) return { error: "notFound" };
        break;
      }
      case "groupDelete": {
        const rows = await db()
          .delete(community)
          .where(eq(community.id, input.id))
          .returning({ id: community.id });
        if (!rows.length) return { error: "notFound" };
        break;
      }
      case "house": {
        const [own] = await db()
          .select()
          .from(profile)
          .where(eq(profile.userId, current.user.id));
        if (!own?.isHouse) return { error: "houseRequired" };
        const startAt = new Date(input.startAt);
        if (startAt <= new Date() || startAt.getTime() > Date.now() + 86400000)
          return { error: "invalid" };
        const waiting = await db()
          .select({ userId: booking.userId })
          .from(booking)
          .where(
            and(
              eq(booking.startAt, startAt),
              eq(booking.durationMin, input.durationMin),
              eq(booking.kind, "pair"),
              eq(booking.status, "booked"),
            ),
          );
        if (waiting.length !== 1 || waiting[0].userId === current.user.id)
          return { error: "notFound" };
        await createBooking({
          userId: current.user.id,
          timeZone: own.timezone,
          startAt,
          durationMin: input.durationMin,
        });
        break;
      }
    }
  } catch {
    return { error: "failed" };
  }
  revalidatePath("/[locale]/admin", "layout");
  if (input.intent.startsWith("challenge"))
    revalidatePath("/[locale]/challenges", "layout");
  if (input.intent.startsWith("group"))
    revalidatePath("/[locale]/groups", "layout");
  if (input.intent === "host") revalidatePath("/[locale]/hosting", "page");
  return { ok: true };
}
