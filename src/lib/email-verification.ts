import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";

export function verificationDigest(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function sendVerificationEmail(user: { id: string; email: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  const baseUrl = process.env.APP_URL ?? process.env.AUTH_URL;
  if (!apiKey || !from || !baseUrl) {
    console.error("Verification email configuration missing:", {
      apiKey: !apiKey, sender: !from, appUrl: !baseUrl,
    });
    throw new Error("Email delivery is not configured.");
  }
  const url = new URL("/verify-email", baseUrl);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) {
    throw new Error("Verification requires a secure application URL.");
  }
  const token = randomBytes(32).toString("hex");
  const digest = verificationDigest(token);
  url.searchParams.set("token", token);
  const identifier = `email-verification:${user.id}:${user.email}`;
  await prisma.verificationToken.deleteMany({ where: { identifier, expires: { lte: new Date() } } });
  await prisma.verificationToken.create({
    data: { identifier, token: digest, expires: new Date(Date.now() + 24 * 60 * 60 * 1000) },
  });
  // Keep previous links valid when delivery is uncertain or another send is in flight.
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": digest },
    body: JSON.stringify({ from, to: [user.email], subject: "Verify your DevStash email", text: `Welcome to DevStash! Verify your email address using this link:\n\n${url.href}\n\nThis link expires in 24 hours. If you did not create this account, ignore this email.` }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) {
    const details: unknown = await response.json().catch(() => null);
    const providerCode = typeof details === "object" && details !== null && "name" in details
      && typeof details.name === "string" && /^[a-z_]{1,64}$/.test(details.name) ? details.name : "unknown";
    console.error("Resend rejected verification email:", {
      status: response.status, code: providerCode,
    });
    throw new Error("Verification email delivery failed.");
  }
}

export async function verifyEmailToken(token: string): Promise<boolean> {
  if (!/^[a-f0-9]{64}$/.test(token)) return false;
  return prisma.$transaction(async (tx) => {
    const stored = await tx.verificationToken.findUnique({ where: { token: verificationDigest(token) } });
    if (!stored || stored.expires <= new Date() || !stored.identifier.startsWith("email-verification:")) return false;
    const identity = stored.identifier.slice("email-verification:".length);
    const separator = identity.indexOf(":");
    const id = identity.slice(0, separator);
    const email = identity.slice(separator + 1);
    const consumed = await tx.verificationToken.deleteMany({ where: { token: stored.token, expires: { gt: new Date() } } });
    if (consumed.count !== 1) return false;
    const updated = await tx.user.updateMany({ where: { id, email, emailVerified: null }, data: { emailVerified: new Date() } });
    await tx.verificationToken.deleteMany({ where: { identifier: stored.identifier } });
    return updated.count === 1;
  });
}
