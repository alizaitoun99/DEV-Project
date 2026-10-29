import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { UserAvatar } from "@/components/auth/UserAvatar";
import { ProfileActions } from "@/components/auth/ProfileActions";

export const metadata = { title: "Profile | DevStash" };

async function Profile() {
  await connection();
  const user = await getCurrentUser();
  const [details, totalItems, totalCollections, types] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { createdAt: true, passwordHash: true } }),
    prisma.item.count({ where: { userId: user.id } }),
    prisma.collection.count({ where: { userId: user.id } }),
    prisma.itemType.findMany({
      where: { OR: [{ isSystem: true }, { userId: user.id }] }, orderBy: { name: "asc" },
      select: { id: true, name: true, _count: { select: { items: { where: { userId: user.id } } } } },
    }),
  ]);
  return <div className="w-full max-w-3xl space-y-6">
    <Link href="/dashboard" className="text-sm text-primary underline underline-offset-4">Back to dashboard</Link>
    <section className="space-y-6 rounded-2xl border bg-card p-6 sm:p-8">
      <div className="flex items-center gap-4"><UserAvatar name={user.name ?? user.email} image={user.image} /><h1 className="text-2xl font-semibold">Your profile</h1></div>
      <dl className="grid gap-5 sm:grid-cols-2">
        <div><dt className="text-sm text-muted-foreground">Name</dt><dd className="break-words">{user.name ?? "Not set"}</dd></div>
        <div><dt className="text-sm text-muted-foreground">Email</dt><dd className="break-all">{user.email ?? "Not set"}</dd></div>
        <div><dt className="text-sm text-muted-foreground">Plan</dt><dd>{user.plan}</dd></div>
        <div><dt className="text-sm text-muted-foreground">Member since</dt><dd><time dateTime={details.createdAt.toISOString()}>{details.createdAt.toLocaleDateString("en-US", { dateStyle: "long", timeZone: "UTC" })}</time></dd></div>
      </dl>
    </section>
    <section className="space-y-5 rounded-2xl border bg-card p-6 sm:p-8" aria-labelledby="usage-heading">
      <h2 id="usage-heading" className="text-xl font-semibold">Your usage</h2>
      <dl className="grid grid-cols-2 gap-4"><div className="rounded-lg bg-muted p-4"><dt className="text-sm text-muted-foreground">Total items</dt><dd className="text-3xl font-semibold">{totalItems}</dd></div><div className="rounded-lg bg-muted p-4"><dt className="text-sm text-muted-foreground">Total collections</dt><dd className="text-3xl font-semibold">{totalCollections}</dd></div></dl>
      <h3 className="font-medium">Items by type</h3>
      <dl className="grid gap-3 sm:grid-cols-2">{types.map((type) => <div key={type.id} className="flex justify-between gap-4 rounded-lg border px-4 py-3"><dt className="break-words">{type.name}</dt><dd className="font-semibold">{type._count.items}</dd></div>)}</dl>
    </section>
    <ProfileActions hasPassword={Boolean(details.passwordHash)} />
  </div>;
}

export default function ProfilePage() {
  return <main className="flex min-h-dvh justify-center px-4 py-10 sm:py-14"><Suspense fallback={<p role="status">Loading profile…</p>}><Profile /></Suspense></main>;
}
