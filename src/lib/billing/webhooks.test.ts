import { beforeEach, expect, it, vi } from "vitest";
import type Stripe from "stripe";

const m = vi.hoisted(() => ({
  receipt: vi.fn(), owner: vi.fn(), transaction: vi.fn(), lock: vi.fn(),
  insert: vi.fn(), update: vi.fn(), resolve: vi.fn(), subscriptions: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: {
  stripeWebhookReceipt: { findUnique: m.receipt },
  user: { findUnique: m.owner },
  $transaction: m.transaction,
} }));
vi.mock("./subscriptions", async (importOriginal) => ({
  ...await importOriginal<typeof import("./subscriptions")>(),
  listCustomerSubscriptions: m.subscriptions,
}));
import { reconcileBillingEvent } from "./webhooks";

const event = {
  id: "evt_1", type: "customer.subscription.deleted", livemode: false,
  data: { object: { id: "sub_old", customer: "cus_owner" } },
} as Stripe.Event;

function subscription(status: Stripe.Subscription.Status, price = "price_month") {
  return {
    id: "sub_current", status, cancel_at_period_end: true,
    items: { has_more: false, data: [{ price: { id: price }, quantity: 1, current_period_end: 1800000000 }] },
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_example");
  vi.stubEnv("STRIPE_PRICE_MONTHLY_ID", "price_month");
  vi.stubEnv("STRIPE_PRICE_YEARLY_ID", "price_year");
  m.owner.mockResolvedValue({ id: "owner", billingRevision: 2 });
  m.lock.mockResolvedValue([{ plan: "FREE", billingRevision: 2 }]);
  m.insert.mockResolvedValue({ count: 1 });
  m.subscriptions.mockResolvedValue([subscription("active")]);
  m.transaction.mockImplementation((callback) => callback({
    $queryRaw: m.lock, stripeWebhookReceipt: { createMany: m.insert },
    stripeCheckoutAttempt: { deleteMany: m.resolve }, user: { update: m.update },
  }));
});

it("uses current Stripe state even for an old deletion event and keeps scheduled cancellation active", async () => {
  await reconcileBillingEvent(event);
  expect(m.owner).toHaveBeenCalledWith(expect.objectContaining({ where: { stripeCustomerId: "cus_owner" } }));
  expect(m.insert).toHaveBeenCalledWith({ data: { eventId: "evt_1" }, skipDuplicates: true });
  expect(m.update).toHaveBeenCalledWith({
    where: { id: "owner", stripeCustomerId: "cus_owner" },
    data: { plan: "PRO", stripeSubscriptionId: "sub_current", subscriptionStatus: "active",
      currentPeriodEnd: new Date(1800000000000), billingRevision: { increment: 1 } },
  });
});

it.each([
  { status: "past_due", price: "price_month", result: "past_due" },
  { status: "active", price: "price_unknown", result: "billing_conflict" },
] as const)("projects Free for $status on $price", async ({ status, price, result }) => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  m.subscriptions.mockResolvedValue([subscription(status, price)]);
  await reconcileBillingEvent(event);
  expect(m.update).toHaveBeenCalledWith(expect.objectContaining({
    data: expect.objectContaining({ plan: "FREE", subscriptionStatus: result }),
  }));
});

it("ignores wrong-mode events and committed duplicates before Stripe reads", async () => {
  await reconcileBillingEvent({ ...event, livemode: true });
  expect(m.receipt).not.toHaveBeenCalled();
  m.receipt.mockResolvedValue({ eventId: event.id });
  await reconcileBillingEvent(event);
  expect(m.subscriptions).not.toHaveBeenCalled();
});

it("fetches fresh Stripe state after a revision conflict", async () => {
  m.lock.mockResolvedValueOnce([{ plan: "PRO", billingRevision: 3 }]);
  m.subscriptions.mockResolvedValueOnce([subscription("active")]).mockResolvedValueOnce([subscription("past_due")]);
  await reconcileBillingEvent(event);
  expect(m.subscriptions).toHaveBeenCalledTimes(2);
  expect(m.insert).toHaveBeenCalledTimes(1);
  expect(m.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ plan: "FREE" }) }));
});

it("resolves an expired Checkout attempt without overwriting access", async () => {
  const expired = {
    ...event, type: "checkout.session.expired",
    data: { object: { mode: "subscription", customer: "cus_owner", id: "cs_expired" } },
  } as Stripe.Event;
  await reconcileBillingEvent(expired);
  expect(m.subscriptions).not.toHaveBeenCalled();
  expect(m.resolve).toHaveBeenCalledWith(expect.objectContaining({
    where: expect.objectContaining({ userId: "owner", stripeCustomerId: "cus_owner" }),
  }));
  expect(m.update).toHaveBeenCalledWith(expect.objectContaining({ data: { billingRevision: { increment: 1 } } }));
});
