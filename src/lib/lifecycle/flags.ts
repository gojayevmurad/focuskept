// SPDX-License-Identifier: AGPL-3.0-only
import "server-only";
import { PostHog } from "posthog-node";

export type FeatureFlagValue = string | boolean;

/**
 * Reads a PostHog feature flag server-side for an identified user.
 * Returns the fallback value if PostHog analytics is unconfigured, disabled,
 * or if evaluation fails or times out.
 *
 * Running flag evaluation on the server eliminates client-side UI flicker.
 */
export async function getFeatureFlag(
  distinctId: string | null | undefined,
  flagKey: string,
  fallback: FeatureFlagValue = false,
  options?: {
    personProperties?: Record<string, string | number | boolean>;
    onlyEvaluateLocally?: boolean;
    timeoutMs?: number;
  },
): Promise<FeatureFlagValue> {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key || !distinctId) {
    return fallback;
  }

  const client = new PostHog(key, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
    flushAt: 1,
    flushInterval: 0,
  });

  const timeoutMs = options?.timeoutMs ?? 1500;

  try {
    const flagPromise = client.getFeatureFlag(flagKey, distinctId, {
      personProperties: options?.personProperties,
      onlyEvaluateLocally: options?.onlyEvaluateLocally,
    });

    const timeoutPromise = new Promise<undefined>((resolve) =>
      setTimeout(() => resolve(undefined), timeoutMs),
    );

    const result = await Promise.race([flagPromise, timeoutPromise]);
    if (result === undefined || result === null) {
      return fallback;
    }
    return result as FeatureFlagValue;
  } catch {
    return fallback;
  } finally {
    try {
      await client.shutdown();
    } catch {}
  }
}

/**
 * Returns true if a boolean feature flag is enabled for the identified user.
 */
export async function isFeatureEnabled(
  distinctId: string | null | undefined,
  flagKey: string,
  fallback = false,
  options?: {
    personProperties?: Record<string, string | number | boolean>;
  },
): Promise<boolean> {
  const value = await getFeatureFlag(distinctId, flagKey, fallback, options);
  return Boolean(value);
}
