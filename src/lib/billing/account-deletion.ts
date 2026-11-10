import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { expireOpenCheckout, isCustomerOnlyAttempt, loadBillingOwner } from "./checkout";
import { getStripeClient, isStripeLiveMode } from "./stripe";
import { isTerminalSubscription, listCustomerSubscriptions, stripeId } from "./subscriptions";
import { lockBillingOwner } from "./usage-limits";

export class BillingDeletionError extends Error {}

export async function prepareBillingDeletion(userId: string) {
  const owner = await loadBillingOwner(userId);
  if (!owner) throw new BillingDeletionError("Account no longer exists.");
  const attempt = owner.checkoutAttempt;
  // The final revision check fences any concurrent worker preparing session parameters.
  if (attempt && !isCustomerOnlyAttempt(attempt) && (!attempt.stripeCheckoutSessionId || !owner.stripeCustomerId)) {
    throw new BillingDeletionError("Checkout is still being confirmed. Try deleting your account again later.");
  }
  if (!owner.stripeCustomerId && owner.stripeSubscriptionId) {
    throw new BillingDeletionError("Contact support to resolve your billing details before deleting your account.");
  }
  let completedSubscriptionId: string | null = null;
  if (attempt?.stripeCheckoutSessionId) {
    const session = await getStripeClient().checkout.sessions.retrieve(attempt.stripeCheckoutSessionId);
    if (stripeId(session.customer) !== owner.stripeCustomerId || session.livemode !== isStripeLiveMode()) {
      throw new BillingDeletionError("Contact support to resolve your Checkout session before deleting your account.");
    }
    const closed = await expireOpenCheckout(session);
    if (closed.status !== "expired" && closed.status !== "complete") {
      throw new BillingDeletionError("Checkout is still open. Try deleting your account again later.");
    }
    if (closed.status === "complete") {
      completedSubscriptionId = stripeId(closed.subscription);
      if (!completedSubscriptionId) throw new BillingDeletionError("Checkout is still being confirmed. Try deleting your account again later.");
    }
  }
  if (owner.stripeCustomerId) {
    const subscriptions = await listCustomerSubscriptions(owner.stripeCustomerId);
    if (completedSubscriptionId && !subscriptions.some(({ id }) => id === completedSubscriptionId)) {
      throw new BillingDeletionError("Checkout is still being confirmed. Try deleting your account again later.");
    }
    if (subscriptions.some((subscription) => !isTerminalSubscription(subscription))) {
      throw new BillingDeletionError("Resolve your subscription in Manage billing before deleting your account.");
    }
  }
  return owner.billingRevision;
}

export async function assertBillingDeletionUnchanged(tx: Prisma.TransactionClient, userId: string, revision: number) {
  const owner = await lockBillingOwner(tx, userId);
  if (owner.billingRevision !== revision) {
    throw new BillingDeletionError("Your billing state changed. Please retry account deletion.");
  }
}

export async function assertNoBillingForBulkDeletion(tx: Prisma.TransactionClient, userId: string) {
  await lockBillingOwner(tx, userId);
  const user = await tx.user.findUniqueOrThrow({
    where: { id: userId },
    select: { stripeCustomerId: true, stripeSubscriptionId: true, checkoutAttempt: {
      select: { sessionParams: true, stripeCheckoutSessionId: true },
    } },
  });
  if (user.stripeCustomerId || user.stripeSubscriptionId || (user.checkoutAttempt && !isCustomerOnlyAttempt(user.checkoutAttempt))) {
    throw new BillingDeletionError("Bulk deletion is blocked for accounts with Stripe billing. Use the guarded account deletion flow.");
  }
}
