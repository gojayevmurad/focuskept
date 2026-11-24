// SPDX-License-Identifier: AGPL-3.0-only
import { z } from "zod";
export const hostApplicationInput = z.object({
  pitch: z.string().trim().min(20).max(800),
  audienceUrl: z.union([
    z.literal(""),
    z.url({ protocol: /^https?$/ }).max(300),
  ]),
});
export const hostedSessionInput = z.object({
  startAt: z.iso.datetime(),
  duration: z.coerce
    .number()
    .pipe(z.union([z.literal(25), z.literal(50), z.literal(75)])),
  title: z.string().trim().min(3).max(80),
  capacity: z.coerce.number().int().min(2).max(9),
});
