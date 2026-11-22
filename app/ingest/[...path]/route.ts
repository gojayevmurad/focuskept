// SPDX-License-Identifier: AGPL-3.0-only
import { getEnv } from "@/src/config/env";

export const dynamic = "force-dynamic";

const SAFE_REQUEST_HEADERS = [
  "content-type",
  "content-encoding",
  "user-agent",
  "accept",
  "accept-encoding",
];

export async function GET(
  req: Request,
  ctx: { params: Promise<{ path: string[] }> },
) {
  return forward(req, ctx);
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ path: string[] }> },
) {
  return forward(req, ctx);
}

export function resolveTargetUrl(
  pathSegments: string[],
  search: string,
  envHost = getEnv().POSTHOG_HOST || "https://us.i.posthog.com",
  envAssetsHost = getEnv().POSTHOG_ASSETS_HOST || "https://us-assets.i.posthog.com",
): string {
  const isStatic = pathSegments[0] === "static";
  const baseHost = isStatic ? envAssetsHost : envHost;
  const subpath = pathSegments.join("/");
  return `${baseHost.replace(/\/+$/, "")}/${subpath}${search}`;
}

export function filterSafeHeaders(headers: Headers): Headers {
  const safe = new Headers();
  for (const name of SAFE_REQUEST_HEADERS) {
    const val = headers.get(name);
    if (val) safe.set(name, val);
  }
  const clientIp =
    headers.get("cf-connecting-ip") || headers.get("x-forwarded-for");
  if (clientIp) {
    safe.set("x-forwarded-for", clientIp);
  }
  return safe;
}

async function forward(
  req: Request,
  ctx: { params: Promise<{ path: string[] }> },
) {
  try {
    const { path } = await ctx.params;
    const url = new URL(req.url);
    const targetUrl = resolveTargetUrl(path, url.search);

    const safeHeaders = filterSafeHeaders(req.headers);
    const isPost = req.method === "POST";

    const response = await fetch(targetUrl, {
      method: req.method,
      headers: safeHeaders,
      body: isPost ? req.body : undefined,
      // @ts-expect-error duplex is required by Node fetch for streaming bodies
      duplex: isPost ? "half" : undefined,
      signal: AbortSignal.timeout(10000),
    });

    const resHeaders = new Headers();
    const contentType = response.headers.get("content-type");
    if (contentType) resHeaders.set("content-type", contentType);
    const contentEncoding = response.headers.get("content-encoding");
    if (contentEncoding) resHeaders.set("content-encoding", contentEncoding);
    const cacheControl = response.headers.get("cache-control");
    if (cacheControl) resHeaders.set("cache-control", cacheControl);

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: resHeaders,
    });
  } catch {
    return new Response(JSON.stringify({ error: "Ingest proxy failure" }), {
      status: 502,
      headers: { "content-type": "application/json" },
    });
  }
}
