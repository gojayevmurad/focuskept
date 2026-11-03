import "server-only";
import { createPolar } from "@polar-sh/sdk/2026-10";
import { getEnv } from "@/src/config/env";
export function polar() {
  const env = getEnv();
  if (!env.POLAR_ACCESS_TOKEN) throw new Error("Billing is not configured");
  return createPolar({
    accessToken: env.POLAR_ACCESS_TOKEN,
    environment: env.POLAR_ENVIRONMENT,
    timeout: 10,
  });
}
export function products() {
  const env = getEnv();
  return {
    monthly: env.POLAR_MONTHLY_PRODUCT_ID,
    yearly: env.POLAR_YEARLY_PRODUCT_ID,
    lifetime: env.POLAR_LIFETIME_PRODUCT_ID,
  };
}
