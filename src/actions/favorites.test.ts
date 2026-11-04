import { beforeEach, expect, it, vi } from "vitest";

const { auth, itemUpdate, collectionUpdate, revalidatePath } = vi.hoisted(() => ({ auth: vi.fn(), itemUpdate: vi.fn(), collectionUpdate: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("@/auth", () => ({ auth }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/prisma", () => ({ prisma: { item: { updateMany: itemUpdate }, collection: { updateMany: collectionUpdate } } }));
import { setFavorite } from "./favorites";

beforeEach(() => {
  vi.resetAllMocks();
  auth.mockResolvedValue({ user: { id: "owner" } });
  itemUpdate.mockResolvedValue({ count: 1 });
  collectionUpdate.mockResolvedValue({ count: 1 });
});

it.each([true, false])("sets item favorite to %s using session ownership", async (isFavorite) => {
  expect(await setFavorite({ kind: "item", id: " id ", isFavorite, userId: "foreign" })).toEqual({ success: true });
  expect(itemUpdate).toHaveBeenCalledExactlyOnceWith({ where: { id: "id", userId: "owner" }, data: { isFavorite } });
  expect(collectionUpdate).not.toHaveBeenCalled();
  expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
});

it.each([true, false])("sets collection favorite to %s", async (isFavorite) => {
  expect(await setFavorite({ kind: "collection", id: "id", isFavorite })).toEqual({ success: true });
  expect(collectionUpdate).toHaveBeenCalledExactlyOnceWith({ where: { id: "id", userId: "owner" }, data: { isFavorite } });
  expect(itemUpdate).not.toHaveBeenCalled();
});

it("rejects unauthenticated requests", async () => {
  auth.mockResolvedValue(null);
  expect((await setFavorite({ kind: "item", id: "id", isFavorite: true })).success).toBe(false);
  expect(itemUpdate).not.toHaveBeenCalled();
  expect(collectionUpdate).not.toHaveBeenCalled();
});

it.each([null, {}, { kind: "user", id: "id", isFavorite: true }, { kind: "item", id: " ", isFavorite: true }, { kind: "item", id: "id", isFavorite: "true" }, { kind: "item", id: "x".repeat(201), isFavorite: true }])("rejects invalid input %j", async (input) => {
  expect((await setFavorite(input)).success).toBe(false);
  expect(itemUpdate).not.toHaveBeenCalled();
  expect(collectionUpdate).not.toHaveBeenCalled();
  expect(revalidatePath).not.toHaveBeenCalled();
});

it.each(["item", "collection"])("handles missing or foreign-owned %s", async (kind) => {
  itemUpdate.mockResolvedValue({ count: 0 });
  collectionUpdate.mockResolvedValue({ count: 0 });
  expect((await setFavorite({ kind, id: "foreign", isFavorite: true })).success).toBe(false);
  expect(revalidatePath).not.toHaveBeenCalled();
});

it("hides database errors and allows retry", async () => {
  itemUpdate.mockRejectedValueOnce(new Error("private details"));
  expect(await setFavorite({ kind: "item", id: "id", isFavorite: true })).toEqual({ success: false, error: "Unable to update favorite. Please try again." });
  expect(revalidatePath).not.toHaveBeenCalled();
  expect(await setFavorite({ kind: "item", id: "id", isFavorite: true })).toEqual({ success: true });
});
