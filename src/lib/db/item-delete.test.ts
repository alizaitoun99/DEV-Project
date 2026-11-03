import { beforeEach, expect, it, vi } from "vitest";

const { deleteMany, findFirst, transaction, query, enqueue, remove } = vi.hoisted(() => ({ deleteMany: vi.fn(), findFirst: vi.fn(), transaction: vi.fn(), query: vi.fn(), enqueue: vi.fn(), remove: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { item: { deleteMany, findFirst }, $transaction: transaction } }));
import { deleteItem } from "./items";

beforeEach(() => {
  vi.resetAllMocks();
  query.mockResolvedValue([{ id: "owner" }]);
  enqueue.mockResolvedValue({ count: 0 });
  transaction.mockImplementation((callback) => callback({ $queryRaw: query, item: { findFirst, delete: remove }, storageObject: { updateMany: enqueue } }));
});

it("atomically scopes deletion to owner and items without stored objects", async () => {
  deleteMany.mockResolvedValue({ count: 1 });
  expect(await deleteItem("owner", "item")).toBe("deleted");
  expect(deleteMany).toHaveBeenCalledWith({ where: { id: "item", userId: "owner", fileKey: null } });
  expect(findFirst).not.toHaveBeenCalled();
});
it("reports foreign, missing, or already deleted items without leaking details", async () => {
  deleteMany.mockResolvedValue({ count: 0 });
  findFirst.mockResolvedValue(null);
  expect(await deleteItem("owner", "foreign")).toBe("not-found");
  expect(findFirst).toHaveBeenCalledWith({ where: { id: "foreign", userId: "owner" }, select: { fileKey: true } });
});
it("preserves stored-object references", async () => {
  deleteMany.mockResolvedValue({ count: 0 });
  findFirst.mockResolvedValue({ fileKey: "private/key" });
  expect(await deleteItem("owner", "file")).toBe("stored-file");
  expect(remove).not.toHaveBeenCalled();
});
it("queues storage cleanup in the same transaction as owned item deletion", async () => {
  deleteMany.mockResolvedValue({ count: 0 });
  findFirst.mockResolvedValue({ fileKey: "private/key" });
  enqueue.mockResolvedValue({ count: 1 });
  expect(await deleteItem("owner", "file")).toBe("deleted");
  expect(enqueue).toHaveBeenCalledWith({ where: { userId: "owner", key: "private/key", state: "attached", itemId: "file" }, data: { state: "cleanup", retryAt: expect.any(Date) } });
  expect(remove).toHaveBeenCalledWith({ where: { id: "file", userId: "owner" } });
});
it("propagates database failure to the action", async () => {
  deleteMany.mockRejectedValue(new Error("offline"));
  await expect(deleteItem("owner", "item")).rejects.toThrow("offline");
});
