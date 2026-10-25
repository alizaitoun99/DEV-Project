import Link from "next/link";
import { Star } from "lucide-react";
import type { CollectionSummary } from "@/lib/db/collections";
import { getTypeStyle, TypeIcon } from "@/components/dashboard/TypeIcon";

interface CollectionCardProps {
  collection: CollectionSummary;
}

export function CollectionCard({ collection }: CollectionCardProps) {
  const { types, itemCount } = collection;
  const border = types.length ? getTypeStyle(types[0].slug).border : "border-l-border";

  return (
    <Link href={`/collections/${collection.id}`} prefetch={false} className={`flex min-w-0 flex-col rounded-xl border border-l-2 bg-card/20 p-5 outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring ${border}`}>
      <div className="flex items-start gap-2">
        <h3 className="min-w-0 flex-1 break-words font-medium">{collection.name}</h3>
        {collection.isFavorite && <Star aria-label="Favorite collection" className="size-4 shrink-0 fill-yellow-400 text-yellow-400" />}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{itemCount} {itemCount === 1 ? "item" : "items"}</p>
      <p className="mt-4 flex-1 text-sm leading-relaxed text-muted-foreground">{collection.description}</p>
      <div className="mt-4 flex flex-wrap gap-3">
        {types.map((type) => <TypeIcon key={type.id} typeId={type.slug} label={type.name} />)}
      </div>
    </Link>
  );
}
