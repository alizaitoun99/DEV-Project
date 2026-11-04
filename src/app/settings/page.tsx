import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { ProfileActions } from "@/components/auth/ProfileActions";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Settings | DevStash" };

async function Settings() {
  await connection();
  const user = await getCurrentUser();
  const details = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { passwordHash: true },
  });

  return (
    <div className="w-full max-w-3xl space-y-6">
      <Link href="/dashboard" className="text-sm text-primary underline underline-offset-4">Back to dashboard</Link>
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your account and security.</p>
      </header>
      <ProfileActions hasPassword={Boolean(details.passwordHash)} />
    </div>
  );
}

export default function SettingsPage() {
  return (
    <main className="flex min-h-dvh justify-center px-4 py-10 sm:py-14">
      <Suspense fallback={<p role="status">Loading settings…</p>}>
        <Settings />
      </Suspense>
    </main>
  );
}
