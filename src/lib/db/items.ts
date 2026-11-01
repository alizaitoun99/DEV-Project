import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export async function getItemDetail(userId: string, id: string) {
  const item = await prisma.item.findFirst({
    where: { id, userId },
    select: {
      ...itemSelect(userId), content: true, url: true, language: true,
      createdAt: true, fileName: true, fileSize: true, fileMimeType: true,
      collections: {
        where: { collection: { userId } },
        orderBy: { collection: { name: "asc" } },
        select: { collection: { select: { id: true, name: true } } },
      },
    },
  });
  if (!item) return null;
  return {
    ...item, fileSize: item.fileSize?.toString() ?? null,
    createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString(),
  };
}

export type ItemDetail = NonNullable<Awaited<ReturnType<typeof getItemDetail>>>;

export interface ItemSummary {
  id: string;
  title: string;
  description: string | null;
  isPinned: boolean;
  isFavorite: boolean;
  updatedAt: Date;
  type: { slug: string; name: string };
  tags: { tag: { name: string } }[];
}

function itemSelect(userId: string) {
  return {
    id: true, title: true, description: true, isPinned: true, isFavorite: true,
    updatedAt: true,
    type: { select: { slug: true, name: true } },
    tags: {
      where: { tag: { userId } },
      orderBy: { tag: { name: "asc" } },
      select: { tag: { select: { name: true } } },
    },
  } satisfies Prisma.ItemSelect;
}

export async function getPinnedItems(userId: string): Promise<ItemSummary[]> {
  return prisma.item.findMany({
    where: { userId, isPinned: true },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    select: itemSelect(userId),
  });
}

export async function getItemsByType(userId: string, typeId: string): Promise<ItemSummary[]> {
  return prisma.item.findMany({
    where: { userId, typeId },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    select: itemSelect(userId),
  });
}

export async function getRecentItems(userId: string, limit = 10): Promise<ItemSummary[]> {
  return prisma.item.findMany({
    where: { userId },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    take: limit,
    select: itemSelect(userId),
  });
}

export async function getItemStats(userId: string) {
  const [total, favorites] = await Promise.all([
    prisma.item.count({ where: { userId } }),
    prisma.item.count({ where: { userId, isFavorite: true } }),
  ]);
  return { total, favorites };
}

export async function getSystemItemTypes(userId?: string) {
  return prisma.itemType.findMany({
    where: { isSystem: true },
    orderBy: { id: "asc" },
    select: {
      id: true, slug: true, name: true,
      _count: { select: { items: { where: { userId: userId ?? "" } } } },
    },
  });
}
