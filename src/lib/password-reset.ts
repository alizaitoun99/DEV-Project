import "server-only";

import { randomBytes } from "node:crypto";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { verificationDigest } from "@/lib/email-verification";

export async function sendPasswordResetEmail(user: { id: string; email: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  const baseUrl = process.env.APP_URL ?? process.env.AUTH_URL;
  if (!apiKey || !from || !baseUrl) throw new Error("Email delivery is not configured.");
  const url = new URL("/reset-password", baseUrl);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) {
    throw new Error("Password reset requires a secure application URL.");
  }
  const token = randomBytes(32).toString("hex");
  const digest = verificationDigest(token);
  const identifier = `password-reset:${user.id}:${user.email}`;
  url.searchParams.set("token", token);
  await prisma.verificationToken.deleteMany({ where: { identifier, expires: { lte: new Date() } } });
  await prisma.verificationToken.create({
    data: { identifier, token: digest, expires: new Date(Date.now() + 30 * 60 * 1000) },
  });
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": digest },
    body: JSON.stringify({ from, to: [user.email], subject: "Reset your DevStash password",
      text: `Reset your password using this link:\n\n${url.href}\n\nThis link expires in 30 minutes. If you did not request this, ignore this email.` }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error("Password reset email delivery failed.");
}

export async function resetPassword(token: string, password: string): Promise<boolean> {
  if (!/^[a-f0-9]{64}$/.test(token)) return false;
  const digest = verificationDigest(token);
  const stored = await prisma.verificationToken.findUnique({ where: { token: digest } });
  if (!stored || stored.expires <= new Date() || !stored.identifier.startsWith("password-reset:")) return false;
  const identity = stored.identifier.slice("password-reset:".length);
  const separator = identity.indexOf(":");
  if (separator < 1) return false;
  const id = identity.slice(0, separator);
  const email = identity.slice(separator + 1);
  const user = await prisma.user.findUnique({ where: { id }, select: { passwordHash: true, email: true } });
  if (!user?.passwordHash || user.email !== email) return false;
  const passwordHash = await hash(password, 12);
  try {
    return await prisma.$transaction(async (tx) => {
      // Compare the previous hash to serialize concurrent resets, including different links.
      const updated = await tx.user.updateMany({
        where: { id, email, passwordHash: user.passwordHash }, data: { passwordHash },
      });
      if (updated.count !== 1) return false;
      const consumed = await tx.verificationToken.deleteMany({
        where: { token: digest, identifier: stored.identifier, expires: { gt: new Date() } },
      });
      if (consumed.count !== 1) throw new InvalidResetToken();
      await tx.verificationToken.deleteMany({ where: { identifier: stored.identifier } });
      return true;
    });
  } catch (error) {
    if (error instanceof InvalidResetToken) return false;
    throw error;
  }
}

class InvalidResetToken extends Error {}
