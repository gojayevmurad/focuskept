import { z } from "zod";
import { apiError, limitOrReject, requireApiUser } from "@/src/lib/api";
import { withRequestLogging } from "@/src/lib/security/request";
import { CSV_COLUMNS, exportAll } from "@/src/features/export/server";
import { toCsv } from "@/src/features/export/csv";

const query = z.union([
  z.object({ format: z.literal("json") }),
  z.object({
    format: z.literal("csv"),
    type: z.enum(["sessions", "cards", "reviews"]),
  }),
]);

/** Data export for every plan: JSON (everything) or CSV per table. */
export const GET = withRequestLogging(async (request) => {
  const user = await requireApiUser(request);
  if (user instanceof Response) return user;
  const parsed = query.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (!parsed.success) return apiError(400, "invalid_request");
  const limited = await limitOrReject(`export:${user.id}`, 20, 3600);
  if (limited) return limited;
  const data = await exportAll(user.id);
  const stamp = new Date().toISOString().slice(0, 10);
  const headers = {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  };
  if (parsed.data.format === "json")
    return new Response(JSON.stringify(data, null, 2), {
      headers: {
        ...headers,
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="focuskept-export-${stamp}.json"`,
      },
    });
  const type = parsed.data.type;
  const columns = [...CSV_COLUMNS[type]];
  const rows = (
    type === "sessions"
      ? data.sessions
      : type === "cards"
        ? data.cards
        : data.reviews
  ) as Record<string, unknown>[];
  return new Response(toCsv(columns, rows), {
    headers: {
      ...headers,
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="focuskept-${type}-${stamp}.csv"`,
    },
  });
}, "export");
