import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ user: vi.fn(), remove: vi.fn(), tokens: vi.fn(), enqueue: vi.fn(), transaction: vi.fn(), lock: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: m.user }, $transaction: m.transaction } }));
vi.mock("@/lib/db/items", () => ({ enqueueAccountStorage: m.enqueue }));
vi.mock("@/lib/auth-rate-limit", () => ({ consumeAuthLimit: vi.fn(), AuthRateLimitError: class extends Error {} }));
import { deleteAccountForUser } from "./profile-account";
beforeEach(() => {
  vi.resetAllMocks();
  m.user.mockResolvedValue({ email: "owner@example.test", passwordHash: null, billingRevision: 0 });
  m.lock.mockResolvedValue([{ plan: "FREE", billingRevision: 0 }]);
  m.transaction.mockImplementation((callback) => callback({
    $queryRaw: m.lock, user: { delete: m.remove }, verificationToken: { deleteMany: m.tokens },
  }));
});
it("preserves the account when Checkout reserves an attempt during deletion", async () => {
  m.lock.mockResolvedValue([{ plan: "FREE", billingRevision: 1 }]);
  expect(await deleteAccountForUser("owner", { confirmation: "DELETE", password: "" })).toEqual({
    success: false, error: "Your billing state changed. Please retry account deletion.",
  });
  expect(m.remove).not.toHaveBeenCalled();
  expect(m.enqueue).not.toHaveBeenCalled();
});
it("allows deletion while only customer creation is unresolved", async () => {
  m.user.mockResolvedValue({
    email: "owner@example.test", passwordHash: null, billingRevision: 2, stripeCustomerId: null,
    checkoutAttempt: { sessionParams: null, stripeCheckoutSessionId: null },
  });
  m.lock.mockResolvedValue([{ plan: "FREE", billingRevision: 2 }]);
  expect(await deleteAccountForUser("owner", { confirmation: "DELETE", password: "" })).toEqual({ success: true });
  expect(m.remove).toHaveBeenCalledOnce();
});

it("retains the account if Checkout session creation itself is unresolved", async () => {
  m.user.mockResolvedValue({
    email: "owner@example.test", passwordHash: null, billingRevision: 2, stripeCustomerId: "cus_owner",
    checkoutAttempt: { sessionParams: { customer: "cus_owner" }, stripeCheckoutSessionId: null },
  });
  expect((await deleteAccountForUser("owner", { confirmation: "DELETE", password: "" })).success).toBe(false);
  expect(m.remove).not.toHaveBeenCalled();
});
it("queues owned storage before deleting the account", async () => {
  expect(await deleteAccountForUser("owner", { confirmation: "DELETE", password: "" })).toEqual({ success: true });
  expect(m.enqueue).toHaveBeenCalledWith(expect.any(Object), "owner");
  expect(m.enqueue.mock.invocationCallOrder[0]).toBeLessThan(m.remove.mock.invocationCallOrder[0]);
});
it("retains the account if cleanup cannot be persisted", async () => {
  m.enqueue.mockRejectedValue(new Error("database failed"));
  expect((await deleteAccountForUser("owner", { confirmation: "DELETE", password: "" })).success).toBe(false);
  expect(m.remove).not.toHaveBeenCalled();
});
