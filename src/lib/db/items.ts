import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

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
