import "server-only";

import type { CheckoutStatus } from "@/components/billing/BillingPanel";
import { getStripeClient, isStripeLiveMode } from "./stripe";
import { stripeId } from "./subscriptions";

interface BillingDetails {
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  plan: "FREE" | "PRO";
}

export async function checkoutReturnStatus(details: BillingDetails, checkout: unknown, id: unknown): Promise<CheckoutStatus | undefined> {
  if (checkout === "canceled") return "canceled";
  if (checkout !== "success") return;
  if (!details.stripeCustomerId || typeof id !== "string" || !/^cs_(?:test|live)_[A-Za-z0-9]{1,180}$/.test(id)) return "failed";
  try {
    const session = await getStripeClient().checkout.sessions.retrieve(id);
    if (session.livemode !== isStripeLiveMode() || session.mode !== "subscription" ||
        stripeId(session.customer) !== details.stripeCustomerId || session.status !== "complete") {
      return "failed";
    }
    return details.plan === "PRO" && stripeId(session.subscription) === details.stripeSubscriptionId ? "confirmed" : "pending";
  } catch {
    return "failed";
  }
}

export async function billingCancellationDate(details: BillingDetails): Promise<string | null> {
  if (details.plan !== "PRO" || !details.stripeCustomerId || !details.stripeSubscriptionId) return null;
  try {
    const subscription = await getStripeClient().subscriptions.retrieve(details.stripeSubscriptionId);
    if (subscription.livemode !== isStripeLiveMode() || stripeId(subscription.customer) !== details.stripeCustomerId) return null;
    const end = subscription.cancel_at ?? (subscription.cancel_at_period_end ? subscription.items.data[0]?.current_period_end : null);
    return end ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(end * 1000) : null;
  } catch {
    return null;
  }
}
