import "server-only";

import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { isStripeLiveMode } from "./stripe";
import { listCustomerSubscriptions, projectSubscription, stripeId } from "./subscriptions";
import { EntitlementError, lockBillingOwner } from "./usage-limits";

function billingEvent(event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.expired": {
      const checkout = event.data.object;
      if (checkout.mode !== "subscription") return null;
      return { customerId: stripeId(checkout.customer), checkout };
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
    case "customer.subscription.paused":
    case "customer.subscription.resumed":
      return { customerId: stripeId(event.data.object.customer) };
    case "invoice.payment_succeeded":
    case "invoice.payment_failed":
      return event.data.object.parent?.type === "subscription_details"
        ? { customerId: stripeId(event.data.object.customer) }
        : null;
    default:
      return null;
  }
}

export async function reconcileBillingEvent(event: Stripe.Event) {
  if (event.livemode !== isStripeLiveMode()) return;
  const input = billingEvent(event);
  if (!input?.customerId) return;
  const { customerId, checkout } = input;

  for (let retry = 0; retry < 3; retry++) {
    if (await prisma.stripeWebhookReceipt.findUnique({ where: { eventId: event.id }, select: { eventId: true } })) return;
    const owner = await prisma.user.findUnique({
      where: { stripeCustomerId: customerId }, select: { id: true, billingRevision: true },
    });
    if (!owner) return;
    if (await applyBillingEvent(event, owner, customerId, checkout)) return;
  }
  throw new Error("Billing state changed during reconciliation");
}

async function applyBillingEvent(
  event: Stripe.Event,
  owner: { id: string; billingRevision: number },
  customerId: string,
  checkout?: Stripe.Checkout.Session,
) {
  const expired = event.type === "checkout.session.expired";
  const subscriptions = expired ? null : await listCustomerSubscriptions(customerId);
  if (checkout && subscriptions && !subscriptions.some(({ id }) => id === stripeId(checkout.subscription))) {
    throw new Error("Completed Checkout subscription is not available for reconciliation");
  }
  const projection = subscriptions ? projectSubscription(subscriptions) : undefined;

  return prisma.$transaction(async (tx) => {
    const locked = await lockBillingOwner(tx, owner.id);
    if (locked.billingRevision !== owner.billingRevision) return false;
    const receipt = await tx.stripeWebhookReceipt.createMany({ data: { eventId: event.id }, skipDuplicates: true });
    if (!receipt.count) return true;
    if (checkout) {
      const key = checkout.metadata?.checkoutAttemptKey;
      await tx.stripeCheckoutAttempt.deleteMany({
        where: {
          userId: owner.id, stripeCustomerId: customerId,
          OR: [
            { stripeCheckoutSessionId: checkout.id },
            ...(key ? [{ stripeCheckoutSessionId: null, sessionIdempotencyKey: key }] : []),
          ],
        },
      });
    }
    await tx.user.update({
      where: { id: owner.id, stripeCustomerId: customerId },
      data: { ...projection, billingRevision: { increment: 1 } },
    });
    return true;
  }).catch((error: unknown) => {
    if (error instanceof EntitlementError && error.code === "ACCOUNT_NOT_FOUND") return true;
    throw error;
  });
}
