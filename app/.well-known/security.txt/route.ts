// SPDX-License-Identifier: AGPL-3.0-only
import { getEnv } from "@/src/config/env";
import { adminEmails } from "@/src/config/app";
import { generateSecurityTxt } from "@/src/lib/security/security-txt";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const env = getEnv();
  const content = generateSecurityTxt({
    contact: env.SECURITY_CONTACT,
    adminEmails: adminEmails(),
    appUrl: env.APP_URL,
    now: new Date(),
  });

  return new Response(content, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
