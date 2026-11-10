import "server-only";

import type Stripe from "stripe";
import type { Plan } from "@/generated/prisma/client";
import { getStripeClient, getStripePriceId, isStripeLiveMode } from "./stripe";

export function stripeId(value: string | { id: string } | null): string | null {
  return typeof value === "string" ? value : value?.id ?? null;
}

export function isTerminalSubscription(subscription: Stripe.Subscription): boolean {
  return subscription.status === "canceled" || subscription.status === "incomplete_expired";
}

export async function listCustomerSubscriptions(customerId: string) {
  const live = isStripeLiveMode();
  const subscriptions: Stripe.Subscription[] = [];
  for await (const subscription of getStripeClient().subscriptions.list({ customer: customerId, status: "all", limit: 100 })) {
    if (subscription.livemode === live && stripeId(subscription.customer) === customerId) {
      subscriptions.push(subscription);
    }
  }
  return subscriptions;
}

export function projectSubscription(subscriptions: Stripe.Subscription[]) {
  const prices = new Set([getStripePriceId("monthly"), getStripePriceId("yearly")]);
  const current = subscriptions.filter((subscription) => !isTerminalSubscription(subscription));
  const empty = { plan: "FREE" as Plan, stripeSubscriptionId: null, subscriptionStatus: null, currentPeriodEnd: null };
  if (current.length > 1) {
    console.error("Multiple current Stripe subscriptions for a billing customer.");
    return { ...empty, subscriptionStatus: "billing_conflict" };
  }
  const [subscription] = current;
  if (!subscription) return empty;
  const [item] = subscription.items.data;
  if (subscription.items.has_more || subscription.items.data.length !== 1 || item.quantity !== 1 || !prices.has(item.price.id)) {
    console.error("Unexpected Stripe subscription items for a billing customer.");
    return { ...empty, subscriptionStatus: "billing_conflict" };
  }
  const plan: Plan = subscription.status === "active" ? "PRO" : "FREE";
  return {
    plan,
    stripeSubscriptionId: subscription.id,
    subscriptionStatus: subscription.status,
    currentPeriodEnd: new Date(item.current_period_end * 1000),
  };
}
