import "server-only";
import { COLLECTIONS_PER_PAGE, DASHBOARD_COLLECTIONS_LIMIT } from "@/lib/pagination";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { collectionCreateSchema, type CollectionCreateInput } from "@/lib/collection-validation";

export async function createCollection(userId: string, input: CollectionCreateInput) {
  const fields = collectionCreateSchema.parse(input);
  return prisma.collection.create({
    data: { userId, name: fields.name, description: fields.description || null },
    select: { id: true, name: true, description: true },
  });
}

export async function updateCollection(userId: string, id: string, input: CollectionCreateInput) {
  const fields = collectionCreateSchema.parse(input);
  const result = await prisma.collection.updateMany({
    where: { id, userId },
    data: { name: fields.name, description: fields.description || null },
  });
  return result.count > 0;
}

export async function deleteCollection(userId: string, id: string) {
  // The collection foreign key cascades to memberships only, never to items.
  const result = await prisma.collection.deleteMany({ where: { id, userId } });
  return result.count > 0;
}

export interface CollectionSummary {
  id: string;
  name: string;
  description: string | null;
  isFavorite: boolean;
  itemCount: number;
  types: { id: string; slug: string; name: string; count: number }[];
}

const TYPE_ORDER = ["snippet", "prompt", "command", "note", "file", "image", "link"];

interface CollectionTypeCount {
  collectionId: string;
  id: string;
  slug: string;
  name: string;
  count: bigint;
}

export async function getCollections(userId: string, limit = COLLECTIONS_PER_PAGE, skip = 0): Promise<CollectionSummary[]> {
  const collections = await prisma.collection.findMany({
    where: { userId },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    take: limit, skip,
    select: {
      id: true, name: true, description: true, isFavorite: true,
    },
  });

  if (collections.length === 0) return [];

  // Return one row per collection/type, rather than one row per membership.
  // Both owners are checked because membership foreign keys alone do not enforce ownership.
  const counts = await prisma.$queryRaw<CollectionTypeCount[]>(Prisma.sql`
    SELECT membership."collectionId", type."id", type."slug", type."name", COUNT(*) AS "count"
    FROM "ItemCollection" AS membership
    JOIN "Collection" AS collection ON collection."id" = membership."collectionId"
    JOIN "Item" AS item ON item."id" = membership."itemId"
    JOIN "ItemType" AS type ON type."id" = item."typeId"
    WHERE collection."userId" = ${userId} AND item."userId" = ${userId}
      AND membership."collectionId" IN (${Prisma.join(collections.map(({ id }) => id))})
    GROUP BY membership."collectionId", type."id", type."slug", type."name"
  `);
  const typesByCollection = new Map<string, CollectionSummary["types"]>();
  for (const { collectionId, count, ...type } of counts) {
    const types = typesByCollection.get(collectionId) ?? [];
    types.push({ ...type, count: Number(count) });
    typesByCollection.set(collectionId, types);
  }

  return collections.map((collection) => {
    const types = (typesByCollection.get(collection.id) ?? []).sort((a, b) => b.count - a.count
      || (TYPE_ORDER.indexOf(a.slug) < 0 ? TYPE_ORDER.length : TYPE_ORDER.indexOf(a.slug))
      - (TYPE_ORDER.indexOf(b.slug) < 0 ? TYPE_ORDER.length : TYPE_ORDER.indexOf(b.slug))
      || a.slug.localeCompare(b.slug));
    return { ...collection, itemCount: types.reduce((total, type) => total + type.count, 0), types };
  });
}

export async function getCollectionStats(userId: string) {
  const [total, favorites] = await Promise.all([
    prisma.collection.count({ where: { userId } }),
    prisma.collection.count({ where: { userId, isFavorite: true } }),
  ]);
  return { total, favorites };
}

export async function getRecentCollections(userId: string, limit = DASHBOARD_COLLECTIONS_LIMIT): Promise<CollectionSummary[]> {
  return getCollections(userId, limit);
}

export async function getCollection(userId: string, id: string) {
  return prisma.collection.findFirst({
    where: { id, userId },
    select: { id: true, name: true, description: true, isFavorite: true },
  });
}

export async function getFavoriteCollections(userId: string) {
  return prisma.collection.findMany({
    where: { userId, isFavorite: true },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    select: { id: true, name: true },
  });
}

export async function getCollectionOptions(userId: string) {
  return prisma.collection.findMany({
    where: { userId }, orderBy: [{ name: "asc" }, { id: "asc" }],
    select: { id: true, name: true },
  });
}
