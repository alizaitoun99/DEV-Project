"use client";

import { useState } from "react";
import Link from "next/link";

import { Folder, Star } from "lucide-react";
import { TypeIcon } from "@/components/dashboard/TypeIcon";
import { ItemDrawerTrigger } from "@/components/items/ItemDrawerProvider";

import { sortFavorites, type FavoriteSort, type SortableFavorite } from "@/lib/favorite-sorting";

interface FavoriteItem extends SortableFavorite {
  title: string;
  type: { slug: string; name: string };
}

interface FavoriteCollection extends SortableFavorite {
  name: string;
}

interface FavoritesListProps {
  items: FavoriteItem[];
  collections: FavoriteCollection[];
}

interface SortControlProps {
  label: string;
  value: FavoriteSort;
  onChange: (value: FavoriteSort) => void;
  includeType?: boolean;
}

function SortControl({ label, value, onChange, includeType }: SortControlProps) {
  return (
    <label className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      Sort {label.toLowerCase()}
      <select aria-label={`Sort ${label.toLowerCase()}`} value={value} onChange={(event) => onChange(event.target.value as FavoriteSort)} className="h-9 max-w-full rounded-md border border-input bg-background px-2 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <option value="date-desc">Date: newest first</option>
        <option value="date-asc">Date: oldest first</option>
        <option value="name-asc">Name: A–Z</option>
        <option value="name-desc">Name: Z–A</option>
        {includeType && <option value="type-asc">Item type: A–Z</option>}
        {includeType && <option value="type-desc">Item type: Z–A</option>}
      </select>
    </label>
  );
}

const dateFormat = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const rowClass = "relative grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-2 py-2 text-sm hover:bg-muted/30 sm:grid-cols-[auto_minmax(0,1fr)_7rem_8rem]";

interface DateAddedProps { date: Date; }

function DateAdded({ date }: DateAddedProps) {
  return <time dateTime={date.toISOString()} title="Date added" className="col-start-2 text-xs text-muted-foreground sm:col-start-auto sm:text-right">{dateFormat.format(date)}</time>;
}

export function FavoritesList({ items, collections }: FavoritesListProps) {
  const [itemSort, setItemSort] = useState<FavoriteSort>("date-desc");
  const [collectionSort, setCollectionSort] = useState<FavoriteSort>("date-desc");
  const sortedItems = sortFavorites(items, itemSort);
  const sortedCollections = sortFavorites(collections, collectionSort);
  return (
    <div className="mx-auto max-w-5xl space-y-8 font-mono">
      <header>
        <h1 className="flex items-center gap-3 text-2xl font-semibold tracking-tight"><Star aria-hidden="true" className="size-6 text-yellow-400" />Favorites</h1>
        <p className="mt-2 text-xs text-muted-foreground">Your starred items and collections. Sort by name, date, or item type.</p>
      </header>
      {items.length === 0 && collections.length === 0 && <p className="text-sm text-muted-foreground">No favorites yet. Your favorited items and collections will appear here.</p>}
      <section aria-labelledby="favorite-items">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-2"><h2 id="favorite-items" className="text-sm font-semibold">Items <span className="text-muted-foreground">({items.length})</span></h2><SortControl label="Items" value={itemSort} onChange={setItemSort} includeType /></div>
        {items.length ? <ul className="divide-y divide-border/40">
          {sortedItems.map((item) => <li key={item.id} className={rowClass}>
            <ItemDrawerTrigger id={item.id} title={item.title} />
            <TypeIcon typeId={item.type.slug} label={item.type.name} />
            <span className="truncate" title={item.title}>{item.title}</span>
            <span className="rounded bg-muted/50 px-1.5 py-0.5 text-xs text-muted-foreground sm:justify-self-start">{item.type.name}</span>
            <DateAdded date={item.createdAt} />
          </li>)}
        </ul> : <p className="py-3 text-xs text-muted-foreground">No favorite items.</p>}
      </section>
      <section aria-labelledby="favorite-collections">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-2"><h2 id="favorite-collections" className="text-sm font-semibold">Collections <span className="text-muted-foreground">({collections.length})</span></h2><SortControl label="Collections" value={collectionSort} onChange={setCollectionSort} /></div>
        {collections.length ? <ul className="divide-y divide-border/40">
          {sortedCollections.map((collection) => <li key={collection.id}>
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
