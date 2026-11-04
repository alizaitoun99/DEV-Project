import { describe, expect, it } from "vitest";
import { sortFavorites } from "./favorite-sorting";

const items = [
  { id: "b", title: "zebra", createdAt: new Date("2026-01-01"), type: { name: "Command" } },
  { id: "c", title: "Alpha", createdAt: new Date("2026-03-01"), type: { name: "Snippet" } },
  { id: "a", title: "alpha", createdAt: new Date("2026-03-01"), type: { name: "Snippet" } },
];

describe("sortFavorites", () => {
  it("sorts names case-insensitively in either direction with stable ID ties", () => {
    expect(sortFavorites(items, "name-asc").map((item) => item.id)).toEqual(["a", "c", "b"]);
    expect(sortFavorites(items, "name-desc").map((item) => item.id)).toEqual(["b", "a", "c"]);
  });

  it("sorts creation dates in either direction with deterministic ties", () => {
    expect(sortFavorites(items, "date-desc").map((item) => item.id)).toEqual(["a", "c", "b"]);
    expect(sortFavorites(items, "date-asc").map((item) => item.id)).toEqual(["b", "a", "c"]);
  });

  it("sorts by displayed item type in either direction", () => {
    expect(sortFavorites(items, "type-asc").map((item) => item.id)).toEqual(["b", "a", "c"]);
    expect(sortFavorites(items, "type-desc").map((item) => item.id)).toEqual(["a", "c", "b"]);
  });

  it("supports collection names and preserves the source array", () => {
    const collections = items.map(({ id, title, createdAt }) => ({ id, name: title, createdAt }));
    expect(sortFavorites(collections, "name-asc").map((item) => item.id)).toEqual(["a", "c", "b"]);
    expect(collections.map((item) => item.id)).toEqual(["b", "c", "a"]);
    expect(sortFavorites([], "date-desc")).toEqual([]);
  });
});
