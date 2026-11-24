// SPDX-License-Identifier: AGPL-3.0-only
import { z } from "zod";

export const POST_LIMIT = 10;
export const FEED_PAGE_SIZE = 20;
export const postInput = z.object({
  body: z.string().trim().min(1).max(280),
  kind: z.enum(["working", "done"]),
  groupId: z.union([z.uuid(), z.literal("")]).transform((v) => v || null),
  sessionId: z.union([z.uuid(), z.literal("")]).transform((v) => v || null),
});
export const postReportInput = z.object({
  postId: z.uuid(),
  reason: z.enum(["inappropriate", "harassment", "spam", "underage", "other"]),
  details: z.string().trim().max(1500),
});
export function feedCursor(raw?: string) {
  if (!raw) return null;
  const parsed = z.object({ at: z.iso.datetime(), id: z.uuid() }).safeParse(
    (() => {
      try {
        return JSON.parse(Buffer.from(raw, "base64url").toString());
      } catch {
        return null;
      }
    })(),
  );
  return parsed.success ? parsed.data : null;
}
