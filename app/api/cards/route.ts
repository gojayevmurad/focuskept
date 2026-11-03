import { z } from "zod";
import {
  apiError,
  limitOrReject,
  readJson,
  requireApiUser,
} from "@/src/lib/api";
import { withRequestLogging } from "@/src/lib/security/request";
import { cardCreateSchema } from "@/src/features/cards/schema";
import { createCardFromDraft, listCards } from "@/src/features/cards/server";
import { LimitError, cardAllowance } from "@/src/features/limits/server";

const filters = z.object({
  q: z.string().max(200).optional(),
  status: z.enum(["active", "archived"]).optional(),
  topic: z.string().max(200).optional(),
  sort: z.enum(["due", "new"]).optional(),
  cursor: z.string().max(200).optional(),
});

export const GET = withRequestLogging(async (request) => {
  const user = await requireApiUser(request);
  if (user instanceof Response) return user;
  const parsed = filters.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (!parsed.success) return apiError(400, "invalid_request");
  return Response.json(await listCards(user.id, parsed.data));
}, "cards");

export const POST = withRequestLogging(async (request) => {
  const user = await requireApiUser(request);
  if (user instanceof Response) return user;
  const limited = await limitOrReject(`cards:${user.id}`, 30, 60);
  if (limited) return limited;
  const input = await readJson(request, cardCreateSchema, 128 * 1024);
  if (input instanceof Response) return input;
  try {
    const card = await createCardFromDraft(user.id, input);
    return Response.json({ id: card.id, dueOn: card.dueOn }, { status: 201 });
  } catch (error) {
    if (!(error instanceof LimitError)) throw error;
    if (error.code === "not_found") return apiError(404, "not_found");
    return apiError(403, error.code, {
      allowance: await cardAllowance(user.id),
    });
  }
}, "cards");
