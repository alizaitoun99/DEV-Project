import "dotenv/config";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/prisma";

// Preview by default. Only the development demo account's seeded collections are affected.
async function main() {
  const execute = process.argv.includes("--execute");
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { email: "demo@devistage.io" }, select: { id: true } });
    const collections = await tx.collection.findMany({ where: { userId: user.id }, orderBy: { id: "asc" } });
    const itemCount = await tx.item.count({ where: { userId: user.id } });
    for (const source of collections.filter(({ id }) => id.startsWith(`demo-${user.id}-`))) {
      const target = collections.find((candidate) => candidate.id !== source.id
        && !candidate.id.startsWith("demo-") && candidate.name === source.name);
      console.log(`${execute ? "Apply" : "Preview"}: ${source.name}: ${target ? "merge duplicate into existing collection" : "replace seeded ID with UUID"}`);
      if (!execute) continue;
      if (!target) {
        // Prisma's cascading FK update preserves every membership and its addedAt.
        await tx.collection.update({ where: { id: source.id }, data: { id: randomUUID() } });
        continue;
      }
      if (source.defaultTypeId && target.defaultTypeId && source.defaultTypeId !== target.defaultTypeId) {
        throw new Error("Conflicting default types; transaction rolled back.");
      }
      const memberships = await tx.itemCollection.findMany({ where: { collectionId: source.id } });
      await tx.itemCollection.createMany({
        data: memberships.map(({ itemId, addedAt }) => ({ itemId, addedAt, collectionId: target.id })),
        skipDuplicates: true,
      });
      await tx.collection.update({ where: { id: target.id }, data: {
        isFavorite: target.isFavorite || source.isFavorite,
        defaultTypeId: target.defaultTypeId ?? source.defaultTypeId,
        description: target.description || source.description,
      } });
      // Removes the duplicate collection and its memberships, never the items themselves.
      await tx.collection.delete({ where: { id: source.id } });
      const retained = await tx.itemCollection.count({ where: { collectionId: target.id, itemId: { in: memberships.map(({ itemId }) => itemId) } } });
      if (retained !== memberships.length) throw new Error("Membership preservation failed.");
    }
    if (await tx.item.count({ where: { userId: user.id } }) !== itemCount) throw new Error("Item count changed.");
  }, { timeout: 30000 });
}

main().catch(() => {
  console.error("Normalization failed; all changes rolled back.");
  process.exitCode = 1;
}).finally(async () => { await prisma.$disconnect(); });
