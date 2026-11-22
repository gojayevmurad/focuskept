// SPDX-License-Identifier: AGPL-3.0-only
import "server-only";
import { getEnv } from "@/src/config/env";

export function Verification() {
  const env = getEnv();
  const google = env.GOOGLE_SITE_VERIFICATION;
  const bing = env.BING_SITE_VERIFICATION;

  if (!google && !bing) return null;

  return (
    <>
      {google && <meta name="google-site-verification" content={google} />}
      {bing && <meta name="msvalidate.01" content={bing} />}
    </>
  );
}
