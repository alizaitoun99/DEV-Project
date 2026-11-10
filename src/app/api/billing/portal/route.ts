import { consumeAuthLimit } from "@/lib/auth-rate-limit";
import { loadBillingOwner } from "@/lib/billing/checkout";
import { billingPost, billingResponse } from "@/lib/billing/requests";
import { getBillingOrigin, getStripeClient } from "@/lib/billing/stripe";

export async function POST(request: Request) {
  return billingPost(request, async (ownerId) => {
    const owner = await loadBillingOwner(ownerId);
    if (!owner?.stripeCustomerId) return billingResponse({ error: "No Stripe billing account exists yet." }, 404);
    await consumeAuthLimit(`billing:portal:${ownerId}`, 12, 60 * 10);
    const portal = getStripeClient().billingPortal;
    const configurationId = process.env.STRIPE_PORTAL_CONFIGURATION_ID;
    const configuration = configurationId
      ? await portal.configurations.retrieve(configurationId)
      : (await portal.configurations.list({ active: true, is_default: true, limit: 1 })).data[0];
    if (!configuration?.active || configuration.features.subscription_update.enabled ||
        (configuration.features.subscription_cancel.enabled && configuration.features.subscription_cancel.mode !== "at_period_end")) {
      return billingResponse({ error: "The billing portal is temporarily unavailable." }, 503);
    }
    const session = await portal.sessions.create({
      customer: owner.stripeCustomerId,
      configuration: configuration.id,
      return_url: new URL("/settings#billing", getBillingOrigin()).href,
    });
    return billingResponse({ url: session.url });
  });
}
