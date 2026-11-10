import "dotenv/config";

import { prisma } from "../src/lib/prisma";
import { loadBillingOwner } from "../src/lib/billing/checkout";
import { getStripeClient, isStripeLiveMode } from "../src/lib/billing/stripe";
import { listCustomerSubscriptions, projectSubscription, stripeId } from "../src/lib/billing/subscriptions";
import { lockBillingOwner } from "../src/lib/billing/usage-limits";

async function main() {
  const [userId, flag, ...rest] = process.argv.slice(2);
  if (!userId || userId.startsWith("-") || (flag && flag !== "--execute") || rest.length) {
    throw new Error("Usage: npm run billing:reconcile -- <userId> [--execute]");
  }
  const owner = await loadBillingOwner(userId);
  if (!owner?.stripeCustomerId) throw new Error("No stored Stripe customer mapping for this owner.");

  const customerId = owner.stripeCustomerId;
  const subscriptions = await listCustomerSubscriptions(customerId);
  const projection = projectSubscription(subscriptions);
  const attempt = owner.checkoutAttempt;
  let resolveAttempt = false;
  if (attempt?.stripeCustomerId === customerId) {
    const live = isStripeLiveMode();
    for await (const session of getStripeClient().checkout.sessions.list({ customer: customerId, limit: 100 })) {
      if (session.livemode !== live || session.mode !== "subscription" || stripeId(session.customer) !== customerId) continue;
      const matches = attempt.stripeCheckoutSessionId
        ? session.id === attempt.stripeCheckoutSessionId
        : session.metadata?.checkoutAttemptKey === attempt.sessionIdempotencyKey;
      if (!matches) continue;
      resolveAttempt = session.status === "expired" ||
        (session.status === "complete" && subscriptions.some(({ id }) => id === stripeId(session.subscription)));
      break;
    }
  }
  console.log({
    mode: flag === "--execute" ? "execute" : "preview",
    database: new URL(process.env.DATABASE_URL!).hostname,
    stripeMode: isStripeLiveMode() ? "live" : "sandbox",
    projectedPlan: projection.plan,
    subscriptionStatus: projection.subscriptionStatus,
    checkoutAttempt: resolveAttempt ? "resolve" : attempt ? "retain" : "none",
  });
  if (flag !== "--execute") return;

  await prisma.$transaction(async (tx) => {
    const locked = await lockBillingOwner(tx, userId);
    if (locked.billingRevision !== owner.billingRevision) throw new Error("Billing changed during repair. Preview again.");
    if (resolveAttempt && attempt) {
      await tx.stripeCheckoutAttempt.deleteMany({ where: { userId, sessionIdempotencyKey: attempt.sessionIdempotencyKey } });
    }
    await tx.user.update({
      where: { id: userId, stripeCustomerId: customerId },
      data: { ...projection, billingRevision: { increment: 1 } },
    });
  });
  console.log("Billing projection reconciled.");
}

main().catch((error: unknown) => {
  console.error("Billing repair failed. Verify the owner, database, and Stripe mode.", error instanceof Error ? error.name : "");
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
