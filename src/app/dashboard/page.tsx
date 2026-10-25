import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Clock3, FolderOpen, Layers, Pin, Star } from "lucide-react";
import { CollectionCard } from "@/components/dashboard/CollectionCard";
import { ItemCard } from "@/components/dashboard/ItemCard";
import { getItemStats, getPinnedItems, getRecentItems } from "@/lib/db/items";
import { getCollectionStats, getRecentCollections } from "@/lib/db/collections";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Dashboard | DevStash",
};

export default async function DashboardPage() {
  await connection();
  // Temporary demo identity until authentication supplies the signed-in owner.
  const user = await prisma.user.findUnique({ where: { email: "demo@devistage.io" }, select: { id: true } });
  const [collections, collectionStats, pinned, recent, itemStats] = user ? await Promise.all([
    getRecentCollections(user.id),
    getCollectionStats(user.id),
    getPinnedItems(user.id),
    getRecentItems(user.id),
    getItemStats(user.id),
  ]) : [[], { total: 0, favorites: 0 }, [], [], { total: 0, favorites: 0 }];
  const stats = [
    { label: "Items", count: itemStats.total, icon: Layers },
    { label: "Collections", count: collectionStats.total, icon: FolderOpen },
    { label: "Favorite items", count: itemStats.favorites, icon: Star },
    { label: "Favorite collections", count: collectionStats.favorites, icon: Star },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-10">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-2 text-muted-foreground">Your developer knowledge hub</p>
      </div>
      <dl aria-label="Library statistics" className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ label, count, icon: Icon }) => (
          <div key={label} className="rounded-xl border bg-card/30 p-4 sm:p-5">
            <dt className="flex items-center justify-between gap-2 text-sm text-muted-foreground">{label}<Icon aria-hidden="true" className="size-4 shrink-0" /></dt>
            <dd className="mt-3 text-3xl font-semibold tabular-nums">{count}</dd>
          </div>
        ))}
      </dl>
      <section aria-labelledby="recent-collections-heading">
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 id="recent-collections-heading" className="text-xl font-semibold">Recent collections</h2>
          <Link href="/collections" prefetch={false} className="shrink-0 rounded-sm text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">View all<span className="sr-only"> collections</span></Link>
        </div>
        {collections.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{collections.map((collection) => <CollectionCard key={collection.id} collection={collection} />)}</div> : <p className="text-sm text-muted-foreground">Your collections will appear here.</p>}
      </section>
      {pinned.length > 0 && <section aria-labelledby="pinned-items-heading">
        <h2 id="pinned-items-heading" className="mb-5 flex items-center gap-2 text-xl font-semibold"><Pin aria-hidden="true" className="size-5 text-muted-foreground" />Pinned items</h2>
        <div className="space-y-3">{pinned.map((item) => <ItemCard key={item.id} item={item} />)}</div>
      </section>}
      <section aria-labelledby="recent-items-heading">
        <h2 id="recent-items-heading" className="flex items-center gap-2 text-xl font-semibold"><Clock3 aria-hidden="true" className="size-5 text-muted-foreground" />Recent items</h2>
        <p className="mt-1 mb-5 text-sm text-muted-foreground">Your {recent.length} most recently updated items</p>
        <div className="space-y-3">{recent.length ? recent.map((item) => <ItemCard key={item.id} item={item} />) : <p className="text-sm text-muted-foreground">Your saved items will appear here.</p>}</div>
      </section>
    </div>
  );
}
