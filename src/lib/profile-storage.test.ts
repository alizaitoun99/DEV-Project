import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ user: vi.fn(), remove: vi.fn(), tokens: vi.fn(), enqueue: vi.fn(), transaction: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: m.user }, $transaction: m.transaction } }));
vi.mock("@/lib/db/items", () => ({ enqueueAccountStorage: m.enqueue }));
vi.mock("@/lib/auth-rate-limit", () => ({ consumeAuthLimit: vi.fn(), AuthRateLimitError: class extends Error {} }));
import { deleteAccountForUser } from "./profile-account";
beforeEach(() => {
  vi.resetAllMocks();
  m.user.mockResolvedValue({ email: "owner@example.test", passwordHash: null });
  m.transaction.mockImplementation((callback) => callback({ user: { delete: m.remove }, verificationToken: { deleteMany: m.tokens } }));
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
