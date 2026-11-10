import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const findCurrentUser = cache(async () => {
  const session = await auth();
  if (!session?.user.id) return null;

  return prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, image: true, plan: true, emailVerified: true },
  });
});

export async function getCurrentUser() {
  const user = await findCurrentUser();
  if (!user) {
    redirect("/sign-in?callbackUrl=%2Fdashboard");
  }
  return user;
}
