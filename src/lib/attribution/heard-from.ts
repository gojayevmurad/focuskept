// SPDX-License-Identifier: AGPL-3.0-only
import { z } from "zod";
import { HEARD_FROM_OPTIONS } from "./types";

export const heardFromInput = z
  .object({
    heardFrom: z.enum(HEARD_FROM_OPTIONS).optional(),
    heardFromOther: z
      .string()
      .transform((text) =>
        text
          .replace(/\p{Cc}/gu, "")
          .trim()
          .slice(0, 60)
          .trim(),
      )
      .pipe(z.string().max(60))
      .optional(),
  })
  .transform(({ heardFrom, heardFromOther }) => ({
    ...(heardFrom ? { heardFrom } : {}),
    ...(heardFrom === "other" && heardFromOther ? { heardFromOther } : {}),
  }));
