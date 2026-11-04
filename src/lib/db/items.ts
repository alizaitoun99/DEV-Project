import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "node:crypto";
import { UploadError, type UploadIntent } from "@/lib/upload-validation";
import type { StorageObject } from "@/generated/prisma/client";
import { z } from "zod";
import { linkUpdateSchema } from "@/lib/item-validation";

async function validateCollections(tx: Prisma.TransactionClient, userId: string, ids?: string[]) {
  if (ids === undefined) return undefined;
  const collectionIds = [...new Set(ids)];
  if (collectionIds.length) {
    const owned = await tx.collection.count({ where: { userId, id: { in: collectionIds } } });
    if (owned !== collectionIds.length) throw new z.ZodError([{ code: "custom", path: ["collectionIds"], message: "One or more selected collections are unavailable. Reload the form and try again." }]);
  }
  return collectionIds;
}

export async function lockStorageOwner(tx: Prisma.TransactionClient, userId: string) {
  const users = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
  if (!users.length) throw new Error("Account no longer exists.");
}

export async function createUploadRecord(userId: string, bucket: string, input: UploadIntent) {
  return prisma.$transaction(async (tx) => {
    await lockStorageOwner(tx, userId);
    const outstanding = await tx.storageObject.count({ where: { userId, state: "pending" } });
    if (outstanding >= 20) throw new UploadError("Too many pending uploads. Try again after cleanup.");
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000 + 10 * 60 * 1000);
    return tx.storageObject.create({ data: {
      ...input, userId, bucket, key: `${userId}/${randomUUID()}`, expiresAt, retryAt: expiresAt,
    } });
  });
}

export async function finalizeUploadRecord(userId: string, id: string, input: import("@/lib/item-validation").ItemUpdateInput, verify: (record: StorageObject) => Promise<string>) {
  return prisma.$transaction(async (tx) => {
    await lockStorageOwner(tx, userId);
    await tx.$queryRaw`SELECT id FROM "StorageObject" WHERE id = ${id} AND "userId" = ${userId} FOR UPDATE`;
    const record = await tx.storageObject.findFirst({ where: { id, userId } });
    if (!record) throw new UploadError("Upload not found.");
    if (record.state === "attached" && record.itemId) return { id: record.itemId };
    if (record.state !== "pending" || record.expiresAt <= new Date()) throw new UploadError("Upload expired. Select the file again.");
    const mime = await verify(record);
    const type = await tx.itemType.findFirst({ where: { slug: record.type, kind: "FILE", isSystem: true, userId: null }, select: { id: true } });
    if (!type) throw new Error("Item type unavailable.");
    const collectionIds = await validateCollections(tx, userId, input.collectionIds);
    const tags = [...new Map(input.tags.map((name) => [name.toLowerCase(), name])).entries()];
    const item = await tx.item.create({ data: {
      userId, typeId: type.id, title: input.title, description: input.description,
      fileKey: record.key, fileName: record.fileName, fileSize: record.size, fileMimeType: mime,
      ...(collectionIds ? { collections: { create: collectionIds.map((collectionId) => ({ collectionId })) } } : {}),
      tags: { create: tags.map(([slug, name]) => ({ tag: { connectOrCreate: {
        where: { userId_slug: { userId, slug } }, create: { userId, slug, name },
      } } })) },
    }, select: { id: true } });
    await tx.storageObject.update({ where: { id }, data: { state: "attached", itemId: item.id, mime } });
    return item;
  }, { timeout: 45000 });
}

export async function abandonUploadRecord(userId: string, id: string) {
  // The same row lock used by finalization prevents cleanup of a committed item.
  return prisma.storageObject.updateMany({ where: { id, userId, state: "pending" }, data: { state: "cleanup", retryAt: new Date() } });
}

export async function getStoredItem(userId: string, id: string) {
  return prisma.item.findFirst({ where: { id, userId, fileKey: { not: null } }, select: {
    fileKey: true, fileName: true, fileMimeType: true,
  } });
}

export async function getStorageRecord(userId: string, key: string) {
  return prisma.storageObject.findFirst({ where: { key, userId, state: "attached" }, select: { bucket: true } });
}

export async function getItemCleanupRecord(userId: string, itemId: string) {
  return prisma.storageObject.findFirst({ where: { userId, itemId, state: "cleanup" }, select: { id: true } });
}

export async function cleanupStorageRecords(remove: (bucket: string, key: string) => Promise<void>, id?: string) {
  const records = await prisma.storageObject.findMany({ where: {
    ...(id ? { id } : {}), state: { in: ["pending", "cleanup"] }, retryAt: { lte: new Date() },
  }, orderBy: { retryAt: "asc" }, take: 20, select: { id: true } });
  let failures = 0;
  for (const { id } of records) {
    await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<StorageObject[]>`SELECT * FROM "StorageObject" WHERE id = ${id} FOR UPDATE SKIP LOCKED`;
      const record = locked[0];
      if (!record || !["pending", "cleanup"].includes(record.state) || record.retryAt > new Date()) return;
      try {
        await remove(record.bucket, record.key);
        // expiresAt includes the signed URL lifetime and ten minutes for in-flight uploads.
        if (record.expiresAt <= new Date()) {
          await tx.storageObject.delete({ where: { id } });
        } else {
          await tx.storageObject.update({ where: { id }, data: { state: "cleanup", attempts: { increment: 1 }, lastError: null, retryAt: record.expiresAt } });
        }
      } catch {
        failures++;
        await tx.storageObject.update({ where: { id }, data: { state: "cleanup", attempts: { increment: 1 }, lastError: "Storage removal failed", retryAt: new Date(Date.now() + 300000) } });
      }
    }, { timeout: 30000 });
  }
  return { processed: records.length, failures };
}

export async function enqueueAccountStorage(tx: Prisma.TransactionClient, userId: string) {
  await lockStorageOwner(tx, userId);
  // Reject unknown legacy keys rather than cascading away their only reference.
  const items = await tx.item.findMany({ where: { userId, fileKey: { not: null } }, select: { fileKey: true } });
  const records = await tx.storageObject.findMany({ where: { userId }, select: { key: true } });
  if (items.some((item) => !records.some((record) => record.key === item.fileKey))) throw new Error("Untracked storage requires recovery before account deletion.");
  await tx.storageObject.updateMany({ where: { userId }, data: { state: "cleanup", retryAt: new Date() } });
}

export async function createItem(userId: string, input: import("@/lib/item-validation").ItemCreateInput) {
  return prisma.$transaction(async (tx) => {
    const type = await tx.itemType.findFirst({
      where: { slug: input.type, isSystem: true, userId: null, kind: input.type === "link" ? "URL" : "TEXT" },
      select: { id: true },
    });
    if (!type) return null;
    const collectionIds = await validateCollections(tx, userId, input.collectionIds);
    const tags = [...new Map(input.tags.map((name) => [name.toLowerCase(), name])).entries()];
    return tx.item.create({
      data: {
        userId, typeId: type.id, title: input.title, description: input.description ?? null,
        content: input.type === "link" ? null : input.content ?? null,
        language: ["snippet", "command"].includes(input.type) ? input.language ?? null : null,
        url: input.type === "link" ? input.url : null,
        ...(collectionIds ? { collections: { create: collectionIds.map((collectionId) => ({ collectionId })) } } : {}),
        tags: { create: tags.map(([slug, name]) => ({ tag: { connectOrCreate: {
          where: { userId_slug: { userId, slug } }, create: { userId, slug, name },
        } } })) },
      },
      select: { id: true },
    });
  });
}

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
  if (!remaining?.fileKey) return "not-found";
  return prisma.$transaction(async (tx) => {
    await lockStorageOwner(tx, userId);
    const item = await tx.item.findFirst({ where: { id, userId }, select: { fileKey: true } });
    if (!item?.fileKey) return "not-found";
    const record = await tx.storageObject.updateMany({ where: { userId, key: item.fileKey, state: "attached", itemId: id }, data: { state: "cleanup", retryAt: new Date() } });
    if (!record.count) return "stored-file";
    await tx.item.delete({ where: { id, userId } });
    return "deleted";
  });
}

export interface ItemSummary {
  id: string;
  title: string;
  description: string | null;
  fileMimeType: string | null;
  isPinned: boolean;
  isFavorite: boolean;
  updatedAt: Date;
  type: { slug: string; name: string };
  tags: { tag: { name: string } }[];
}

function itemSelect(userId: string) {
  return {
    id: true, title: true, description: true, isPinned: true, isFavorite: true,
    updatedAt: true, fileMimeType: true,
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

export async function getSearchItems(userId: string): Promise<import("@/types/search").SearchItem[]> {
  const items = await prisma.item.findMany({
    where: { userId },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    select: { id: true, title: true, type: { select: { slug: true, name: true } }, content: true, description: true },
  });
  return items.map(({ content, description, ...item }) => ({
    ...item, preview: (content || description || "").replace(/\s+/g, " ").trim().slice(0, 240),
  }));
}

export async function getItemsByType(userId: string, typeId: string): Promise<ItemSummary[]> {
  return prisma.item.findMany({
    where: { userId, typeId },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    select: itemSelect(userId),
  });
}

export async function getFilesByType(userId: string, typeId: string) {
  return prisma.item.findMany({
    where: { userId, typeId },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    select: { id: true, title: true, fileName: true, fileSize: true, createdAt: true },
  });
}

export async function getItemsByCollection(userId: string, collectionId: string): Promise<ItemSummary[]> {
  return prisma.item.findMany({
    where: { userId, collections: { some: { collectionId, collection: { userId } } } },
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
    // Derive required fields from the owned item, never a client-supplied type.
    if (slug === "link") input = linkUpdateSchema.parse(input);
    const collectionIds = await validateCollections(tx, userId, input.collectionIds);
    const tags = [...new Map(input.tags.map((name) => [name.toLowerCase(), name])).entries()];
    await tx.item.update({
      where: { id, userId },
      data: {
        title: input.title, description: input.description,
        ...(["snippet", "prompt", "command", "note"].includes(slug) ? { content: input.content } : {}),
        ...(["snippet", "command"].includes(slug) ? { language: input.language } : {}),
        ...(slug === "link" ? { url: input.url } : {}),
        ...(collectionIds ? { collections: {
          deleteMany: { collectionId: { notIn: collectionIds } },
          createMany: { data: collectionIds.map((collectionId) => ({ collectionId })), skipDuplicates: true },
        } } : {}),
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
