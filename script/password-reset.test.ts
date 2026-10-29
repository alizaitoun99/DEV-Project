import "dotenv/config";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { compare, hash } from "bcryptjs";
import { prisma } from "../src/lib/prisma";
import { resetPassword, sendPasswordResetEmail } from "../src/lib/password-reset";
import { verificationDigest, verifyEmailToken } from "../src/lib/email-verification";
import { resetPasswordSchema } from "../src/lib/auth-validation";

after(async () => { await prisma.$disconnect(); });

test("reset validation rejects mismatches and passwords exceeding bcrypt's byte limit", () => {
  const token = "a".repeat(64);
  assert.equal(resetPasswordSchema.safeParse({ token, password: "password123", confirmPassword: "different" }).success, false);
  assert.equal(resetPasswordSchema.safeParse({ token, password: "é".repeat(40), confirmPassword: "é".repeat(40) }).success, false);
});

test("reset tokens are hashed, purpose-bound, expiring and single-use across concurrent links", async (t) => {
  const email = `reset-${randomUUID()}@example.com`;
  const user = await prisma.user.create({ data: { email, passwordHash: await hash("old-password123", 12) } });
  const identifier = `password-reset:${user.id}:${email}`;
  const original = { key: process.env.RESEND_API_KEY, from: process.env.RESEND_FROM_EMAIL, url: process.env.APP_URL, flag: process.env.EMAIL_VERIFICATION_ENABLED };
  Object.assign(process.env, { RESEND_API_KEY: "test", RESEND_FROM_EMAIL: "test@example.com", APP_URL: "http://localhost:3000", EMAIL_VERIFICATION_ENABLED: "false" });
  let message = "";
  t.mock.method(globalThis, "fetch", async (_url: unknown, options: RequestInit) => {
    message = String(options.body);
    return Response.json({ id: "mock" });
  });
  try {
    await sendPasswordResetEmail({ id: user.id, email });
    const token = /token=([a-f0-9]{64})/.exec(message)?.[1];
    assert.ok(token);
    const stored = await prisma.verificationToken.findUniqueOrThrow({ where: { token: verificationDigest(token) } });
    assert.notEqual(stored.token, token);
    assert.ok(stored.expires.getTime() <= Date.now() + 30 * 60000);
    assert.equal(await verifyEmailToken(token), false);
    await prisma.user.update({ where: { id: user.id }, data: { email: `changed-${email}` } });
    assert.equal(await resetPassword(token, "new-password123"), false);
    await prisma.user.update({ where: { id: user.id }, data: { email, passwordHash: null } });
    assert.equal(await resetPassword(token, "new-password123"), false);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hash("old-password123", 12) } });
    const verification = randomBytes(32).toString("hex");
    await prisma.verificationToken.create({ data: { identifier: `email-verification:${user.id}:${email}`, token: verificationDigest(verification), expires: new Date(Date.now() + 60000) } });
    assert.equal(await resetPassword(verification, "new-password123"), false);
    await prisma.verificationToken.update({ where: { token: stored.token }, data: { expires: new Date(0) } });
    assert.equal(await resetPassword(token, "new-password123"), false);
    await prisma.verificationToken.update({ where: { token: stored.token }, data: { expires: new Date(Date.now() + 60000) } });
    const other = randomBytes(32).toString("hex");
    await prisma.verificationToken.create({ data: { identifier, token: verificationDigest(other), expires: new Date(Date.now() + 60000) } });
    const results = await Promise.all([resetPassword(token, "new-password123"), resetPassword(other, "new-password123")]);
    assert.equal(results.filter(Boolean).length, 1);
    assert.equal(await resetPassword(token, "another-password"), false);
    assert.equal(await resetPassword(other, "another-password"), false);
    const changed = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    assert.ok(await compare("new-password123", changed.passwordHash!));
    assert.equal(await compare("old-password123", changed.passwordHash!), false);
    assert.equal(await prisma.verificationToken.count({ where: { identifier } }), 0);
  } finally {
    await prisma.verificationToken.deleteMany({ where: { identifier: { in: [identifier, `email-verification:${user.id}:${email}`] } } });
    await prisma.user.delete({ where: { id: user.id } });
    for (const [key, value] of Object.entries({ RESEND_API_KEY: original.key, RESEND_FROM_EMAIL: original.from, APP_URL: original.url, EMAIL_VERIFICATION_ENABLED: original.flag })) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
