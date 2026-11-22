// SPDX-License-Identifier: AGPL-3.0-only
import { buildLlmsFullTxt } from "@/src/lib/seo/llmstxt";

export const dynamic = "force-dynamic";

export async function GET() {
  const content = await buildLlmsFullTxt();
  return new Response(content, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control":
        "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
