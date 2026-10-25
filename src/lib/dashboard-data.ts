import { COLLECTIONS, ITEMS } from "@/lib/mock-data";

export function getRecentCollections(limit: number) {
  return COLLECTIONS.map((collection) => ({
    collection,
    lastOpened: Math.max(0, ...ITEMS.filter((item) => item.collectionIds.includes(collection.id))
      .map((item) => item.lastOpenedAt ? Date.parse(item.lastOpenedAt) : 0)),
  })).filter(({ lastOpened }) => lastOpened > 0)
    .sort((a, b) => b.lastOpened - a.lastOpened || a.collection.id.localeCompare(b.collection.id))
    .slice(0, limit).map(({ collection }) => collection);
}

export function getRecentItems(limit: number) {
  return [...ITEMS].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)
    || a.id.localeCompare(b.id)).slice(0, limit);
}
