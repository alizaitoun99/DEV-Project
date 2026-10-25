import "server-only";

import { prisma } from "@/lib/prisma";

export interface CollectionSummary {
  id: string;
  name: string;
  description: string | null;
  isFavorite: boolean;
  itemCount: number;
  types: { id: string; slug: string; name: string; count: number }[];
}

const TYPE_ORDER = ["snippet", "prompt", "command", "note", "file", "image", "link"];

export async function getRecentCollections(userId: string, limit = 6): Promise<CollectionSummary[]> {
  const collections = await prisma.collection.findMany({
    where: { userId },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    take: limit,
    select: {
      id: true, name: true, description: true, isFavorite: true,
      items: {
        where: { item: { userId } },
        select: { item: { select: { type: { select: { id: true, slug: true, name: true } } } } },
      },
    },
  });

  return collections.map(({ items, ...collection }) => {
    const counts = new Map<string, CollectionSummary["types"][number]>();
    for (const { item: { type } } of items) {
      const existing = counts.get(type.id);
      counts.set(type.id, { ...type, count: (existing?.count ?? 0) + 1 });
    }
    const types = [...counts.values()].sort((a, b) => b.count - a.count
      || (TYPE_ORDER.indexOf(a.slug) < 0 ? TYPE_ORDER.length : TYPE_ORDER.indexOf(a.slug))
      - (TYPE_ORDER.indexOf(b.slug) < 0 ? TYPE_ORDER.length : TYPE_ORDER.indexOf(b.slug))
      || a.slug.localeCompare(b.slug));
    return { ...collection, itemCount: items.length, types };
  });
}

export async function getCollectionStats(userId: string) {
  const [total, favorites] = await Promise.all([
    prisma.collection.count({ where: { userId } }),
    prisma.collection.count({ where: { userId, isFavorite: true } }),
  ]);
  return { total, favorites };
}

export async function getFavoriteCollections(userId: string) {
  return prisma.collection.findMany({
    where: { userId, isFavorite: true },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    select: { id: true, name: true },
  });
}
