import "server-only";

import { prisma } from "@/lib/prisma";

export async function getFavorites(userId: string) {
  const [items, collections] = await Promise.all([
    prisma.item.findMany({
      where: { userId, isFavorite: true },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      select: {
        id: true, title: true, createdAt: true,
        type: { select: { slug: true, name: true } },
      },
    }),
    prisma.collection.findMany({
      where: { userId, isFavorite: true },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      select: { id: true, name: true, createdAt: true },
    }),
  ]);
  return { items, collections };
}
