import { z } from "zod";

export const subjectSchema = z
  .object({
    name: z.string().trim().min(1).max(60),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  })
  .strict();

export const subjectPatchSchema = subjectSchema
  .partial()
  .extend({ archived: z.boolean().optional() })
  .strict();

export type SubjectInput = z.infer<typeof subjectSchema>;
export type SubjectPatch = z.infer<typeof subjectPatchSchema>;
