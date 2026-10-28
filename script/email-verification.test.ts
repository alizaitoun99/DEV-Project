import "dotenv/config";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { prisma } from "../src/lib/prisma";
import { sendVerificationEmail, verificationDigest, verifyEmailToken } from "../src/lib/email-verification";
import { POST as register } from "../src/app/api/auth/register/route";

after(async () => { await prisma.$disconnect(); });

test("verification rejects malformed, expired and changed-email tokens; concurrent redemption succeeds once", async () => {
  const email = `verification-${randomUUID()}@example.com`;
  const user = await prisma.user.create({ data: { email } });
  const identifier = `email-verification:${user.id}:${email}`;
  const token = randomBytes(32).toString("hex");
  try {
    assert.equal(await verifyEmailToken("invalid"), false);
    assert.equal(await verifyEmailToken(randomBytes(32).toString("hex")), false);
    await prisma.verificationToken.create({ data: { identifier, token: verificationDigest(token), expires: new Date(0) } });
    assert.equal(await verifyEmailToken(token), false);
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).emailVerified, null);
    await prisma.verificationToken.update({ where: { token: verificationDigest(token) }, data: { expires: new Date(Date.now() + 60000) } });
    await prisma.user.update({ where: { id: user.id }, data: { email: `changed-${email}` } });
    assert.equal(await verifyEmailToken(token), false);
    await prisma.user.update({ where: { id: user.id }, data: { email } });
    await prisma.verificationToken.create({ data: { identifier, token: verificationDigest(token), expires: new Date(Date.now() + 60000) } });
    const results = await Promise.all([verifyEmailToken(token), verifyEmailToken(token)]);
    assert.equal(results.filter(Boolean).length, 1);
    assert.ok((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).emailVerified);
    assert.equal(await verifyEmailToken(token), false);
  } finally {
    await prisma.verificationToken.deleteMany({ where: { identifier } });
    await prisma.user.delete({ where: { id: user.id } });
  }
});

test("Resend receives the raw link while only its hash is stored; delivery failure preserves retryable account", async (t) => {
  const original = { key: process.env.RESEND_API_KEY, from: process.env.RESEND_FROM_EMAIL, url: process.env.APP_URL };
  process.env.RESEND_API_KEY = "test-key";
  process.env.RESEND_FROM_EMAIL = "DevStash <test@example.com>";
  process.env.APP_URL = "http://localhost:3000";
  const email = `delivery-${randomUUID()}@example.com`;
  const user = await prisma.user.create({ data: { email } });
  const identifier = `email-verification:${user.id}:${email}`;
  let message = "";
  const registrationEmails = [`register-${randomUUID()}@example.com`, `failed-${randomUUID()}@example.com`];
  const fetchMock = t.mock.method(globalThis, "fetch", async (_url: unknown, options: RequestInit) => {
    message = String(options.body);
    return Response.json({ id: "test-email" });
  });
  try {
    await sendVerificationEmail({ id: user.id, email });
    const body = JSON.parse(message);
    assert.deepEqual(body.to, [email]);
    const token = /token=([a-f0-9]{64})/.exec(body.text)?.[1];
    assert.ok(token);
    const stored = await prisma.verificationToken.findUniqueOrThrow({ where: { token: verificationDigest(token) } });
    assert.notEqual(stored.token, token);
    assert.ok(stored.expires.getTime() > Date.now() + 23 * 3600000);
    async function registration(address: string) {
      return register(new Request("http://localhost:3000/api/auth/register", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Verification test", email: address, password: "Verification-test-2026!", confirmPassword: "Verification-test-2026!" }),
      }));
    }
    const sent = await registration(registrationEmails[0]);
    assert.equal(sent.status, 201);
    assert.equal((await sent.json()).verificationEmailSent, true);
    fetchMock.mock.mockImplementation(async () => Response.json({ error: "unavailable" }, { status: 503 }));
    const failed = await registration(registrationEmails[1]);
    assert.equal(failed.status, 201);
    const failedBody = await failed.json();
    assert.equal(failedBody.success, true);
    assert.equal(failedBody.verificationEmailSent, false);
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { email: registrationEmails[1] } })).emailVerified, null);
    await assert.rejects(sendVerificationEmail({ id: user.id, email }), /delivery failed/);
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).emailVerified, null);
    assert.equal(await verifyEmailToken(token), true);
  } finally {
    fetchMock.mock.restore();
    for (const [key, value] of Object.entries({ RESEND_API_KEY: original.key, RESEND_FROM_EMAIL: original.from, APP_URL: original.url })) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    await prisma.verificationToken.deleteMany({ where: { identifier } });
    await prisma.user.delete({ where: { id: user.id } });
    for (const address of registrationEmails) {
      const registered = await prisma.user.findUnique({ where: { email: address } });
      if (registered) {
        await prisma.verificationToken.deleteMany({ where: { identifier: `email-verification:${registered.id}:${address}` } });
        await prisma.user.delete({ where: { id: registered.id } });
      }
    }
  }
});
