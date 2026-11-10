import "server-only";

import { randomUUID } from "node:crypto";
import type Stripe from "stripe";
import { Prisma, type StripeCheckoutAttempt } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getBillingOrigin, getStripeClient, getStripePriceId, isStripeLiveMode, type BillingInterval } from "./stripe";
import { isTerminalSubscription, listCustomerSubscriptions, stripeId } from "./subscriptions";
import { lockBillingOwner } from "./usage-limits";

const SAFE_REPLAY_MS = 23 * 60 * 60 * 1000;

export class BillingPendingError extends Error {
  constructor() {
    super("Billing is still being confirmed. Please try again shortly.");
  }
}

export async function loadBillingOwner(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, stripeCustomerId: true, stripeSubscriptionId: true, billingRevision: true, checkoutAttempt: true },
  });
}

function replayWindowElapsed(attempt: StripeCheckoutAttempt) {
  return Date.now() - attempt.createdAt.getTime() >= SAFE_REPLAY_MS;
}

function requireReplayWindow(attempt: StripeCheckoutAttempt) {
  if (replayWindowElapsed(attempt)) throw new BillingPendingError();
}

export function isCustomerOnlyAttempt(attempt: Pick<StripeCheckoutAttempt, "sessionParams" | "stripeCheckoutSessionId">) {
  return attempt.sessionParams === null && attempt.stripeCheckoutSessionId === null;
}

async function reserveCheckout(userId: string, priceId: string, revision: number) {
  return prisma.$transaction(async (tx) => {
    const owner = await lockBillingOwner(tx, userId);
    if (owner.billingRevision !== revision) throw new BillingPendingError();
    const customerIdempotencyKey = randomUUID();
    const attempt = await tx.stripeCheckoutAttempt.create({
      data: {
        userId, priceId,
        customerIdempotencyKey,
        sessionIdempotencyKey: randomUUID(),
        customerParams: { metadata: { devstashUserId: userId, devstashCustomerAttemptKey: customerIdempotencyKey } },
      },
    });
    await tx.user.update({ where: { id: userId }, data: { billingRevision: { increment: 1 } } });
    return attempt;
  });
}

async function findCreatedCustomer(attempt: StripeCheckoutAttempt) {
  const metadata = (attempt.customerParams as Stripe.CustomerCreateParams | null)?.metadata;
  const key = metadata && typeof metadata === "object" ? metadata.devstashCustomerAttemptKey : undefined;
  const live = isStripeLiveMode();
  // Allow for clock skew between PostgreSQL and Stripe. Legacy attempts only have owner metadata.
  const created = Math.floor(attempt.createdAt.getTime() / 1000);
  const candidates = getStripeClient().customers.list({
    created: { gte: Math.max(0, created - 60), lte: created + SAFE_REPLAY_MS / 1000 + 300 },
    limit: 100,
  });
  let match: string | undefined;
  for await (const customer of candidates) {
    if (customer.livemode !== live || customer.metadata.devstashUserId !== attempt.userId ||
        customer.metadata.devstashCustomerAttemptKey !== key) continue;
    // An ambiguous match cannot be used as the owner's billing identity.
    if (match) return undefined;
    match = customer.id;
  }
  return match;
}

async function recoverCustomerOnlyAttempt(attempt: StripeCheckoutAttempt, revision: number, mappedCustomerId: string | null) {
  const customerId = mappedCustomerId ?? await findCreatedCustomer(attempt);
  await prisma.$transaction(async (tx) => {
    const owner = await lockBillingOwner(tx, attempt.userId);
    if (owner.billingRevision !== revision) return;
    const current = await tx.stripeCheckoutAttempt.findUnique({ where: { userId: attempt.userId } });
    if (current?.customerIdempotencyKey !== attempt.customerIdempotencyKey || !isCustomerOnlyAttempt(current)) return;
    // No session request can leave the app until its parameters are committed under this lock.
    // Retiring the attempt fences late customer responses, even when Stripe has no unique match.
    await tx.stripeCheckoutAttempt.delete({ where: { userId: attempt.userId } });
    await tx.user.update({
      where: { id: attempt.userId },
      data: { ...(customerId ? { stripeCustomerId: customerId } : {}), billingRevision: { increment: 1 } },
    });
  });
}

async function prepareSession(attempt: StripeCheckoutAttempt, mappedCustomerId: string | null) {
  if (attempt.sessionParams) return attempt;
  requireReplayWindow(attempt);
  const stripe = getStripeClient();
  const customerId = mappedCustomerId ?? (await stripe.customers.create(
    attempt.customerParams as Stripe.CustomerCreateParams,
    { idempotencyKey: attempt.customerIdempotencyKey },
  )).id;

  const returnUrl = new URL("/settings", getBillingOrigin());
  const sessionParams = {
    customer: customerId, mode: "subscription", allowed_payment_method_types: ["card"],
    line_items: [{ price: attempt.priceId, quantity: 1 }],
    metadata: { checkoutAttemptKey: attempt.sessionIdempotencyKey },
    success_url: `${returnUrl}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${returnUrl}?checkout=canceled`,
  } satisfies Stripe.Checkout.SessionCreateParams;

  return prisma.$transaction(async (tx) => {
    await lockBillingOwner(tx, attempt.userId);
    const current = await tx.stripeCheckoutAttempt.findUnique({ where: { userId: attempt.userId } });
    if (current?.sessionIdempotencyKey !== attempt.sessionIdempotencyKey) throw new BillingPendingError();
    if (current.sessionParams) return current;
    await tx.user.update({
      where: { id: attempt.userId, OR: [{ stripeCustomerId: null }, { stripeCustomerId: customerId }] },
      data: { stripeCustomerId: customerId, billingRevision: { increment: 1 } },
    });
    return tx.stripeCheckoutAttempt.update({
      where: { userId: attempt.userId },
      data: { stripeCustomerId: customerId, sessionParams },
    });
  });
}

async function retrieveOrCreateSession(attempt: StripeCheckoutAttempt, mappedCustomerId: string | null) {
  const stripe = getStripeClient();
  if (attempt.stripeCheckoutSessionId) return retrieveOwnedSession(attempt, attempt.stripeCheckoutSessionId);
  const prepared = await prepareSession(attempt, mappedCustomerId);
  if (prepared.stripeCheckoutSessionId) return retrieveOwnedSession(prepared, prepared.stripeCheckoutSessionId);
  requireReplayWindow(prepared);
  const session = await stripe.checkout.sessions.create(
    prepared.sessionParams as Stripe.Checkout.SessionCreateParams,
    { idempotencyKey: prepared.sessionIdempotencyKey },
  );
  await prisma.$transaction(async (tx) => {
    await lockBillingOwner(tx, attempt.userId);
    const result = await tx.stripeCheckoutAttempt.updateMany({
      where: { userId: attempt.userId, sessionIdempotencyKey: attempt.sessionIdempotencyKey },
      data: { stripeCheckoutSessionId: session.id },
    });
    if (!result.count) throw new BillingPendingError();
    await tx.user.update({ where: { id: attempt.userId }, data: { billingRevision: { increment: 1 } } });
  });
  return retrieveOwnedSession(prepared, session.id);
}

async function retrieveOwnedSession(attempt: StripeCheckoutAttempt, sessionId: string) {
  const session = await getStripeClient().checkout.sessions.retrieve(sessionId);
  if (!attempt.stripeCustomerId || stripeId(session.customer) !== attempt.stripeCustomerId ||
      session.mode !== "subscription" || session.livemode !== isStripeLiveMode()) {
    throw new BillingPendingError();
  }
  return session;
}

async function validateCheckoutPrice(priceId: string, interval: BillingInterval) {
  const price = await getStripeClient().prices.retrieve(priceId);
  const monthly = interval === "monthly";
  if (!price.active || price.livemode !== isStripeLiveMode() || price.currency !== "usd" ||
      price.unit_amount !== (monthly ? 800 : 7200) || price.recurring?.interval !== (monthly ? "month" : "year") ||
      price.recurring.interval_count !== 1) {
    throw new Error("Stripe price does not match the advertised plan");
  }
}

export async function expireOpenCheckout(session: Stripe.Checkout.Session) {
  if (session.status !== "open") return session;
  const { sessions } = getStripeClient().checkout;
  try {
    return await sessions.expire(session.id);
  } catch {
    // Completion can win the race with expiration.
    return sessions.retrieve(session.id);
  }
}

async function releaseExpiredAttempt(attempt: StripeCheckoutAttempt, session: Stripe.Checkout.Session) {
  if (session.status !== "expired") throw new BillingPendingError();
  await prisma.$transaction(async (tx) => {
    await lockBillingOwner(tx, attempt.userId);
    const result = await tx.stripeCheckoutAttempt.deleteMany({
      where: { userId: attempt.userId, sessionIdempotencyKey: attempt.sessionIdempotencyKey },
    });
    if (result.count) {
      await tx.user.update({ where: { id: attempt.userId }, data: { billingRevision: { increment: 1 } } });
    }
  });
}

export async function startCheckout(userId: string, interval: BillingInterval) {
  const priceId = getStripePriceId(interval);
  // Validate configuration before reserving a durable attempt.
  getBillingOrigin();
  getStripeClient();
  for (let retry = 0; retry < 3; retry++) {
    const owner = await loadBillingOwner(userId);
    if (!owner) throw new BillingPendingError();
    let attempt = owner.checkoutAttempt;
    if (attempt && isCustomerOnlyAttempt(attempt) && replayWindowElapsed(attempt)) {
      await recoverCustomerOnlyAttempt(attempt, owner.billingRevision, owner.stripeCustomerId);
      continue;
    }
    if (!attempt) {
      if (owner.stripeCustomerId) {
        const subscriptions = await listCustomerSubscriptions(owner.stripeCustomerId);
        if (subscriptions.some((subscription) => !isTerminalSubscription(subscription))) return { manage: true } as const;
      }
      await validateCheckoutPrice(priceId, interval);
      try {
        attempt = await reserveCheckout(userId, priceId, owner.billingRevision);
      } catch (error) {
        if (error instanceof BillingPendingError || (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) continue;
        throw error;
      }
    }
    const session = await retrieveOrCreateSession(attempt, owner.stripeCustomerId);
    if (session.status === "open" && attempt.priceId === priceId && session.url) return { url: session.url };
    await releaseExpiredAttempt(attempt, await expireOpenCheckout(session));
  }
  throw new BillingPendingError();
}
