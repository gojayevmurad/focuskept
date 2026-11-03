export type SubscriptionState = {
  status: string;
  current_period_end: string;
  product_id: string;
};
export function activeSubscription(
  subscriptions: SubscriptionState[],
  products: string[],
  now = new Date(),
) {
  return subscriptions.some(
    (s) =>
      s.status === "active" &&
      products.includes(s.product_id) &&
      new Date(s.current_period_end) > now,
  );
}
export function canUsePro(
  record: { pro: boolean; validUntil: Date } | undefined,
  now = new Date(),
) {
  return !!record?.pro && record.validUntil > now;
}
