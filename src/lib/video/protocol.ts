// SPDX-License-Identifier: AGPL-3.0-only
import { z } from "zod";

const mid = z
  .string()
  .min(1)
  .max(32)
  .regex(/^[A-Za-z0-9_-]+$/);
const name = z.string().min(1).max(256);
export const descriptionSchema = z.object({
  type: z.enum(["offer", "answer"]),
  sdp: z.string().min(1).max(100_000),
});
const offer = descriptionSchema.extend({ type: z.literal("offer") });
export const requestSchemas = {
  session: z.object({}).strict(),
  push: z
    .object({
      sessionDescription: offer,
      tracks: z
        .array(z.object({ mid, kind: z.enum(["audio", "video"]) }).strict())
        .min(1)
        .max(2)
        .refine(
          (tracks) =>
            new Set(tracks.map((t) => t.kind)).size === tracks.length &&
            new Set(tracks.map((t) => t.mid)).size === tracks.length,
        ),
    })
    .strict(),
  announce: z
    .object({
      tracks: z
        .object({
          audio: name.optional(),
          video: name.optional(),
        })
        .strict(),
    })
    .strict(),
  pull: z
    .object({
      targetUserId: name,
      trackNames: z
        .array(name)
        .min(1)
        .max(2)
        .refine((names) => new Set(names).size === names.length),
      lowQuality: z.boolean().optional(),
    })
    .strict(),
  renegotiate: z
    .object({
      sessionDescription: descriptionSchema.extend({
        type: z.literal("answer"),
      }),
    })
    .strict(),
  close: z
    .object({
      tracks: z.array(z.object({ mid }).strict()).min(1).max(128),
      sessionDescription: offer.optional(),
    })
    .strict(),
};
export type CloudflareAction = keyof typeof requestSchemas;
export const cloudflareResponseSchema = z.object({
  sessionId: z.string().min(1).optional(),
  sessionDescription: descriptionSchema.optional(),
  requiresImmediateRenegotiation: z.boolean().optional(),
  tracks: z
    .array(
      z.object({
        mid: mid.optional(),
        trackName: name.optional(),
        sessionId: z.string().optional(),
        errorCode: z.string().optional(),
        errorDescription: z.string().optional(),
      }),
    )
    .optional(),
});
export type CloudflareResponse = z.infer<typeof cloudflareResponseSchema>;
