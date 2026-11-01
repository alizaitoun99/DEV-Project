import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export async function getItemDetail(userId: string, id: string, db: Prisma.TransactionClient = prisma) {
  const item = await db.item.findFirst({
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

export async function deleteItem(userId: string, id: string) {
  // Keep storage references intact until a retryable object cleanup lifecycle exists.
  const result = await prisma.item.deleteMany({ where: { id, userId, fileKey: null } });
  if (result.count > 0) return "deleted";
  const remaining = await prisma.item.findFirst({ where: { id, userId }, select: { fileKey: true } });
  return remaining?.fileKey != null ? "stored-file" : "not-found";
}

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

export async function updateItem(userId: string, id: string, input: import("@/lib/item-validation").ItemUpdateInput) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.item.findFirst({ where: { id, userId }, select: { type: { select: { slug: true } } } });
    if (!existing) return null;
    const slug = existing.type.slug;
    const tags = [...new Map(input.tags.map((name) => [name.toLowerCase(), name])).entries()];
    await tx.item.update({
      where: { id, userId },
      data: {
        title: input.title, description: input.description,
        ...(["snippet", "prompt", "command", "note"].includes(slug) ? { content: input.content } : {}),
        ...(["snippet", "command"].includes(slug) ? { language: input.language } : {}),
        ...(slug === "link" ? { url: input.url } : {}),
        tags: {
          deleteMany: {},
          create: tags.map(([tagSlug, name]) => ({ tag: { connectOrCreate: {
            where: { userId_slug: { userId, slug: tagSlug } }, create: { userId, slug: tagSlug, name },
          } } })),
        },
      },
    });
    return getItemDetail(userId, id, tx);
  });
}
