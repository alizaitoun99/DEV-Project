import { beforeEach, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ transaction: vi.fn(), count: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), storage: vi.fn(), storageUpdate: vi.fn(), query: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: m.transaction } }));
import { createItem, updateItem, finalizeUploadRecord } from "./items";
import { itemUpdateSchema } from "@/lib/item-validation";

beforeEach(() => {
  vi.resetAllMocks();
  m.count.mockResolvedValue(2);
  m.create.mockResolvedValue({ id: "item" });
  m.findFirst.mockResolvedValue({ type: { slug: "note" } });
  m.query.mockResolvedValue([{ id: "owner", plan: "PRO" }]);
  m.storage.mockResolvedValue({ state: "pending", expiresAt: new Date(Date.now() + 60000), type: "file", key: "key", fileName: "a.txt", size: 3 });
  m.transaction.mockImplementation((callback) => callback({
    collection: { count: m.count }, itemType: { findFirst: vi.fn().mockResolvedValue({ id: "type" }) },
    item: { create: m.create, findFirst: m.findFirst, update: m.update },
    storageObject: { findFirst: m.storage, update: m.storageUpdate }, $queryRaw: m.query,
  }));
});

it("validates collection identifiers and deduplicates selections", () => {
  expect(itemUpdateSchema.parse({ title: "Title", tags: [], collectionIds: [" a ", "a"] }).collectionIds).toEqual(["a"]);
  for (const collectionIds of [[""], [4], "a", Array(101).fill("a")]) {
    expect(itemUpdateSchema.safeParse({ title: "Title", tags: [], collectionIds }).success).toBe(false);
  }
});

it("creates all selected memberships with owner validation", async () => {
  await createItem("owner", { type: "note", title: "Title", tags: [], collectionIds: ["a", "b", "a"] });
  expect(m.count).toHaveBeenCalledWith({ where: { userId: "owner", id: { in: ["a", "b"] } } });
  expect(m.create.mock.calls[0][0].data.collections).toEqual({ create: [{ collectionId: "a" }, { collectionId: "b" }] });
});

it.each([{ collectionIds: [] }, { collectionIds: ["a"] }, { collectionIds: ["a", "b"] }])("replaces memberships while retaining existing addedAt values: $collectionIds", async ({ collectionIds }) => {
  m.count.mockResolvedValue(collectionIds.length);
  m.findFirst.mockResolvedValueOnce({ type: { slug: "note" } }).mockResolvedValueOnce(null);
  await updateItem("owner", "item", { title: "Title", tags: [], collectionIds });
  expect(m.update.mock.calls[0][0].data.collections).toEqual({
    deleteMany: { collectionId: { notIn: collectionIds } },
    createMany: { data: collectionIds.map((collectionId) => ({ collectionId })), skipDuplicates: true },
  });
});

it("preserves memberships for callers omitting the field", async () => {
  m.findFirst.mockResolvedValueOnce({ type: { slug: "note" } }).mockResolvedValueOnce(null);
  await updateItem("owner", "item", { title: "Title", tags: [] });
  expect(m.update.mock.calls[0][0].data).not.toHaveProperty("collections");
  expect(m.count).not.toHaveBeenCalled();
});

it.each(["create", "update", "upload"])("rejects missing or foreign collections before %s writes", async (mode) => {
  m.count.mockResolvedValue(1);
  const input = { title: "Title", tags: [], collectionIds: ["owned", "foreign"] };
  const operation = mode === "create" ? createItem("owner", { ...input, type: "note" }) : mode === "update" ? updateItem("owner", "item", input) : finalizeUploadRecord("owner", "upload", input, async () => "text/plain");
  await expect(operation).rejects.toThrow("unavailable");
  expect(m.create).not.toHaveBeenCalled();
  expect(m.update).not.toHaveBeenCalled();
  expect(m.storageUpdate).not.toHaveBeenCalled();
});

it("does not validate or mutate memberships on another owner's item", async () => {
  m.findFirst.mockResolvedValue(null);
  expect(await updateItem("owner", "foreign", { title: "Title", tags: [], collectionIds: ["a"] })).toBeNull();
  expect(m.count).not.toHaveBeenCalled();
  expect(m.update).not.toHaveBeenCalled();
});

it.each(["file", "image"])("attaches collections during %s finalization", async (type) => {
  m.storage.mockResolvedValue({ state: "pending", expiresAt: new Date(Date.now() + 60000), type, key: "key", fileName: "a.txt", size: 3 });
  await finalizeUploadRecord("owner", "upload", { title: "Title", tags: [], collectionIds: ["a", "b"] }, async () => "text/plain");
  expect(m.create.mock.calls[0][0].data.collections.create).toEqual([{ collectionId: "a" }, { collectionId: "b" }]);
  expect(m.storageUpdate).toHaveBeenCalled();
});
