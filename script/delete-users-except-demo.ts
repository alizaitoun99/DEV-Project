import "dotenv/config";

import { Prisma } from "../src/generated/prisma/client";
import { prisma } from "../src/lib/prisma";
import { enqueueAccountStorage } from "../src/lib/db/items";
import { assertNoBillingForBulkDeletion } from "../src/lib/billing/account-deletion";

const DEMO_EMAIL = "demo@devstash.io";
const execute = process.argv.includes("--execute");

function snapshot(value: unknown): string {
  return JSON.stringify(value, (_key, entry) => typeof entry === "bigint" ? entry.toString() : entry);
}

async function protectedData(tx: Prisma.TransactionClient, id: string) {
  return tx.user.findUniqueOrThrow({
    where: { id },
    include: {
      accounts: { orderBy: { id: "asc" } },
      sessions: { orderBy: { id: "asc" } },
      customTypes: { orderBy: { id: "asc" } },
      items: { orderBy: { id: "asc" }, include: {
        collections: { orderBy: { collectionId: "asc" } },
        tags: { orderBy: { tagId: "asc" } },
      } },
      collections: { orderBy: { id: "asc" }, include: { items: { orderBy: { itemId: "asc" } } } },
      tags: { orderBy: { id: "asc" }, include: { items: { orderBy: { itemId: "asc" } } } },
    },
  });
}

async function main() {
  if (process.argv.slice(2).some((arg) => arg !== "--execute")) throw new Error("Usage: npm run db:delete-users -- [--execute]");
  const connection = new URL(process.env.DATABASE_URL ?? "");
  console.log(`Database: ${connection.hostname}${connection.pathname}`);
  console.log(execute ? "EXECUTE: deleting other users and their database content." : "PREVIEW: no data will be deleted. Add --execute to apply.");
  await prisma.$transaction(async (tx) => {
    const demo = await tx.user.findUnique({ where: { email: DEMO_EMAIL }, select: { id: true } });
    if (!demo) throw new Error(`Aborted: ${DEMO_EMAIL} does not exist. No users were deleted.`);
    const users = await tx.user.findMany({ where: { id: { not: demo.id } }, select: { id: true, email: true }, orderBy: { id: "asc" } });
    const ids = users.map((user) => user.id);
    const owner = { userId: { in: ids } };
    const identifiers = users.flatMap((user) => user.email ? [user.email, `email-verification:${user.id}:${user.email}`] : []);
    const counts = {
      users: users.length,
      items: await tx.item.count({ where: owner }),
      collections: await tx.collection.count({ where: owner }),
      tags: await tx.tag.count({ where: owner }),
      customTypes: await tx.itemType.count({ where: owner }),
      accounts: await tx.account.count({ where: owner }),
      sessions: await tx.session.count({ where: owner }),
      verificationTokens: await tx.verificationToken.count({ where: { identifier: { in: identifiers } } }),
    };
    console.log(`Preserving ${DEMO_EMAIL}; shared system types and auth rate limits are retained.`);
    console.table(counts);
    if (!execute || ids.length === 0) return;
    const before = snapshot(await protectedData(tx, demo.id));
    for (const id of ids) {
      await assertNoBillingForBulkDeletion(tx, id);
      await enqueueAccountStorage(tx, id);
    }
    await tx.verificationToken.deleteMany({ where: { identifier: { in: identifiers } } });
    // Remove items before user-owned types, whose item foreign keys restrict deletion.
    await tx.item.deleteMany({ where: owner });
    const deleted = await tx.user.deleteMany({ where: { id: { in: ids } } });
    if (snapshot(await protectedData(tx, demo.id)) !== before) {
      throw new Error("Aborted: deletion would change the demo user's data or memberships. Transaction rolled back.");
    }
    console.log(`Deleted ${deleted.count} users. Demo account and content preserved.`);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 60000 });
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "User cleanup failed.");
  process.exitCode = 1;
}).finally(async () => { await prisma.$disconnect(); });
