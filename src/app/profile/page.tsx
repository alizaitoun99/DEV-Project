import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { UserAvatar } from "@/components/auth/UserAvatar";

export const metadata = { title: "Profile | DevStash" };

async function Profile() {
  await connection();
  const user = await getCurrentUser();
  return <section className="w-full max-w-md space-y-5 rounded-2xl border bg-card p-8"><h1 className="text-2xl font-semibold">Your profile</h1><UserAvatar name={user.name} image={user.image} /><dl className="space-y-4"><div><dt className="text-sm text-muted-foreground">Name</dt><dd className="break-words">{user.name ?? "Not set"}</dd></div><div><dt className="text-sm text-muted-foreground">Email</dt><dd className="break-all">{user.email ?? "Not set"}</dd></div><div><dt className="text-sm text-muted-foreground">Plan</dt><dd>{user.plan}</dd></div></dl><Link href="/dashboard" className="inline-block text-sm text-primary underline underline-offset-4">Back to dashboard</Link></section>;
}

export default function ProfilePage() {
  return <main className="flex min-h-dvh items-center justify-center px-4 py-12"><Suspense fallback={<p role="status">Loading profile…</p>}><Profile /></Suspense></main>;
}
