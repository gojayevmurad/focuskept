import { z } from "zod";
import { isIsoDate } from "@/src/lib/dates";

export const TASK_STATUSES = ["todo", "doing", "done", "archived"] as const;
export const EISENHOWER = ["do", "schedule", "delegate", "delete"] as const;
export const SIZES_135 = ["big", "medium", "small"] as const;
export const SLOTS_135 = { big: 1, medium: 3, small: 5 } as const;
export const IVY_LEE_MAX = 6;

const isoDate = z.string().refine(isIsoDate);
const tag = z.string().trim().toLowerCase().min(1).max(32);

export const taskFields = {
  title: z.string().trim().min(1).max(200),
  notes: z.string().max(4000).nullable(),
  tags: z.array(tag).max(10),
  projectId: z.string().max(64).nullable(),
  status: z.enum(TASK_STATUSES),
  priority: z.number().int().min(1).max(4),
  eisenhower: z.enum(EISENHOWER).nullable(),
  size135: z.enum(SIZES_135).nullable(),
  plannedFor: isoDate.nullable(),
  ivyRank: z.number().int().min(1).max(IVY_LEE_MAX).nullable(),
  isFrogOn: isoDate.nullable(),
  sortOrder: z.number().int().min(-1_000_000).max(1_000_000),
  estimatedMinutes: z.number().int().min(1).max(1440).nullable(),
};

export const taskCreateSchema = z
  .object({
    ...taskFields,
    clientId: z.uuid().optional(),
  })
  .partial()
  .required({ title: true })
  .strict();

export const taskUpdateSchema = z.object(taskFields).partial().strict();

export type TaskCreate = z.infer<typeof taskCreateSchema>;
export type TaskUpdate = z.infer<typeof taskUpdateSchema>;

export const projectSchema = z
  .object({
    name: z.string().trim().min(1).max(60),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  })
  .strict();
