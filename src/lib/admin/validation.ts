// SPDX-License-Identifier: AGPL-3.0-only
import { z } from "zod";

export const utcDate = z.iso
  .date()
  .transform((value) => new Date(`${value}T00:00:00.000Z`));
export const challengeInput = z
  .object({
    id: z.union([z.literal(""), z.uuid()]),
    title: z.string().trim().min(2).max(160),
    slug: z
      .string()
      .trim()
      .min(2)
      .max(160)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    description: z.string().trim().max(4000),
    startsAt: utcDate,
    endsAt: utcDate,
    goalType: z.enum(["sessions", "minutes"]),
    goalValue: z.coerce.number().positive().max(1000000),
  })
  .refine((v) => v.endsAt > v.startsAt)
  .refine((v) =>
    v.goalType === "minutes"
      ? Math.abs(v.goalValue * 60 - Math.round(v.goalValue * 60)) < 1e-8
      : Number.isInteger(v.goalValue),
  );
export const licenseInput = z.object({
  id: z.uuid(),
  plusSeats: z.coerce.number().int().min(0).max(10000),
  licenseUntil: z.union([z.literal("").transform(() => null), utcDate]),
});
export function slugFromTitle(title: string) {
  return title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
