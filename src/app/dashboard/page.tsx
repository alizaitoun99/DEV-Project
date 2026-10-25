import type { Metadata } from "next";
import Link from "next/link";
import { Clock3, FolderOpen, Layers, Pin, Star } from "lucide-react";
import { CollectionCard } from "@/components/dashboard/CollectionCard";
import { ItemCard } from "@/components/dashboard/ItemCard";
import { COLLECTIONS, ITEMS } from "@/lib/mock-data";
import { getRecentCollections, getRecentItems } from "@/lib/dashboard-data";

export const metadata: Metadata = {
  title: "Dashboard | DevStash",
};

export default function DashboardPage() {
  const stats = [
    { label: "Items", count: ITEMS.length, icon: Layers },
    { label: "Collections", count: COLLECTIONS.length, icon: FolderOpen },
    { label: "Favorite items", count: ITEMS.filter((item) => item.isFavorite).length, icon: Star },
    { label: "Favorite collections", count: COLLECTIONS.filter((collection) => collection.isFavorite).length, icon: Star },
  ];
  const collections = getRecentCollections(6);
  const pinned = ITEMS.filter((item) => item.isPinned);
  const recent = getRecentItems(10);

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
        {collections.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{collections.map((collection) => <CollectionCard key={collection.id} collection={collection} />)}</div> : <p className="text-sm text-muted-foreground">Open an item in a collection to see it here.</p>}
      </section>
      <section aria-labelledby="pinned-items-heading">
        <h2 id="pinned-items-heading" className="mb-5 flex items-center gap-2 text-xl font-semibold"><Pin aria-hidden="true" className="size-5 text-muted-foreground" />Pinned items</h2>
        <div className="space-y-3">{pinned.length ? pinned.map((item) => <ItemCard key={item.id} item={item} />) : <p className="text-sm text-muted-foreground">Pin items to keep them close at hand.</p>}</div>
      </section>
      <section aria-labelledby="recent-items-heading">
        <h2 id="recent-items-heading" className="flex items-center gap-2 text-xl font-semibold"><Clock3 aria-hidden="true" className="size-5 text-muted-foreground" />Recent items</h2>
        <p className="mt-1 mb-5 text-sm text-muted-foreground">Your {recent.length} most recently updated items</p>
        <div className="space-y-3">{recent.length ? recent.map((item) => <ItemCard key={item.id} item={item} />) : <p className="text-sm text-muted-foreground">Your saved items will appear here.</p>}</div>
      </section>
    </div>
  );
}
