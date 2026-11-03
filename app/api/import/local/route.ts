import { limitOrReject, readJson, requireApiUser } from "@/src/lib/api";
import { withRequestLogging } from "@/src/lib/security/request";
import { IMPORT_MAX_BYTES, importSchema } from "@/src/features/import/schema";
import { importLocalData } from "@/src/features/import/server";

/** Imports anonymous on-device data into the signed-in account (idempotent). */
export const POST = withRequestLogging(async (request) => {
  const user = await requireApiUser(request);
  if (user instanceof Response) return user;
  const limited = await limitOrReject(`import:${user.id}`, 10, 3600);
  if (limited) return limited;
  const payload = await readJson(request, importSchema, IMPORT_MAX_BYTES);
  if (payload instanceof Response) return payload;
  return Response.json(await importLocalData(user.id, payload));
}, "import-local");
