import Link from "next/link";
import { Star } from "lucide-react";
import { CollectionActions } from "@/components/collections/CollectionActions";
import type { CollectionSummary } from "@/lib/db/collections";
import { getTypeStyle, TypeIcon } from "@/components/dashboard/TypeIcon";

interface CollectionCardProps {
  collection: CollectionSummary;
}

export function CollectionCard({ collection }: CollectionCardProps) {
  const { types, itemCount } = collection;
  const border = types.length ? getTypeStyle(types[0].slug).border : "border-l-border";

  return (
    <div className={`relative flex min-w-0 flex-col rounded-xl border border-l-2 bg-card/20 p-5 transition-colors hover:bg-muted/40 ${border}`}>
      <div className="flex items-start gap-2">
        <h3 className="min-w-0 flex-1 break-words font-medium"><Link href={`/collections/${collection.id}`} prefetch={false} className="outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-ring">{collection.name}</Link></h3>
        {collection.isFavorite && <Star aria-label="Favorite collection" className="size-4 shrink-0 fill-yellow-400 text-yellow-400" />}
        <div className="relative z-10 -mr-2 -mt-2"><CollectionActions collection={collection} menu /></div>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{itemCount} {itemCount === 1 ? "item" : "items"}</p>
      <p className="mt-4 flex-1 text-sm leading-relaxed text-muted-foreground">{collection.description}</p>
      <div className="mt-4 flex flex-wrap gap-3">
        {types.map((type) => <TypeIcon key={type.id} typeId={type.slug} label={type.name} />)}
      </div>
    </div>
  );
}
