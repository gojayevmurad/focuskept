// SPDX-License-Identifier: AGPL-3.0-only
import type { JoinCredentials, VideoClient } from "../types";

export async function createVideoClient(
  credentials: JoinCredentials,
): Promise<VideoClient> {
  let client: VideoClient;
  switch (credentials.provider) {
    case "cloudflare":
      client = new (await import("./cloudflare")).CloudflareVideoClient();
      break;
    case "livekit":
      client = new (await import("./livekit")).LivekitVideoClient();
      break;
    case "none":
      client = new (await import("./none")).NoneVideoClient();
      break;
  }
  await client.join(credentials);
  return client;
}
