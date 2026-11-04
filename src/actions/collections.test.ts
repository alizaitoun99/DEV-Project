import { beforeEach, expect, it, vi } from "vitest";

const { auth, updateMany, deleteMany, revalidatePath } = vi.hoisted(() => ({
  auth: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn(), revalidatePath: vi.fn(),
}));
vi.mock("@/auth", () => ({ auth }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/prisma", () => ({ prisma: { collection: { updateMany, deleteMany } } }));
import { updateCollection, deleteCollection } from "./collections";

beforeEach(() => {
  vi.resetAllMocks();
  auth.mockResolvedValue({ user: { id: "owner" } });
  updateMany.mockResolvedValue({ count: 1 });
  deleteMany.mockResolvedValue({ count: 1 });
});

it("updates only the owner's metadata, normalizes input and ignores protected fields", async () => {
  expect(await updateCollection("collection", { name: " Notes ", description: " ", userId: "other", isFavorite: true })).toEqual({ success: true });
  expect(updateMany).toHaveBeenCalledExactlyOnceWith({ where: { id: "collection", userId: "owner" }, data: { name: "Notes", description: null } });
  expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
});

it("deletes only the owned collection, relying on membership cascade without item writes", async () => {
  expect(await deleteCollection("collection")).toEqual({ success: true });
  expect(deleteMany).toHaveBeenCalledExactlyOnceWith({ where: { id: "collection", userId: "owner" } });
  expect(updateMany).not.toHaveBeenCalled();
  expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
});

it("rejects unauthenticated callers before mutation", async () => {
  auth.mockResolvedValue(null);
  expect((await updateCollection("collection", { name: "Notes" })).success).toBe(false);
  expect((await deleteCollection("collection")).success).toBe(false);
  expect(updateMany).not.toHaveBeenCalled();
  expect(deleteMany).not.toHaveBeenCalled();
});

it.each([null, "", " ", 4, "x".repeat(201)])("rejects invalid IDs %j", async (id) => {
  expect((await updateCollection(id, { name: "Notes" })).success).toBe(false);
  expect((await deleteCollection(id)).success).toBe(false);
  expect(updateMany).not.toHaveBeenCalled();
  expect(deleteMany).not.toHaveBeenCalled();
});

it.each([{ name: " " }, { name: 4 }, { name: "x".repeat(501) }, { name: "Notes", description: "x".repeat(10001) }])("rejects invalid metadata", async (input) => {
  expect((await updateCollection("collection", input)).success).toBe(false);
  expect(updateMany).not.toHaveBeenCalled();
});

it("returns not found for missing or foreign-owned collections without invalidating views", async () => {
  updateMany.mockResolvedValue({ count: 0 });
  deleteMany.mockResolvedValue({ count: 0 });
  expect(await updateCollection("foreign", { name: "Notes" })).toEqual({ success: false, error: "Collection not found." });
  expect(await deleteCollection("foreign")).toEqual({ success: false, error: "Collection not found." });
  expect(revalidatePath).not.toHaveBeenCalled();
});

it("hides database errors and allows retry", async () => {
  updateMany.mockRejectedValue(new Error("private database details"));
  deleteMany.mockRejectedValue(new Error("private database details"));
  expect(await updateCollection("collection", { name: "Notes" })).toEqual({ success: false, error: "Unable to save collection. Please try again." });
  expect(await deleteCollection("collection")).toEqual({ success: false, error: "Unable to delete collection. Please try again." });
});
