import { beforeEach, expect, it, vi } from "vitest";

const { getSearchItems, getCollections } = vi.hoisted(() => ({ getSearchItems: vi.fn(), getCollections: vi.fn() }));
vi.mock("@/lib/db/items", () => ({ getSearchItems }));
vi.mock("@/lib/db/collections", () => ({ getCollections }));
import { getSearchData } from "./search";

beforeEach(() => vi.resetAllMocks());

it("passes the owner to both sources and exposes only collection search metadata", async () => {
  getSearchItems.mockResolvedValue([{ id: "item", title: "Example", type: { slug: "note", name: "Notes" }, preview: "Preview" }]);
  getCollections.mockResolvedValue([{ id: "collection", name: "Examples", itemCount: 2, description: "Private description", types: [], isFavorite: true }]);
  const data = await getSearchData("owner");
  expect(getSearchItems).toHaveBeenCalledWith("owner");
  expect(getCollections).toHaveBeenCalledWith("owner");
  expect(data.collections).toEqual([{ id: "collection", name: "Examples", itemCount: 2 }]);
  expect(data.items).toHaveLength(1);
});

it("propagates load failure rather than returning misleading partial results", async () => {
  getSearchItems.mockRejectedValue(new Error("unavailable"));
  getCollections.mockResolvedValue([]);
  await expect(getSearchData("owner")).rejects.toThrow("unavailable");
});
