import { beforeEach, expect, it, vi } from "vitest";

const { deleteMany, findFirst } = vi.hoisted(() => ({ deleteMany: vi.fn(), findFirst: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { item: { deleteMany, findFirst } } }));
import { deleteItem } from "./items";

beforeEach(() => { vi.resetAllMocks(); });

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
});
it("propagates database failure to the action", async () => {
  deleteMany.mockRejectedValue(new Error("offline"));
  await expect(deleteItem("owner", "item")).rejects.toThrow("offline");
});
