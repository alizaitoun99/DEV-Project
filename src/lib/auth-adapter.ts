import "server-only";

import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Adapter } from "next-auth/adapters";
import { normalizeEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";

export function createAuthAdapter(baseAdapter: Adapter = PrismaAdapter(prisma)): Adapter {
  return {
    ...baseAdapter,
    createUser(user) {
      return baseAdapter.createUser!({ ...user, email: normalizeEmail(user.email) });
    },
    getUserByEmail(email) {
      return baseAdapter.getUserByEmail!(normalizeEmail(email));
    },
    updateUser(user) {
      return baseAdapter.updateUser!({
        ...user,
        ...(typeof user.email === "string" ? { email: normalizeEmail(user.email) } : {}),
      });
    },
  };
}

export const authAdapter = createAuthAdapter();
