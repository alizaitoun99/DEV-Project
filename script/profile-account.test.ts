import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { compare, hash } from "bcryptjs";
import { prisma } from "../src/lib/prisma";
import { changePasswordForUser, deleteAccountForUser } from "../src/lib/profile-account";

after(async () => { await prisma.$disconnect(); });

test("profile actions reject wrong passwords and OAuth password changes, invalidate resets, and delete only the owner", async () => {
  const marker = randomUUID();
  const owner = await prisma.user.create({ data: { email: `profile-${marker}@example.com`, passwordHash: await hash("original-password", 12) } });
  const other = await prisma.user.create({ data: { email: `profile-other-${marker}@example.com` } });
  const identifier = `password-reset:${owner.id}:${owner.email}`;
  try {
    const type = await prisma.itemType.findFirstOrThrow({ where: { isSystem: true } });
    await prisma.item.create({ data: { userId: owner.id, typeId: type.id, title: "Owned test item" } });
    await prisma.collection.create({ data: { userId: owner.id, name: "Owned test collection" } });
    await prisma.verificationToken.create({ data: { identifier, token: marker, expires: new Date(Date.now() + 60000) } });
    const input = { currentPassword: "wrong-password", password: "updated-password", confirmPassword: "updated-password" };
    assert.equal((await changePasswordForUser(owner.id, input)).success, false);
    assert.equal((await changePasswordForUser(owner.id, { ...input, currentPassword: "original-password", confirmPassword: "different" })).success, false);
    assert.equal((await changePasswordForUser(other.id, input)).success, false);
    assert.equal((await changePasswordForUser(owner.id, { ...input, currentPassword: "original-password" })).success, true);
    const updated = await prisma.user.findUniqueOrThrow({ where: { id: owner.id } });
    assert.ok(await compare("updated-password", updated.passwordHash!));
    assert.equal(await prisma.verificationToken.count({ where: { identifier } }), 0);
    assert.equal((await deleteAccountForUser(owner.id, { confirmation: "wrong", password: "updated-password" })).success, false);
    assert.equal((await deleteAccountForUser(owner.id, { confirmation: "DELETE", password: "wrong-password" })).success, false);
    assert.equal((await deleteAccountForUser(owner.id, { confirmation: "DELETE", password: "updated-password" })).success, true);
    assert.equal(await prisma.user.findUnique({ where: { id: owner.id } }), null);
    assert.equal(await prisma.item.count({ where: { userId: owner.id } }), 0);
    assert.equal(await prisma.collection.count({ where: { userId: owner.id } }), 0);
    assert.ok(await prisma.user.findUnique({ where: { id: other.id } }));
    assert.equal((await deleteAccountForUser(other.id, { confirmation: "DELETE", password: "" })).success, true);
  } finally {
    await prisma.verificationToken.deleteMany({ where: { identifier } });
    await prisma.user.deleteMany({ where: { id: { in: [owner.id, other.id] } } });
  }
});
