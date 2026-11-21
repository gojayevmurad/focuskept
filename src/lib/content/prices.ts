// SPDX-License-Identifier: AGPL-3.0-only
import "server-only";
import { getEnv } from "@/src/config/env";
import { polar, products } from "@/src/lib/billing/provider";
type Prices = { monthly: string; yearly: string };
let cached: { key: string; until: number; value: Prices | null } | undefined;
let pending: { key: string; value: Promise<Prices | null> } | undefined;
async function loadPrices(): Promise<Prices | null> {
  const env = getEnv();
  const ids = products();
  if (!env.POLAR_ACCESS_TOKEN || !ids.monthly || !ids.yearly) return null;
  const key = `${env.POLAR_ENVIRONMENT}:${ids.monthly}:${ids.yearly}`;
  if (cached?.key === key && cached.until > Date.now()) return cached.value;
  if (pending?.key === key) return pending.value;
  const fetchPrices = async (): Promise<Prices | null> => {
    try {
      const client = polar();
      const [monthly, yearly] = await Promise.all([
        client.products.get(ids.monthly!),
        client.products.get(ids.yearly!),
      ]);
      const format = (product: typeof monthly, interval: "month" | "year") => {
        if (
          product.is_archived ||
          !product.is_recurring ||
          product.recurring_interval !== interval ||
          product.recurring_interval_count !== 1
        )
          throw new Error("Unexpected billing interval");
        const price = product.prices.find(
          (price) => !price.is_archived && price.amount_type === "fixed",
        );
        if (!price || price.amount_type !== "fixed")
          throw new Error("No fixed price");
        const formatter = new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: price.price_currency.toUpperCase(),
        });
        const digits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
        return formatter.format(price.price_amount / 10 ** digits);
      };
      return {
        monthly: format(monthly, "month"),
        yearly: format(yearly, "year"),
      };
    } catch {
      return null;
    }
  };
  const value = fetchPrices();
  pending = { key, value };
  const result = await value;
  cached = { key, until: Date.now() + 10 * 60 * 1000, value: result };
  if (pending?.value === value) pending = undefined;
  return result;
}

export async function getPrices(): Promise<Prices | null> {
  try {
    return await loadPrices();
  } catch {
    return null;
  }
}
