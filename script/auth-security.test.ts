import "dotenv/config";

import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "../src/lib/prisma";
import { createAuthAdapter } from "../src/lib/auth-adapter";
import { POST as register } from "../src/app/api/auth/register/route";
import { normalizeEmail } from "../src/lib/email";
import { AuthRateLimitError, consumeAuthLimit, limitAuthAccount } from "../src/lib/auth-rate-limit";

after(async () => { await prisma.$disconnect(); });

test("parallel requests share an atomic limit and expired windows restart", async () => {
  const key = `security-test:${randomUUID()}`;
  assert.ok(process.env.AUTH_SECRET);
  const digest = createHmac("sha256", process.env.AUTH_SECRET).update(key).digest("hex");
  try {
    const results = await Promise.allSettled(Array.from({ length: 20 }, () => consumeAuthLimit(key, 5, 60)));
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 5);
    for (const result of results) {
      if (result.status === "rejected") {
        assert.ok(result.reason instanceof AuthRateLimitError);
        assert.ok(result.reason.retryAfter > 0 && result.reason.retryAfter <= 60);
      }
    }
    await prisma.authRateLimit.update({ where: { key: digest }, data: { expiresAt: new Date(0) } });
    await consumeAuthLimit(key, 5, 60);
    assert.equal((await prisma.authRateLimit.findUniqueOrThrow({ where: { key: digest } })).attempts, 1);
  } finally {
    await prisma.authRateLimit.deleteMany({ where: { key: digest } });
  }
});

test("email casing cannot bypass the account budget", async () => {
  const email = `security-${randomUUID()}@example.com`;
  assert.ok(process.env.AUTH_SECRET);
  const key = createHmac("sha256", process.env.AUTH_SECRET).update(`signin:account:${email}`).digest("hex");
  try {
    for (let attempt = 0; attempt < 5; attempt++) await limitAuthAccount("signin", email);
    await assert.rejects(limitAuthAccount("signin", ` ${email.toUpperCase()} `), AuthRateLimitError);
  } finally {
    await prisma.authRateLimit.deleteMany({ where: { key } });
  }
});

test("limiter fails closed when storage is unavailable", async () => {
  const unavailable = { $queryRaw: async () => { throw new Error("test storage outage"); } };
  await assert.rejects(consumeAuthLimit("outage", 5, 60, unavailable), /test storage outage/);
});

test("OAuth adapter normalizes create, lookup, and update without changing account identity", async () => {
  const rollback = new Error("rollback security fixture");
  const email = `security-${randomUUID()}@example.com`;
  await assert.rejects(prisma.$transaction(async (tx) => {
    const adapter = createAuthAdapter(PrismaAdapter(tx));
    assert.ok(adapter.createUser && adapter.getUserByEmail && adapter.updateUser);
    const user = await adapter.createUser({ id: randomUUID(), email: ` ${email.toUpperCase()} `, emailVerified: null });
    assert.equal(user.email, email);
    assert.equal((await adapter.getUserByEmail(` ${email.toUpperCase()} `))?.id, user.id);
    const updated = await adapter.updateUser({ id: user.id, email: ` NEW-${email.toUpperCase()} ` });
    assert.equal(updated.id, user.id);
    assert.equal(updated.email, `new-${email}`);
    throw rollback;
  }), (error: unknown) => error === rollback);
  assert.equal(await prisma.user.findUnique({ where: { email } }), null);
});

test("normalized duplicate OAuth creation is rejected by the unique constraint", async () => {
  const email = `security-${randomUUID()}@example.com`;
  await assert.rejects(prisma.$transaction(async (tx) => {
    const adapter = createAuthAdapter(PrismaAdapter(tx));
    assert.ok(adapter.createUser);
    await tx.user.create({ data: { email } });
    await adapter.createUser({ id: randomUUID(), email: email.toUpperCase(), emailVerified: null });
  }), (error: unknown) => typeof error === "object" && error !== null && "code" in error && error.code === "P2002");
});

test("database rejects noncanonical email writes from other callers", async () => {
  const email = `SECURITY-${randomUUID()}@EXAMPLE.COM`;
  assert.equal(normalizeEmail(` ${email} `), email.toLowerCase());
  await assert.rejects(prisma.$transaction(async (tx) => {
    await tx.user.create({ data: { email } });
  }), /User_email_canonical_check/);
});

test("registration rejects an OAuth email case variant and returns 429 with Retry-After", async () => {
  const email = `security-${randomUUID()}@example.com`;
  const adapter = createAuthAdapter();
  assert.ok(adapter.createUser && process.env.AUTH_SECRET);
  const user = await adapter.createUser({ id: randomUUID(), email: email.toUpperCase(), emailVerified: null });
  const key = createHmac("sha256", process.env.AUTH_SECRET).update(`register:account:${email}`).digest("hex");
  try {
    for (let attempt = 0; attempt < 4; attempt++) {
      const response = await register(new Request("http://localhost/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Security fixture", email: ` ${email.toUpperCase()} `,
          password: "Test-password-2026!", confirmPassword: "Test-password-2026!",
        }),
      }));
      assert.equal(response.status, attempt < 3 ? 409 : 429);
      if (attempt === 3) {
        const retryAfter = Number(response.headers.get("Retry-After"));
        assert.ok(retryAfter > 0 && retryAfter <= 3600);
        assert.equal(response.headers.get("Cache-Control"), "no-store");
      }
    }
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).passwordHash, null);
  } finally {
    await prisma.user.deleteMany({ where: { id: user.id } });
    await prisma.authRateLimit.deleteMany({ where: { key } });
  }
});
