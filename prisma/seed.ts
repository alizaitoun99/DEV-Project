import "dotenv/config";

import { COLLECTIONS, CURRENT_USER, ITEMS, ITEM_TYPES } from "../src/lib/mock-data";
import { prisma } from "../src/lib/prisma";

async function main(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Mock data seeding is for development only.");
  }

  await prisma.$transaction(async (tx) => {
    const conflictingItems = await tx.item.count({ where: {
      id: { in: ITEMS.map((item) => item.id) }, userId: { not: CURRENT_USER.id },
    } });
    const conflictingCollections = await tx.collection.count({ where: {
      id: { in: COLLECTIONS.map((collection) => collection.id) },
      userId: { not: CURRENT_USER.id },
    } });
    const conflictingTypes = await tx.itemType.count({ where: {
      id: { in: ITEM_TYPES.map((type) => type.id) }, isSystem: false,
    } });
    if (conflictingItems || conflictingCollections || conflictingTypes) {
      throw new Error("Fixture IDs conflict with existing ownership.");
    }

    await tx.user.upsert({
      where: { id: CURRENT_USER.id },
      create: CURRENT_USER,
      update: {},
    });

    for (const type of ITEM_TYPES) {
      await tx.itemType.upsert({
        where: { id: type.id },
        create: { ...type, isSystem: true },
        update: {},
      });
    }

    for (const collection of COLLECTIONS) {
      await tx.collection.upsert({
        where: { id: collection.id },
        create: { ...collection, userId: CURRENT_USER.id },
        update: {},
      });
    }

    for (const item of ITEMS) {
      const { collectionIds, tags, ...fields } = item;
      const tagRecords = [];
      for (const name of tags) {
        const slug = name.trim().toLowerCase();
        const tag = await tx.tag.upsert({
          where: { userId_slug: { userId: CURRENT_USER.id, slug } },
          create: { name, slug, userId: CURRENT_USER.id },
          update: {},
        });
        tagRecords.push(tag);
      }

      await tx.item.upsert({
        where: { id: item.id },
        create: {
          ...fields,
          userId: CURRENT_USER.id,
          fileSize: item.fileSize === undefined ? undefined : BigInt(item.fileSize),
          createdAt: new Date(item.createdAt),
          updatedAt: new Date(item.updatedAt),
          lastOpenedAt: item.lastOpenedAt ? new Date(item.lastOpenedAt) : null,
        },
        update: {},
      });

      for (const collectionId of collectionIds) {
        await tx.itemCollection.upsert({
          where: { itemId_collectionId: { itemId: item.id, collectionId } },
          create: { itemId: item.id, collectionId, addedAt: new Date(item.createdAt) },
          update: {},
        });
      }
      for (const tag of tagRecords) {
        await tx.itemTag.upsert({
          where: { itemId_tagId: { itemId: item.id, tagId: tag.id } },
          create: { itemId: item.id, tagId: tag.id },
          update: {},
        });
      }
    }

    const counts = {
      users: await tx.user.count({ where: { id: CURRENT_USER.id } }),
      types: await tx.itemType.count({ where: { id: { in: ITEM_TYPES.map((type) => type.id) } } }),
      collections: await tx.collection.count({ where: { userId: CURRENT_USER.id } }),
      items: await tx.item.count({ where: { userId: CURRENT_USER.id } }),
      tags: await tx.tag.count({ where: { userId: CURRENT_USER.id } }),
      memberships: await tx.itemCollection.count({ where: { item: { userId: CURRENT_USER.id } } }),
      itemTags: await tx.itemTag.count({ where: { item: { userId: CURRENT_USER.id } } }),
    };
    console.log("Development mock data verified:", counts);
  }, { timeout: 60000 });
}

main()
  .catch(() => {
    console.error("Development seed failed; transaction rolled back. Check configuration and fixture conflicts.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
