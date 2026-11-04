import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ItemCard } from "@/components/dashboard/ItemCard";
import { TypeIcon } from "@/components/dashboard/TypeIcon";
import { getCurrentUser } from "@/lib/current-user";
import { getCollection } from "@/lib/db/collections";
import { getItemsByCollection } from "@/lib/db/items";

interface CollectionPageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = { title: "Collection | DevStash" };

const TYPE_LABELS: Record<string, string> = {
  snippet: "Snippets", prompt: "Prompts", command: "Commands", note: "Notes",
  file: "Files", image: "Images", link: "Links",
};

export default async function CollectionPage({ params }: CollectionPageProps) {
  await connection();
  const user = await getCurrentUser();
  const { id } = await params;
  const collection = await getCollection(user.id, id);
  if (!collection) notFound();
  const items = await getItemsByCollection(user.id, collection.id);
  const slugs = [...new Set(items.map((item) => item.type.slug))];
  const typeOrder = Object.keys(TYPE_LABELS);
  slugs.sort((a, b) => {
    const rank = (slug: string) => typeOrder.includes(slug) ? typeOrder.indexOf(slug) : typeOrder.length;
    return rank(a) - rank(b) || a.localeCompare(b);
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Link href="/collections" className="inline-block rounded-sm text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">← All collections</Link>
      <div>
        <h1 className="break-words text-3xl font-semibold tracking-tight">{collection.name}</h1>
        {collection.description && <p className="mt-2 whitespace-pre-wrap break-words text-muted-foreground">{collection.description}</p>}
        <p className="mt-2 text-sm text-muted-foreground">{items.length} {items.length === 1 ? "item" : "items"}</p>
      </div>
      {items.length > 0 ? (
        <div className="space-y-8">
          {slugs.map((slug) => {
            const group = items.filter((item) => item.type.slug === slug);
            const label = TYPE_LABELS[slug] ?? group[0].type.name;
            return (
              <section key={slug} aria-labelledby={`collection-type-${slug}`}>
                <div className="mb-4 flex items-center gap-2">
                  <TypeIcon typeId={slug} label={label} />
                  <h2 id={`collection-type-${slug}`} className="text-xl font-semibold">{label}</h2>
                  <span className="text-sm text-muted-foreground">({group.length})</span>
                </div>
                <div className={slug === "image" ? "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" : "grid grid-cols-1 gap-4 md:grid-cols-2"}>
                  {group.map((item) => <ItemCard key={item.id} item={item} />)}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">This collection has no items yet. Add items using the collection selector when creating or editing an item.</p>
      )}
    </div>
  );
}
