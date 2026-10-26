import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const getCurrentUser = cache(async () => {
  const session = await auth();
  if (!session?.user.id) {
    redirect("/api/auth/signin?callbackUrl=%2Fdashboard");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, plan: true },
  });
  if (!user) {
    redirect("/api/auth/signin?callbackUrl=%2Fdashboard");
  }
  return user;
});
