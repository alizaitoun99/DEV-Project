import { beforeEach, expect, it, vi } from "vitest";

const { items, collections } = vi.hoisted(() => ({ items: vi.fn(), collections: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { item: { findMany: items }, collection: { findMany: collections } } }));
import { getFavorites } from "./favorites";

beforeEach(() => vi.resetAllMocks());

it("scopes both favorite sources to the owner with stable newest-update ordering and minimal metadata", async () => {
  items.mockResolvedValue([{ id: "item" }]);
  collections.mockResolvedValue([{ id: "collection" }]);
  expect(await getFavorites("owner")).toEqual({ items: [{ id: "item" }], collections: [{ id: "collection" }] });
  for (const source of [items, collections]) {
    expect(source.mock.calls[0][0].where).toEqual({ userId: "owner", isFavorite: true });
    expect(source.mock.calls[0][0].orderBy).toEqual([{ updatedAt: "desc" }, { id: "asc" }]);
    expect(source.mock.calls[0][0].take).toBeUndefined();
  }
  expect(items.mock.calls[0][0].select).toEqual({ id: true, title: true, createdAt: true, type: { select: { slug: true, name: true } } });
  expect(collections.mock.calls[0][0].select).toEqual({ id: true, name: true, createdAt: true });
});

it("returns empty sections when neither source has favorites", async () => {
  items.mockResolvedValue([]);
  collections.mockResolvedValue([]);
  expect(await getFavorites("owner")).toEqual({ items: [], collections: [] });
});

it("propagates database failures instead of reporting an empty favorites list", async () => {
  items.mockRejectedValue(new Error("unavailable"));
  collections.mockResolvedValue([]);
  await expect(getFavorites("owner")).rejects.toThrow("unavailable");
});
