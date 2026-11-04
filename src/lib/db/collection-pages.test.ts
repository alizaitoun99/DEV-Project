import { beforeEach, expect, it, vi } from "vitest";

const { findMany, findFirst, queryRaw, itemFindMany, count } = vi.hoisted(() => ({
  findMany: vi.fn(), findFirst: vi.fn(), queryRaw: vi.fn(), itemFindMany: vi.fn(), count: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: {
  collection: { findMany, findFirst }, $queryRaw: queryRaw, item: { findMany: itemFindMany, count },
} }));
import { getCollection, getCollections, getRecentCollections } from "./collections";
import { getItemsByCollection, getItemsByType, getFilesByType, countItemsByCollection } from "./items";

beforeEach(() => vi.resetAllMocks());

it("lists owned collections within the listing page limit", async () => {
  const collections = Array.from({ length: 8 }, (_, index) => ({ id: `c${index}`, name: `Collection ${index}`, description: null, isFavorite: false }));
  findMany.mockResolvedValue(collections);
  queryRaw.mockResolvedValue([
    { collectionId: "c0", id: "note", slug: "note", name: "Notes", count: 2n },
    { collectionId: "c0", id: "snippet", slug: "snippet", name: "Snippets", count: 2n },
  ]);
  const result = await getCollections("owner");
  expect(result).toHaveLength(8);
  expect(findMany.mock.calls[0][0].where).toEqual({ userId: "owner" });
  expect(findMany.mock.calls[0][0]).toMatchObject({ take: 21, skip: 0 });
  expect(result[0].itemCount).toBe(4);
  expect(result[0].types.map(({ slug }) => slug)).toEqual(["snippet", "note"]);
  expect(result[1]).toMatchObject({ itemCount: 0, types: [] });
  const sql = queryRaw.mock.calls[0][0];
  expect(sql.sql).toContain('collection."userId" = ? AND item."userId" = ?');
  expect(sql.values.slice(0, 2)).toEqual(["owner", "owner"]);
});

it("keeps recent collections limited and skips aggregation for empty lists", async () => {
  findMany.mockResolvedValue([]);
  expect(await getRecentCollections("owner")).toEqual([]);
  expect(findMany.mock.calls[0][0].take).toBe(6);
  expect(queryRaw).not.toHaveBeenCalled();
});

it("returns null for missing or inaccessible collection details", async () => {
  findFirst.mockResolvedValue(null);
  expect(await getCollection("owner", "foreign")).toBeNull();
  expect(findFirst).toHaveBeenCalledWith({ where: { id: "foreign", userId: "owner" }, select: { id: true, name: true, description: true, isFavorite: true } });
});

it("restricts collection items and tags to the owner without exposing private contents", async () => {
  itemFindMany.mockResolvedValue([]);
  expect(await getItemsByCollection("owner", "collection")).toEqual([]);
  const query = itemFindMany.mock.calls[0][0];
  expect(query.where).toEqual({ userId: "owner", collections: { some: { collectionId: "collection", collection: { userId: "owner" } } } });
  expect(query.orderBy).toEqual([{ updatedAt: "desc" }, { id: "asc" }]);
  expect(query.select.tags.where).toEqual({ tag: { userId: "owner" } });
  expect(query.select).not.toHaveProperty("fileKey");
  expect(query.select).not.toHaveProperty("content");
});

it("bounds item and file pages with stable ordering and owner filters", async () => {
  itemFindMany.mockResolvedValue([]);
  await getItemsByType("owner", "type", 21);
  await getFilesByType("owner", "type", 42);
  await getItemsByCollection("owner", "collection", 63);
  for (const [index, skip] of [21, 42, 63].entries()) {
    expect(itemFindMany.mock.calls[index][0]).toMatchObject({
      take: 21, skip, where: { userId: "owner" },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    });
  }
});
it("counts only owned collection memberships", async () => {
  count.mockResolvedValue(43);
  expect(await countItemsByCollection("owner", "collection")).toBe(43);
  expect(count).toHaveBeenCalledWith({ where: { userId: "owner", collections: { some: { collectionId: "collection", collection: { userId: "owner" } } } } });
});
it("limits collection summaries to the requested page before aggregation", async () => {
  findMany.mockResolvedValue([]);
  await getCollections("owner", 21, 42);
  expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "owner" }, take: 21, skip: 42 }));
  expect(queryRaw).not.toHaveBeenCalled();
});
