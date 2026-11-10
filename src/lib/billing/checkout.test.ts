import { beforeEach, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  owner: vi.fn(), retrieve: vi.fn(), expire: vi.fn(), create: vi.fn(),
  customer: vi.fn(), customers: vi.fn(), transaction: vi.fn(), price: vi.fn(), subscriptions: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: m.owner }, $transaction: m.transaction } }));
vi.mock("./stripe", () => ({
  getBillingOrigin: () => "https://devstash.example",
  getStripePriceId: (interval: string) => `price_${interval}`,
  isStripeLiveMode: () => false,
  getStripeClient: () => ({
    checkout: { sessions: { retrieve: m.retrieve, expire: m.expire, create: m.create } },
    customers: { create: m.customer, list: m.customers },
    prices: { retrieve: m.price },
  }),
}));
vi.mock("./subscriptions", async (importOriginal) => ({
  ...await importOriginal<typeof import("./subscriptions")>(),
  listCustomerSubscriptions: m.subscriptions,
}));
import { BillingPendingError, startCheckout } from "./checkout";

const session = {
  id: "cs_test_existing", customer: "cus_owner", status: "open",
  mode: "subscription", livemode: false, url: "https://checkout.stripe.com/example",
};
const attempt = {
  userId: "owner", stripeCheckoutSessionId: session.id, stripeCustomerId: "cus_owner",
  priceId: "price_monthly", sessionIdempotencyKey: "attempt",
  sessionParams: { customer: "cus_owner", mode: "subscription" },
  createdAt: new Date(),
};
const owner = { id: "owner", stripeCustomerId: "cus_owner", billingRevision: 2, checkoutAttempt: attempt };

beforeEach(() => {
  vi.resetAllMocks();
  m.owner.mockResolvedValue(owner);
  m.retrieve.mockResolvedValue(session);
});

it("reuses the open session for repeated requests for the same interval", async () => {
  const result = await Promise.all([startCheckout("owner", "monthly"), startCheckout("owner", "monthly")]);
  expect(result).toEqual([{ url: session.url }, { url: session.url }]);
  expect(m.retrieve).toHaveBeenCalledWith(session.id);
  expect(m.create).not.toHaveBeenCalled();
  expect(m.transaction).not.toHaveBeenCalled();
});

it("keeps the attempt pending if completion wins the race with interval switching", async () => {
  m.expire.mockRejectedValue(new Error("not open"));
  m.retrieve.mockResolvedValueOnce(session).mockResolvedValueOnce({ ...session, status: "complete" });
  await expect(startCheckout("owner", "yearly")).rejects.toBeInstanceOf(BillingPendingError);
  expect(m.expire).toHaveBeenCalledWith(session.id);
  expect(m.create).not.toHaveBeenCalled();
  expect(m.transaction).not.toHaveBeenCalled();
});

it("retries an ambiguous provider response with the same persisted key and parameters", async () => {
  m.owner.mockResolvedValue({ ...owner, checkoutAttempt: { ...attempt, stripeCheckoutSessionId: null } });
  m.create.mockRejectedValue(new Error("timeout"));
  for (let retry = 0; retry < 2; retry++) {
    await expect(startCheckout("owner", "monthly")).rejects.toThrow("timeout");
  }
  expect(m.create.mock.calls).toEqual([
    [attempt.sessionParams, { idempotencyKey: attempt.sessionIdempotencyKey }],
    [attempt.sessionParams, { idempotencyKey: attempt.sessionIdempotencyKey }],
  ]);
  expect(m.transaction).not.toHaveBeenCalled();
  expect(m.customer).not.toHaveBeenCalled();
});

it("refuses to replay a key beyond the safe retry window", async () => {
  m.owner.mockResolvedValue({
    ...owner, checkoutAttempt: { ...attempt, stripeCheckoutSessionId: null, createdAt: new Date(0) },
  });
  await expect(startCheckout("owner", "monthly")).rejects.toBeInstanceOf(BillingPendingError);
  expect(m.create).not.toHaveBeenCalled();
});

it.each([true, false])("restores a uniquely matching customer for a lost response, with attempt metadata %s", async (tagged) => {
  const customerMetadata = {
    devstashUserId: "owner",
    ...(tagged ? { devstashCustomerAttemptKey: "customer-key" } : {}),
  };
  const stale = {
    ...attempt, sessionParams: null, stripeCheckoutSessionId: null, stripeCustomerId: null,
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    customerIdempotencyKey: "customer-key", customerParams: { metadata: customerMetadata },
  };
  m.owner
    .mockResolvedValueOnce({ ...owner, stripeCustomerId: null, checkoutAttempt: stale })
    .mockResolvedValueOnce({ ...owner, billingRevision: 3, checkoutAttempt: null });
  m.customers.mockReturnValue([
    { id: "cus_foreign", livemode: false, metadata: { ...customerMetadata, devstashUserId: "other" } },
    { id: "cus_live", livemode: true, metadata: customerMetadata },
    { id: "cus_other_attempt", livemode: false, metadata: { ...customerMetadata, devstashCustomerAttemptKey: "different" } },
    { id: "cus_owner", livemode: false, metadata: customerMetadata },
  ]);
  const retire = vi.fn();
  const update = vi.fn();
  m.transaction.mockImplementation((callback) => callback({
    $queryRaw: async () => [{ billingRevision: 2 }],
    stripeCheckoutAttempt: { findUnique: async () => stale, delete: retire },
    user: { update },
  }));
  m.subscriptions.mockResolvedValue([{ status: "active" }]);

  await expect(startCheckout("owner", "monthly")).resolves.toEqual({ manage: true });
  expect(m.subscriptions).toHaveBeenCalledWith("cus_owner");
  expect(retire).toHaveBeenCalledWith({ where: { userId: "owner" } });
  expect(update).toHaveBeenCalledWith({
    where: { id: "owner" },
    data: { stripeCustomerId: "cus_owner", billingRevision: { increment: 1 } },
  });
  expect(m.customer).not.toHaveBeenCalled();
  expect(m.create).not.toHaveBeenCalled();
});

it.each(["no match", "revision changed"])("continues Checkout after customer-only recovery with %s", async (scenario) => {
  const stale = {
    ...attempt, sessionParams: null, stripeCheckoutSessionId: null, stripeCustomerId: null,
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000), customerIdempotencyKey: "customer-key",
  };
  m.owner.mockResolvedValueOnce({ ...owner, stripeCustomerId: null, checkoutAttempt: stale });
  m.customers.mockReturnValue([]);
  const retire = vi.fn();
  const update = vi.fn();
  m.transaction.mockImplementation((callback) => callback({
    $queryRaw: async () => [{ billingRevision: scenario === "revision changed" ? 3 : 2 }],
    stripeCheckoutAttempt: { findUnique: async () => stale, delete: retire },
    user: { update },
  }));

  await expect(startCheckout("owner", "monthly")).resolves.toEqual({ url: session.url });
  if (scenario === "no match") {
    expect(retire).toHaveBeenCalledOnce();
    expect(update).toHaveBeenCalledWith({ where: { id: "owner" }, data: { billingRevision: { increment: 1 } } });
  } else {
    expect(retire).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  }
  expect(m.customer).not.toHaveBeenCalled();
});

it("directs accounts with a recoverable subscription to Manage billing", async () => {
  m.owner.mockResolvedValue({ ...owner, checkoutAttempt: null });
  m.subscriptions.mockResolvedValue([{ status: "past_due" }]);
  await expect(startCheckout("owner", "yearly")).resolves.toEqual({ manage: true });
  expect(m.transaction).not.toHaveBeenCalled();
});
