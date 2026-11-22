// SPDX-License-Identifier: AGPL-3.0-only
import "server-only";
import { getEnv } from "@/src/config/env";

export type IndexNowResult =
  | { success: true; status: number; count: number }
  | {
      success: false;
      reason: "disabled" | "empty" | "error";
      status?: number;
      error?: string;
    };

export async function submitIndexNow(urls: string[]): Promise<IndexNowResult> {
  const env = getEnv();
  const key = env.INDEXNOW_KEY;
  if (!key) {
    return { success: false, reason: "disabled" };
  }
  if (!urls || urls.length === 0) {
    return { success: false, reason: "empty" };
  }

  const host = new URL(env.APP_URL).hostname;
  const keyLocation = new URL("/indexnow-key.txt", env.APP_URL).toString();

  const payload = {
    host,
    key,
    keyLocation,
    urlList: urls,
  };

  try {
    const response = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok && response.status !== 202) {
      return {
        success: false,
        reason: "error",
        status: response.status,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    return {
      success: true,
      status: response.status,
      count: urls.length,
    };
  } catch (err) {
    return {
      success: false,
      reason: "error",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
