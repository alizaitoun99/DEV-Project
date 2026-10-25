import "dotenv/config";

import assert from "node:assert/strict";
import { compare } from "bcryptjs";
import { prisma } from "../src/lib/prisma";

async function main(): Promise<void> {
  if (process.env.NODE_ENV === "production") throw new Error("Development accounts only.");
  await prisma.$transaction(async (tx) => {
    const target = await tx.user.findFirstOrThrow({
      where: { email: { in: ["demo@devstash.io", "demo@devistage.io"] } },
    });
    assert(target.passwordHash && await compare("12345678", target.passwordHash), "Unexpected demo password.");
    const source = await tx.user.findUnique({ where: { id: "user-john" } });
    if (source) {
      assert.equal(source.email, "john@example.com");
      const [tags, types, accounts, sessions] = await Promise.all([
        tx.tag.count({ where: { userId: target.id } }),
        tx.itemType.count({ where: { userId: source.id } }),
        tx.account.count({ where: { userId: source.id } }),
        tx.session.count({ where: { userId: source.id } }),
      ]);
      assert.equal(tags + types + accounts + sessions, 0, "Unexpected records require merge conflict review.");
      assert.equal(source.stripeCustomerId, null);
      assert.equal(source.stripeSubscriptionId, null);
      const before = await Promise.all([
        tx.item.count(), tx.collection.count(), tx.tag.count(),
        tx.itemCollection.count(), tx.itemTag.count(),
      ]);
      await tx.item.updateMany({ where: { userId: source.id }, data: { userId: target.id } });
      await tx.collection.updateMany({ where: { userId: source.id }, data: { userId: target.id } });
      await tx.tag.updateMany({ where: { userId: source.id }, data: { userId: target.id } });
      await tx.user.delete({ where: { id: source.id } });
      const after = await Promise.all([
        tx.item.count(), tx.collection.count(), tx.tag.count(),
        tx.itemCollection.count(), tx.itemTag.count(),
      ]);
      assert.deepEqual(after, before, "Merge must preserve all content and memberships.");
    }
    await tx.user.update({
      where: { id: target.id },
      data: { name: "John Doe", email: "demo@devistage.io", plan: "PRO" },
    });
    console.log("Accounts merged; content, memberships, pins, and password preserved.");
  }, { timeout: 60000 });
}

main().catch(() => {
  console.error("Account merge failed and rolled back; inspect the account preconditions.");
  process.exitCode = 1;
}).finally(async () => { await prisma.$disconnect(); });
