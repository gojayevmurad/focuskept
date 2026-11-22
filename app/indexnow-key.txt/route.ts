// SPDX-License-Identifier: AGPL-3.0-only
import { getEnv } from "@/src/config/env";

export const dynamic = "force-dynamic";

export async function GET() {
  const env = getEnv();
  const key = env.INDEXNOW_KEY;
  if (!key) {
    return new Response("Not Found", { status: 404 });
  }
  return new Response(key, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
