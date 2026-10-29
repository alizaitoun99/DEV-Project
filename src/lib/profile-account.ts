import "server-only";

import { compare, hash } from "bcryptjs";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { credentialsSchema } from "@/lib/auth-validation";
import { AuthRateLimitError, consumeAuthLimit } from "@/lib/auth-rate-limit";

interface AccountResult {
  success: boolean;
  error?: string;
}

const changeSchema = z.object({
  currentPassword: z.string().min(1).max(72),
  password: credentialsSchema.shape.password,
  confirmPassword: z.string().max(72),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match.", path: ["confirmPassword"],
});

export async function changePasswordForUser(userId: string, input: unknown): Promise<AccountResult> {
  try {
    const parsed = changeSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
    await consumeAuthLimit(`profile:password:${userId}`, 5, 15 * 60);
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true, email: true } });
    if (!user?.passwordHash || !(await compare(parsed.data.currentPassword, user.passwordHash))) {
      return { success: false, error: "Current password is incorrect." };
    }
    const passwordHash = await hash(parsed.data.password, 12);
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.user.updateMany({ where: { id: userId, passwordHash: user.passwordHash }, data: { passwordHash } });
      if (result.count === 1) await tx.verificationToken.deleteMany({ where: { identifier: `password-reset:${userId}:${user.email}` } });
      return result.count === 1;
    });
    return updated ? { success: true } : { success: false, error: "Your password changed elsewhere. Please try again." };
  } catch (error) {
    return { success: false, error: error instanceof AuthRateLimitError ? error.message : "Unable to change password. Please try again." };
  }
}

export async function deleteAccountForUser(userId: string, input: unknown): Promise<AccountResult> {
  try {
    const parsed = z.object({ confirmation: z.literal("DELETE"), password: z.string().max(72) }).safeParse(input);
    if (!parsed.success) return { success: false, error: "Type DELETE to confirm account deletion." };
    await consumeAuthLimit(`profile:delete:${userId}`, 5, 15 * 60);
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true, email: true } });
    if (!user) return { success: false, error: "Account no longer exists." };
    if (user.passwordHash && !(await compare(parsed.data.password, user.passwordHash))) return { success: false, error: "Current password is incorrect." };
    await prisma.$transaction(async (tx) => {
      await tx.verificationToken.deleteMany({ where: { identifier: { in: [
        `password-reset:${userId}:${user.email}`, `email-verification:${userId}:${user.email}`,
      ] } } });
      // Cascades remove owned data, memberships, and linked authentication records.
      await tx.user.delete({ where: { id: userId, passwordHash: user.passwordHash } });
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof AuthRateLimitError ? error.message : "Unable to delete account. Please try again." };
  }
}
