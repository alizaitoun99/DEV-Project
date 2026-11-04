import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Folder, Star } from "lucide-react";
import { TypeIcon } from "@/components/dashboard/TypeIcon";
import { ItemDrawerTrigger } from "@/components/items/ItemDrawerProvider";
import { getCurrentUser } from "@/lib/current-user";
import { getFavorites } from "@/lib/db/favorites";

export const metadata: Metadata = { title: "Favorites | DevStash" };

const dateFormat = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const rowClass = "relative grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-2 py-2 text-sm hover:bg-muted/30 sm:grid-cols-[auto_minmax(0,1fr)_7rem_8rem]";

interface DateAddedProps { date: Date; }

function DateAdded({ date }: DateAddedProps) {
  return <time dateTime={date.toISOString()} title="Date added" className="col-start-2 text-xs text-muted-foreground sm:col-start-auto sm:text-right">{dateFormat.format(date)}</time>;
}

export default async function FavoritesPage() {
  await connection();
  const user = await getCurrentUser();
  const { items, collections } = await getFavorites(user.id);

  return (
    <div className="mx-auto max-w-5xl space-y-8 font-mono">
      <header>
        <h1 className="flex items-center gap-3 text-2xl font-semibold tracking-tight"><Star aria-hidden="true" className="size-6 text-yellow-400" />Favorites</h1>
        <p className="mt-2 text-xs text-muted-foreground">Your starred items and collections, ordered by latest update.</p>
      </header>
      {items.length === 0 && collections.length === 0 && <p className="text-sm text-muted-foreground">No favorites yet. Your favorited items and collections will appear here.</p>}
      <section aria-labelledby="favorite-items">
        <h2 id="favorite-items" className="border-b pb-2 text-sm font-semibold">Items <span className="text-muted-foreground">({items.length})</span></h2>
        {items.length ? <ul className="divide-y divide-border/40">
          {items.map((item) => <li key={item.id} className={rowClass}>
            <ItemDrawerTrigger id={item.id} title={item.title} />
            <TypeIcon typeId={item.type.slug} label={item.type.name} />
            <span className="truncate" title={item.title}>{item.title}</span>
            <span className="rounded bg-muted/50 px-1.5 py-0.5 text-xs text-muted-foreground sm:justify-self-start">{item.type.name}</span>
            <DateAdded date={item.createdAt} />
          </li>)}
        </ul> : <p className="py-3 text-xs text-muted-foreground">No favorite items.</p>}
      </section>
      <section aria-labelledby="favorite-collections">
        <h2 id="favorite-collections" className="border-b pb-2 text-sm font-semibold">Collections <span className="text-muted-foreground">({collections.length})</span></h2>
        {collections.length ? <ul className="divide-y divide-border/40">
          {collections.map((collection) => <li key={collection.id}>
            <Link href={`/collections/${encodeURIComponent(collection.id)}`} className={`${rowClass} outline-none focus-visible:ring-2 focus-visible:ring-ring`}>
              <Folder aria-hidden="true" className="size-5 text-muted-foreground" />
              <span className="truncate" title={collection.name}>{collection.name}</span>
              <span className="rounded bg-muted/50 px-1.5 py-0.5 text-xs text-muted-foreground sm:justify-self-start">Collection</span>
              <DateAdded date={collection.createdAt} />
            </Link>
          </li>)}
        </ul> : <p className="py-3 text-xs text-muted-foreground">No favorite collections.</p>}
      </section>
    </div>
  );
}
